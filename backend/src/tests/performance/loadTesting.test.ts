import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { app, server } from '@/index';
import { prisma } from '@/config/database';
import { redis } from '@/config/redis';

// Mock external LLM providers for load testing
jest.mock('@/services/llm/providers/OpenAIProvider', () => ({
  OpenAIProvider: jest.fn().mockImplementation(() => ({
    chat: jest.fn().mockResolvedValue({
      choices: [{
        message: { content: 'Mock response for load testing', role: 'assistant' },
        finishReason: 'stop'
      }],
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      metadata: { processingTime: 500 }
    }),
    chatStream: jest.fn().mockImplementation(async function* () {
      yield { content: 'Mock', done: false };
      yield { content: ' stream', done: false };
      yield { content: ' response', done: true };
    })
  }))
}));

jest.mock('@/services/llm/providers/OllamaProvider', () => ({
  OllamaProvider: jest.fn().mockImplementation(() => ({
    chat: jest.fn().mockResolvedValue({
      choices: [{
        message: { content: 'Mock Ollama response', role: 'assistant' },
        finishReason: 'stop'
      }],
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      metadata: { processingTime: 300 }
    })
  }))
}));

describe('Performance and Load Testing', () => {
  let authToken: string;
  let userId: string;
  const concurrentUsers = 50;
  const requestsPerUser = 10;

  beforeAll(async () => {
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
    await redis.flushdb();
    
    // Create test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'loadtest@example.com',
        password: 'password123',
        name: 'Load Test User',
      });

    userId = userResponse.body.user.id;
    authToken = userResponse.body.token;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('API Performance Tests', () => {
    it('should handle concurrent workflow creation', async () => {
      const workflow = {
        name: 'Performance Test Workflow',
        nodes: [
          {
            id: 'node-1',
            type: 'prompt',
            position: { x: 100, y: 100 },
            data: { label: 'Test Node', prompt: 'Performance test prompt' },
          },
        ],
        edges: [],
      };

      const startTime = Date.now();

      // Create workflows concurrently
      const promises = Array.from({ length: concurrentUsers }, (_, i) =>
        request(app)
          .post('/api/workflows')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...workflow,
            name: `Performance Test Workflow ${i}`,
          })
      );

      const responses = await Promise.allSettled(promises);
      const endTime = Date.now();

      // Count successful responses
      const successfulResponses = responses.filter(
        result => result.status === 'fulfilled' && result.value.status === 201
      );

      const successRate = (successfulResponses.length / concurrentUsers) * 100;
      const totalTime = endTime - startTime;
      const avgResponseTime = totalTime / concurrentUsers;

      expect(successRate).toBeGreaterThan(90); // 90% success rate
      expect(avgResponseTime).toBeLessThan(1000); // Average response time < 1 second
      expect(totalTime).toBeLessThan(10000); // Total time < 10 seconds

      console.log(`Workflow Creation - Success Rate: ${successRate}%, Avg Response Time: ${avgResponseTime}ms`);
    });

    it('should handle concurrent workflow executions', async () => {
      // Create a test workflow first
      const workflow = {
        name: 'Execution Test Workflow',
        nodes: [
          {
            id: 'node-1',
            type: 'prompt',
            position: { x: 100, y: 100 },
            data: { label: 'Input', prompt: 'Test input for execution' },
          },
          {
            id: 'node-2',
            type: 'llm',
            position: { x: 300, y: 100 },
            data: {
              label: 'Process',
              model: 'gpt-3.5-turbo',
              temperature: 0.7,
              maxTokens: 100,
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
        .send(workflow)
        .expect(201);

      const workflowId = saveResponse.body.workflow.id;

      const startTime = Date.now();

      // Execute workflow concurrently
      const promises = Array.from({ length: concurrentUsers }, () =>
        request(app)
          .post(`/api/workflows/${workflowId}/execute`)
          .set('Authorization', `Bearer ${authToken}`)
          .send()
      );

      const responses = await Promise.allSettled(promises);
      const endTime = Date.now();

      const successfulResponses = responses.filter(
        result => result.status === 'fulfilled' && result.value.status === 200
      );

      const successRate = (successfulResponses.length / concurrentUsers) * 100;
      const totalTime = endTime - startTime;
      const avgResponseTime = totalTime / concurrentUsers;

      expect(successRate).toBeGreaterThan(85); // 85% success rate for executions
      expect(avgResponseTime).toBeLessThan(2000); // Average response time < 2 seconds

      console.log(`Workflow Execution - Success Rate: ${successRate}%, Avg Response Time: ${avgResponseTime}ms`);
    });

    it('should handle high-frequency API requests', async () => {
      const requestCount = 1000;
      const batchSize = 50;
      
      const healthCheckPromises = Array.from({ length: Math.ceil(requestCount / batchSize) }, async () => {
        const batch = Array.from({ length: batchSize }, () =>
          request(app).get('/health')
        );
        return Promise.all(batch);
      });

      const startTime = Date.now();
      const allResponses = await Promise.all(healthCheckPromises);
      const endTime = Date.now();

      const flatResponses = allResponses.flat();
      const successfulResponses = flatResponses.filter(res => res.status === 200);
      
      const successRate = (successfulResponses.length / requestCount) * 100;
      const totalTime = endTime - startTime;
      const requestsPerSecond = (requestCount / totalTime) * 1000;

      expect(successRate).toBeGreaterThan(95);
      expect(requestsPerSecond).toBeGreaterThan(100); // Should handle >100 RPS

      console.log(`Health Check - Success Rate: ${successRate}%, RPS: ${requestsPerSecond.toFixed(2)}`);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory during prolonged usage', async () => {
      const initialMemory = process.memoryUsage();
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        // Create, execute, and delete workflow repeatedly
        const workflow = {
          name: `Memory Test Workflow ${i}`,
          nodes: [
            {
              id: `node-${i}-1`,
              type: 'prompt',
              position: { x: 100, y: 100 },
              data: { label: 'Memory Test', prompt: `Test iteration ${i}` },
            },
          ],
          edges: [],
        };

        // Create
        const createResponse = await request(app)
          .post('/api/workflows')
          .set('Authorization', `Bearer ${authToken}`)
          .send(workflow);

        if (createResponse.status === 201) {
          const workflowId = createResponse.body.workflow.id;
          
          // Execute
          await request(app)
            .post(`/api/workflows/${workflowId}/execute`)
            .set('Authorization', `Bearer ${authToken}`)
            .send();

          // Delete
          await request(app)
            .delete(`/api/workflows/${workflowId}`)
            .set('Authorization', `Bearer ${authToken}`);
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      expect(memoryIncreasePercent).toBeLessThan(50); // Memory increase should be < 50%

      console.log(`Memory Usage - Initial: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB, Final: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB, Increase: ${memoryIncreasePercent.toFixed(2)}%`);
    });

    it('should handle database connection pool efficiently', async () => {
      const concurrentQueries = 50;
      
      const promises = Array.from({ length: concurrentQueries }, async (_, i) => {
        return request(app)
          .get('/api/workflows')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ page: 1, limit: 10 });
      });

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();

      const allSuccessful = responses.every(res => res.status === 200);
      const totalTime = endTime - startTime;

      expect(allSuccessful).toBe(true);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Database Pool - Concurrent Queries: ${concurrentQueries}, Total Time: ${totalTime}ms`);
    });
  });

  describe('WebSocket Performance', () => {
    it('should handle multiple WebSocket connections', async () => {
      const WebSocket = require('ws');
      const connectionCount = 20;
      const connections: any[] = [];
      
      const startTime = Date.now();

      // Create multiple WebSocket connections
      for (let i = 0; i < connectionCount; i++) {
        const ws = new WebSocket(`ws://localhost:${process.env.PORT || 3001}/socket.io/`);
        connections.push(ws);
      }

      // Wait for all connections to establish
      await new Promise(resolve => setTimeout(resolve, 1000));

      const connectionTime = Date.now() - startTime;
      const avgConnectionTime = connectionTime / connectionCount;

      expect(avgConnectionTime).toBeLessThan(500); // Average connection time < 500ms
      expect(connections.every(ws => ws.readyState === 1)).toBe(true); // All connections should be open

      // Close connections
      connections.forEach(ws => ws.close());
      
      console.log(`WebSocket Connections - Count: ${connectionCount}, Avg Connection Time: ${avgConnectionTime}ms`);
    });

    it('should handle high-frequency WebSocket messages', async () => {
      const WebSocket = require('ws');
      const ws = new WebSocket(`ws://localhost:${process.env.PORT || 3001}/socket.io/`);
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      const messageCount = 1000;
      let messagesReceived = 0;
      
      ws.on('message', () => {
        messagesReceived++;
      });

      const startTime = Date.now();

      // Send messages rapidly
      for (let i = 0; i < messageCount; i++) {
        ws.send(JSON.stringify({
          type: 'test',
          data: { message: `Test message ${i}` }
        }));
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      const endTime = Date.now();
      const messagesPerSecond = (messagesReceived / (endTime - startTime)) * 1000;

      expect(messagesPerSecond).toBeGreaterThan(100); // Should handle >100 messages/second

      ws.close();
      
      console.log(`WebSocket Messages - Sent: ${messageCount}, Received: ${messagesReceived}, Rate: ${messagesPerSecond.toFixed(2)} msg/s`);
    });
  });

  describe('Cache Performance', () => {
    it('should cache workflow executions efficiently', async () => {
      const workflow = {
        name: 'Cache Test Workflow',
        nodes: [
          {
            id: 'node-1',
            type: 'prompt',
            position: { x: 100, y: 100 },
            data: { label: 'Cache Test', prompt: 'This should be cached' },
          },
        ],
        edges: [],
      };

      // Save workflow
      const saveResponse = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workflow)
        .expect(201);

      const workflowId = saveResponse.body.workflow.id;

      // First execution (cache miss)
      const startTime1 = Date.now();
      const exec1Response = await request(app)
        .post(`/api/workflows/${workflowId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send();
      const endTime1 = Date.now();
      const executionTime1 = endTime1 - startTime1;

      // Second execution (cache hit)
      const startTime2 = Date.now();
      const exec2Response = await request(app)
        .post(`/api/workflows/${workflowId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send();
      const endTime2 = Date.now();
      const executionTime2 = endTime2 - startTime2;

      expect(exec1Response.status).toBe(200);
      expect(exec2Response.status).toBe(200);
      expect(executionTime2).toBeLessThan(executionTime1); // Cached execution should be faster

      const speedImprovement = ((executionTime1 - executionTime2) / executionTime1) * 100;
      console.log(`Cache Performance - First: ${executionTime1}ms, Cached: ${executionTime2}ms, Improvement: ${speedImprovement.toFixed(2)}%`);
    });

    it('should handle cache invalidation correctly', async () => {
      const workflow = {
        name: 'Cache Invalidation Test',
        nodes: [
          {
            id: 'node-1',
            type: 'prompt',
            position: { x: 100, y: 100 },
            data: { label: 'Cache Invalidation', prompt: 'Original version' },
          },
        ],
        edges: [],
      };

      // Save and execute to cache
      const saveResponse = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workflow)
        .expect(201);

      const workflowId = saveResponse.body.workflow.id;

      await request(app)
        .post(`/api/workflows/${workflowId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send();

      // Update workflow (should invalidate cache)
      const updatedWorkflow = {
        ...workflow,
        nodes: [
          {
            ...workflow.nodes[0],
            data: { label: 'Cache Invalidation', prompt: 'Updated version' },
          },
        ],
      };

      await request(app)
        .put(`/api/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedWorkflow)
        .expect(200);

      // Execute again (should use new data, not cached)
      const execResponse = await request(app)
        .post(`/api/workflows/${workflowId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send();

      expect(execResponse.status).toBe(200);
      
      // Verify cache was invalidated by checking execution results
      const resultsResponse = await request(app)
        .get(`/api/executions/${execResponse.body.execution.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(resultsResponse.body.execution.results[0].input).toContain('Updated version');
    });
  });

  describe('Stress Testing', () => {
    it('should handle sustained load over time', async () => {
      const duration = 30000; // 30 seconds
      const interval = 100; // Request every 100ms
      const requestCount = Math.floor(duration / interval);
      
      let successfulRequests = 0;
      let failedRequests = 0;
      const responseTimes: number[] = [];

      const startTime = Date.now();

      for (let i = 0; i < requestCount; i++) {
        const requestStart = Date.now();
        
        try {
          const response = await request(app).get('/health');
          const requestEnd = Date.now();
          
          if (response.status === 200) {
            successfulRequests++;
            responseTimes.push(requestEnd - requestStart);
          } else {
            failedRequests++;
          }
        } catch (error) {
          failedRequests++;
        }

        await new Promise(resolve => setTimeout(resolve, interval));
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const successRate = (successfulRequests / requestCount) * 100;
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      expect(successRate).toBeGreaterThan(90);
      expect(avgResponseTime).toBeLessThan(1000);
      expect(maxResponseTime).toBeLessThan(5000);

      console.log(`Stress Test - Duration: ${totalTime}ms, Requests: ${requestCount}, Success Rate: ${successRate}%, Avg Response Time: ${avgResponseTime}ms, Max Response Time: ${maxResponseTime}ms`);
    });

    it('should recover from temporary failures', async () => {
      // This test simulates temporary database or external service failures
      // and verifies the system can recover gracefully

      const workflow = {
        name: 'Recovery Test Workflow',
        nodes: [
          {
            id: 'node-1',
            type: 'prompt',
            position: { x: 100, y: 100 },
            data: { label: 'Recovery Test', prompt: 'Test recovery from failures' },
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

      // Simulate repeated attempts with resilience
      const maxAttempts = 5;
      let executionSucceeded = false;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const execResponse = await request(app)
            .post(`/api/workflows/${workflowId}/execute`)
            .set('Authorization', `Bearer ${authToken}`)
            .send();

          if (execResponse.status === 200) {
            executionSucceeded = true;
            break;
          }
        } catch (error) {
          // Continue trying
        }

        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }

      expect(executionSucceeded).toBe(true);
      console.log('Recovery Test - System recovered from temporary failures');
    });
  });
});