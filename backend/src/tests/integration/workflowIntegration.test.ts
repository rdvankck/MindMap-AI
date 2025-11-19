import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { app, server } from '@/index';
import { WebSocket as WS } from 'ws';
import { prisma } from '@/config/database';
import { redis } from '@/config/redis';

// Mock external dependencies
jest.mock('ws');
jest.mock('@/services/llm/providers/OpenAIProvider');
jest.mock('@/services/llm/providers/OllamaProvider');

describe('Workflow Integration Tests', () => {
  let wsClient: WS;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Setup test database and Redis connections
    await prisma.$connect();
    await redis.connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.disconnect();
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    // Clear test data
    await redis.flushdb();
    
    // Create test user and get auth token
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

    userId = userResponse.body.user.id;
    authToken = userResponse.body.token;

    // Setup WebSocket client
    wsClient = new WS(`ws://localhost:${process.env.PORT || 3001}/socket.io/`);
    
    // Mock WebSocket client
    (WS as jest.Mock).mockImplementation(() => ({
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      readyState: 1,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (wsClient) {
      wsClient.close();
    }
  });

  describe('Complete Workflow Execution', () => {
    it('should execute a simple prompt-response workflow', async () => {
      const workflow = {
        name: 'Simple Test Workflow',
        nodes: [
          {
            id: 'node-1',
            type: 'prompt',
            position: { x: 100, y: 100 },
            data: {
              label: 'User Prompt',
              prompt: 'What is the capital of France?',
              variables: [],
            },
          },
          {
            id: 'node-2',
            type: 'llm',
            position: { x: 300, y: 100 },
            data: {
              label: 'LLM Response',
              model: 'gpt-3.5-turbo',
              temperature: 0.7,
              maxTokens: 100,
            },
          },
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'node-2',
          },
        ],
      };

      // Save workflow
      const saveResponse = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workflow)
        .expect(201);

      const workflowId = saveResponse.body.workflow.id;

      // Execute workflow
      const executeResponse = await request(app)
        .post(`/api/workflows/${workflowId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send()
        .expect(200);

      const executionId = executeResponse.body.execution.id;

      // Wait for execution to complete
      await waitForExecution(executionId, 30000);

      // Get execution results
      const resultsResponse = await request(app)
        .get(`/api/executions/${executionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(resultsResponse.body.execution.status).toBe('completed');
      expect(resultsResponse.body.execution.results).toHaveLength(2);
      expect(resultsResponse.body.execution.results[1].output).toContain('Paris');
    }, 45000);

    it('should handle workflow with condition branching', async () => {
      const workflow = {
        name: 'Conditional Workflow',
        nodes: [
          {
            id: 'node-1',
            type: 'prompt',
            position: { x: 100, y: 100 },
            data: {
              label: 'Input',
              prompt: 'Rate this from 1-5: How good is this product?',
            },
          },
          {
            id: 'node-2',
            type: 'llm',
            position: { x: 300, y: 100 },
            data: {
              label: 'Analyze Rating',
              model: 'gpt-3.5-turbo',
              prompt: 'Extract a numeric rating from: {{input}}',
            },
          },
          {
            id: 'node-3',
            type: 'condition',
            position: { x: 500, y: 100 },
            data: {
              label: 'Rating Check',
              condition: 'response.rating >= 4',
              trueLabel: 'Good Rating',
              falseLabel: 'Poor Rating',
            },
          },
          {
            id: 'node-4',
            type: 'llm',
            position: { x: 700, y: 50 },
            data: {
              label: 'Positive Response',
              prompt: 'Generate a thank you message for a good rating.',
            },
          },
          {
            id: 'node-5',
            type: 'llm',
            position: { x: 700, y: 150 },
            data: {
              label: 'Improvement Response',
              prompt: 'Generate a message asking for improvement suggestions.',
            },
          },
        ],
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2' },
          { id: 'edge-2', source: 'node-2', target: 'node-3' },
          { id: 'edge-3', source: 'node-3', target: 'node-4', condition: true },
          { id: 'edge-4', source: 'node-3', target: 'node-5', condition: false },
        ],
      };

      // Save and execute workflow
      const saveResponse = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workflow)
        .expect(201);

      const workflowId = saveResponse.body.workflow.id;

      const executeResponse = await request(app)
        .post(`/api/workflows/${workflowId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send()
        .expect(200);

      const executionId = executeResponse.body.execution.id;

      await waitForExecution(executionId, 45000);

      const resultsResponse = await request(app)
        .get(`/api/executions/${executionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(resultsResponse.body.execution.status).toBe('completed');
      
      // Should have executed either the positive or negative branch
      const executedNodes = resultsResponse.body.execution.results.map((r: any) => r.nodeId);
      const hasPositiveBranch = executedNodes.includes('node-4');
      const hasNegativeBranch = executedNodes.includes('node-5');
      
      expect(hasPositiveBranch || hasNegativeBranch).toBe(true);
    }, 60000);

    it('should handle workflow with aggregation', async () => {
      const workflow = {
        name: 'Aggregation Workflow',
        nodes: [
          {
            id: 'node-1',
            type: 'prompt',
            position: { x: 100, y: 100 },
            data: {
              label: 'Main Input',
              prompt: 'Generate three different perspectives on climate change.',
            },
          },
          {
            id: 'node-2',
            type: 'llm',
            position: { x: 300, y: 50 },
            data: {
              label: 'Environmental Perspective',
              model: 'gpt-3.5-turbo',
              prompt: 'From an environmental scientist perspective: {{input}}',
            },
          },
          {
            id: 'node-3',
            type: 'llm',
            position: { x: 300, y: 150 },
            data: {
              label: 'Economic Perspective',
              model: 'gpt-3.5-turbo',
              prompt: 'From an economist perspective: {{input}}',
            },
          },
          {
            id: 'node-4',
            type: 'llm',
            position: { x: 300, y: 250 },
            data: {
              label: 'Social Perspective',
              model: 'gpt-3.5-turbo',
              prompt: 'From a sociologist perspective: {{input}}',
            },
          },
          {
            id: 'node-5',
            type: 'aggregation',
            position: { x: 500, y: 150 },
            data: {
              label: 'Synthesize Perspectives',
              strategy: 'combine',
              prompt: 'Combine these perspectives into a comprehensive summary: {{inputs}}',
            },
          },
        ],
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2' },
          { id: 'edge-2', source: 'node-1', target: 'node-3' },
          { id: 'edge-3', source: 'node-1', target: 'node-4' },
          { id: 'edge-4', source: 'node-2', target: 'node-5' },
          { id: 'edge-5', source: 'node-3', target: 'node-5' },
          { id: 'edge-6', source: 'node-4', target: 'node-5' },
        ],
      };

      const saveResponse = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workflow)
        .expect(201);

      const workflowId = saveResponse.body.workflow.id;

      const executeResponse = await request(app)
        .post(`/api/workflows/${workflowId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send()
        .expect(200);

      const executionId = executeResponse.body.execution.id;

      await waitForExecution(executionId, 60000);

      const resultsResponse = await request(app)
        .get(`/api/executions/${executionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(resultsResponse.body.execution.status).toBe('completed');
      
      // Should have executed all three parallel branches
      const executedNodes = resultsResponse.body.execution.results.map((r: any) => r.nodeId);
      expect(executedNodes).toContain('node-2');
      expect(executedNodes).toContain('node-3');
      expect(executedNodes).toContain('node-4');
      expect(executedNodes).toContain('node-5');
    }, 90000);
  });

  describe('Workflow Management', () => {
    it('should CRUD operations for workflows', async () => {
      const workflow = {
        name: 'Test Workflow',
        nodes: [
          {
            id: 'node-1',
            type: 'prompt',
            position: { x: 100, y: 100 },
            data: { label: 'Test Node', prompt: 'Test prompt' },
          },
        ],
        edges: [],
      };

      // Create workflow
      const createResponse = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workflow)
        .expect(201);

      const workflowId = createResponse.body.workflow.id;
      expect(createResponse.body.workflow.name).toBe('Test Workflow');

      // Get workflow
      const getResponse = await request(app)
        .get(`/api/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.workflow.name).toBe('Test Workflow');

      // Update workflow
      const updatedWorkflow = {
        ...workflow,
        name: 'Updated Test Workflow',
        nodes: [
          ...workflow.nodes,
          {
            id: 'node-2',
            type: 'llm',
            position: { x: 300, y: 100 },
            data: { label: 'LLM Node', model: 'gpt-3.5-turbo' },
          },
        ],
      };

      await request(app)
        .put(`/api/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedWorkflow)
        .expect(200);

      // List workflows
      const listResponse = await request(app)
        .get('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listResponse.body.workflows).toHaveLength(1);
      expect(listResponse.body.workflows[0].name).toBe('Updated Test Workflow');

      // Delete workflow
      await request(app)
        .delete(`/api/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify deletion
      await request(app)
        .get(`/api/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should handle workflow versions', async () => {
      const workflow = {
        name: 'Versioned Workflow',
        nodes: [
          {
            id: 'node-1',
            type: 'prompt',
            position: { x: 100, y: 100 },
            data: { label: 'Node 1', prompt: 'Version 1' },
          },
        ],
        edges: [],
      };

      // Create initial version
      const createResponse = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workflow)
        .expect(201);

      const workflowId = createResponse.body.workflow.id;

      // Create new version
      const v2Workflow = {
        ...workflow,
        nodes: [
          {
            id: 'node-1',
            type: 'prompt',
            position: { x: 100, y: 100 },
            data: { label: 'Node 1', prompt: 'Version 2' },
          },
        ],
      };

      const v2Response = await request(app)
        .post(`/api/workflows/${workflowId}/versions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(v2Workflow)
        .expect(201);

      expect(v2Response.body.version.version).toBe(2);

      // Get version history
      const historyResponse = await request(app)
        .get(`/api/workflows/${workflowId}/versions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(historyResponse.body.versions).toHaveLength(2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid workflow structures', async () => {
      const invalidWorkflow = {
        name: 'Invalid Workflow',
        nodes: [], // Empty nodes
        edges: [
          {
            id: 'edge-1',
            source: 'non-existent-node',
            target: 'another-non-existent-node',
          },
        ],
      };

      await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidWorkflow)
        .expect(400);
    });

    it('should handle circular dependencies', async () => {
      const circularWorkflow = {
        name: 'Circular Workflow',
        nodes: [
          {
            id: 'node-1',
            type: 'prompt',
            position: { x: 100, y: 100 },
            data: { label: 'Node 1', prompt: 'Test' },
          },
          {
            id: 'node-2',
            type: 'llm',
            position: { x: 300, y: 100 },
            data: { label: 'Node 2', model: 'gpt-3.5-turbo' },
          },
        ],
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2' },
          { id: 'edge-2', source: 'node-2', target: 'node-1' }, // Circular dependency
        ],
      };

      const saveResponse = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(circularWorkflow)
        .expect(201);

      const workflowId = saveResponse.body.workflow.id;

      const executeResponse = await request(app)
        .post(`/api/workflows/${workflowId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send()
        .expect(400);

      expect(executeResponse.body.error).toContain('circular dependency');
    });

    it('should handle execution timeouts', async () => {
      const slowWorkflow = {
        name: 'Slow Workflow',
        nodes: [
          {
            id: 'node-1',
            type: 'prompt',
            position: { x: 100, y: 100 },
            data: { label: 'Slow Node', prompt: 'This will take a long time...' },
          },
          {
            id: 'node-2',
            type: 'llm',
            position: { x: 300, y: 100 },
            data: {
              label: 'Slow LLM',
              model: 'gpt-3.5-turbo',
              maxTokens: 4000, // Large token count
              timeout: 1000, // 1 second timeout
            },
          },
        ],
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2' },
        ],
      };

      const saveResponse = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(slowWorkflow)
        .expect(201);

      const workflowId = saveResponse.body.workflow.id;

      const executeResponse = await request(app)
        .post(`/api/workflows/${workflowId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send()
        .expect(200);

      const executionId = executeResponse.body.execution.id;

      await waitForExecution(executionId, 10000);

      const resultsResponse = await request(app)
        .get(`/api/executions/${executionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(resultsResponse.body.execution.status).toBe('failed');
      expect(resultsResponse.body.execution.error).toContain('timeout');
    }, 15000);

    it('should handle concurrent workflow executions', async () => {
      const workflow = {
        name: 'Concurrent Test Workflow',
        nodes: [
          {
            id: 'node-1',
            type: 'prompt',
            position: { x: 100, y: 100 },
            data: { label: 'Input', prompt: 'Test input' },
          },
          {
            id: 'node-2',
            type: 'llm',
            position: { x: 300, y: 100 },
            data: { label: 'Process', model: 'gpt-3.5-turbo' },
          },
        ],
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2' },
        ],
      };

      const saveResponse = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workflow)
        .expect(201);

      const workflowId = saveResponse.body.workflow.id;

      // Start multiple concurrent executions
      const executionPromises = Array.from({ length: 5 }, () =>
        request(app)
          .post(`/api/workflows/${workflowId}/execute`)
          .set('Authorization', `Bearer ${authToken}`)
          .send()
      );

      const executionResponses = await Promise.all(executionPromises);
      
      // All should be accepted
      executionResponses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.execution.id).toBeDefined();
      });

      // Wait for all to complete
      const executionIds = executionResponses.map(r => r.body.execution.id);
      await Promise.all(
        executionIds.map(id => waitForExecution(id, 60000))
      );
    }, 120000);
  });

  describe('WebSocket Integration', () => {
    it('should provide real-time execution updates via WebSocket', async () => {
      const workflow = {
        name: 'WebSocket Test Workflow',
        nodes: [
          {
            id: 'node-1',
            type: 'prompt',
            position: { x: 100, y: 100 },
            data: { label: 'Test Node', prompt: 'WebSocket test' },
          },
        ],
        edges: [],
      };

      const saveResponse = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workflow)
        .expect(201);

      const workflowId = saveResponse.body.workflow.id;

      // Mock WebSocket message handling
      const messages: any[] = [];
      const mockWebSocket = {
        on: jest.fn((event, callback) => {
          if (event === 'message') {
            messages.push = callback;
          }
        }),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 1,
      };

      (WS as jest.Mock).mockImplementation(() => mockWebSocket);

      const executeResponse = await request(app)
        .post(`/api/workflows/${workflowId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send()
        .expect(200);

      const executionId = executeResponse.body.execution.id;

      // Should receive WebSocket updates
      await waitForExecution(executionId, 30000);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('execution_started')
      );
    }, 45000);
  });

  async function waitForExecution(executionId: string, timeout: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const response = await request(app)
        .get(`/api/executions/${executionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const status = response.body.execution.status;
      if (['completed', 'failed', 'cancelled'].includes(status)) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Execution ${executionId} did not complete within ${timeout}ms`);
  }
});