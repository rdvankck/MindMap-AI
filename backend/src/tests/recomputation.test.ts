import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { app } from '@/index';
import { PrismaClient, PlanStatus, PlanPriority } from '@prisma/client';
import { dependencyGraphEngine } from '@/services/dependencyGraphEngine';
import { recomputationEngine } from '@/services/recomputationEngine';
import { smartCacheManager } from '@/services/smartCacheManager';

const prisma = new PrismaClient();

describe('Re-computation System', () => {
  let testUser: any;
  let testWorkflow: any;
  let authToken: string;

  beforeEach(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedpassword'
      }
    });

    // Create test workflow
    testWorkflow = await prisma.workflow.create({
      data: {
        userId: testUser.id,
        name: 'Test Workflow',
        description: 'A test workflow for re-computation testing',
        nodes: [
          {
            id: 'node-1',
            type: 'input',
            data: { value: 'test input' },
            position: { x: 0, y: 0 }
          },
          {
            id: 'node-2',
            type: 'llm',
            data: { prompt: 'Test prompt' },
            position: { x: 100, y: 0 }
          },
          {
            id: 'node-3',
            type: 'output',
            data: {},
            position: { x: 200, y: 0 }
          }
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'node-2'
          },
          {
            id: 'edge-2',
            source: 'node-2',
            target: 'node-3'
          }
        ]
      }
    });

    // Generate auth token (mock)
    authToken = 'mock-jwt-token';
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.recomputationPlan.deleteMany({
      where: { workflowId: testWorkflow.id }
    });
    
    await prisma.dependencyInvalidation.deleteMany({
      where: { workflowId: testWorkflow.id }
    });

    await prisma.workflow.delete({
      where: { id: testWorkflow.id }
    });

    await prisma.user.delete({
      where: { id: testUser.id }
    });
  });

  describe('POST /api/recomputation/plans', () => {
    it('should create a re-computation plan successfully', async () => {
      // First create an invalidation event
      const invalidationEvent = await dependencyGraphEngine.invalidateDependents(
        testWorkflow.id,
        'node-2',
        'content',
        'Test re-computation'
      );

      const dbInvalidation = await prisma.dependencyInvalidation.create({
        data: {
          workflowId: invalidationEvent.workflowId,
          nodeId: invalidationEvent.nodeId,
          changeType: invalidationEvent.changeType as any,
          reason: invalidationEvent.reason,
          affectedNodes: invalidationEvent.affectedNodes,
          cascadeNodes: invalidationEvent.cascadeNodes,
          metadata: invalidationEvent.metadata
        }
      });

      const response = await request(app)
        .post('/api/recomputation/plans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          workflowId: testWorkflow.id,
          invalidationEventId: dbInvalidation.id,
          priority: 'HIGH',
          enableParallelExecution: true
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toBeDefined();
      expect(response.body.data.plan.status).toBe('PENDING');
      expect(response.body.data.plan.priority).toBe('HIGH');
    });

    it('should fail with invalid workflow ID', async () => {
      const response = await request(app)
        .post('/api/recomputation/plans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          workflowId: 'invalid-uuid',
          nodeId: 'node-1',
          reason: 'Test'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/recomputation/plans')
        .send({
          workflowId: testWorkflow.id,
          nodeId: 'node-1',
          reason: 'Test'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('GET /api/recomputation/plans', () => {
    beforeEach(async () => {
      // Create test plans
      await prisma.recomputationPlan.createMany({
        data: [
          {
            workflowId: testWorkflow.id,
            rootCauseNodeId: 'node-1',
            invalidationEventId: 'test-event-1',
            executionOrder: ['node-1', 'node-2', 'node-3'],
            parallelGroups: [['node-1'], ['node-2'], ['node-3']],
            estimatedCost: { nodes: 3, tokens: 1000, timeMs: 5000 },
            priority: PlanPriority.HIGH,
            status: PlanStatus.PENDING
          },
          {
            workflowId: testWorkflow.id,
            rootCauseNodeId: 'node-2',
            invalidationEventId: 'test-event-2',
            executionOrder: ['node-2', 'node-3'],
            parallelGroups: [['node-2'], ['node-3']],
            estimatedCost: { nodes: 2, tokens: 800, timeMs: 3000 },
            priority: PlanPriority.MEDIUM,
            status: PlanStatus.COMPLETED
          }
        ]
      });
    });

    it('should get re-computation plans with pagination', async () => {
      const response = await request(app)
        .get('/api/recomputation/plans')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          page: 1,
          limit: 10,
          status: 'PENDING'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.plans).toHaveLength(1);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter plans by priority', async () => {
      const response = await request(app)
        .get('/api/recomputation/plans')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          priority: 'HIGH'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.plans.length).toBeGreaterThan(0);
      response.body.data.plans.forEach((plan: any) => {
        expect(plan.priority).toBe('HIGH');
      });
    });
  });

  describe('POST /api/recomputation/plans/batch', () => {
    it('should create batch re-computation plans', async () => {
      const response = await request(app)
        .post('/api/recomputation/plans/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          workflowId: testWorkflow.id,
          nodeIds: ['node-1', 'node-2'],
          reason: 'Batch test',
          priority: 'MEDIUM'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.successfulPlans).toBe(2);
      expect(response.body.data.results).toHaveLength(2);
    });

    it('should fail with too many node IDs', async () => {
      const nodeIds = Array.from({ length: 51 }, (_, i) => `node-${i}`);
      
      const response = await request(app)
        .post('/api/recomputation/plans/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          workflowId: testWorkflow.id,
          nodeIds,
          reason: 'Batch test'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('Plan Control Operations', () => {
    let testPlan: any;

    beforeEach(async () => {
      testPlan = await prisma.recomputationPlan.create({
        data: {
          workflowId: testWorkflow.id,
          rootCauseNodeId: 'node-1',
          invalidationEventId: 'test-event',
          executionOrder: ['node-1', 'node-2'],
          parallelGroups: [['node-1'], ['node-2']],
          estimatedCost: { nodes: 2, tokens: 500, timeMs: 2000 },
          priority: PlanPriority.MEDIUM,
          status: PlanStatus.RUNNING,
          startedAt: new Date()
        }
      });
    });

    it('should pause a running plan', async () => {
      const response = await request(app)
        .post(`/api/recomputation/plans/${testPlan.id}/pause`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('paused successfully');
    });

    it('should resume a paused plan', async () => {
      // First pause the plan
      await prisma.recomputationPlan.update({
        where: { id: testPlan.id },
        data: { status: PlanStatus.PAUSED }
      });

      const response = await request(app)
        .post(`/api/recomputation/plans/${testPlan.id}/resume`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('resumed successfully');
    });

    it('should cancel a running plan', async () => {
      const response = await request(app)
        .post(`/api/recomputation/plans/${testPlan.id}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cancelled successfully');
    });

    it('should retry a failed plan', async () => {
      // First mark plan as failed
      await prisma.recomputationPlan.update({
        where: { id: testPlan.id },
        data: { 
          status: PlanStatus.FAILED,
          completedAt: new Date(),
          errorMessage: 'Test error'
        }
      });

      const response = await request(app)
        .post(`/api/recomputation/plans/${testPlan.id}/retry`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('queued for retry');
    });
  });

  describe('GET /api/recomputation/plans/:planId', () => {
    let testPlan: any;

    beforeEach(async () => {
      testPlan = await prisma.recomputationPlan.create({
        data: {
          workflowId: testWorkflow.id,
          rootCauseNodeId: 'node-1',
          invalidationEventId: 'test-event',
          executionOrder: ['node-1', 'node-2'],
          parallelGroups: [['node-1'], ['node-2']],
          estimatedCost: { nodes: 2, tokens: 500, timeMs: 2000 },
          priority: PlanPriority.MEDIUM,
          status: PlanStatus.COMPLETED,
          startedAt: new Date(),
          completedAt: new Date()
        }
      });
    });

    it('should get plan details', async () => {
      const response = await request(app)
        .get(`/api/recomputation/plans/${testPlan.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.plan.id).toBe(testPlan.id);
      expect(response.body.data.statistics).toBeDefined();
    });

    it('should return 404 for non-existent plan', async () => {
      const response = await request(app)
        .get('/api/recomputation/plans/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Re-computation plan not found');
    });
  });

  describe('Cache Management', () => {
    it('should store and retrieve cached values', async () => {
      const keyData = {
        workflowId: testWorkflow.id,
        nodeId: 'node-1',
        inputs: { test: 'value' },
        config: { setting: 'test' },
        version: '1.0'
      };

      const testValue = { result: 'cached data', timestamp: Date.now() };

      // Store value
      const setSuccess = await smartCacheManager.set(keyData, testValue, {
        ttl: 3600,
        tags: ['test']
      });

      expect(setSuccess).toBe(true);

      // Retrieve value
      const retrievedValue = await smartCacheManager.get(keyData);

      expect(retrievedValue).toEqual(testValue);
    });

    it('should return null for non-existent cache entries', async () => {
      const keyData = {
        workflowId: testWorkflow.id,
        nodeId: 'node-non-existent',
        inputs: { test: 'value' },
        config: { setting: 'test' },
        version: '1.0'
      };

      const retrievedValue = await smartCacheManager.get(keyData);
      expect(retrievedValue).toBeNull();
    });

    it('should invalidate cache entries', async () => {
      const keyData = {
        workflowId: testWorkflow.id,
        nodeId: 'node-1',
        inputs: { test: 'value' },
        config: { setting: 'test' },
        version: '1.0'
      };

      const testValue = { result: 'cached data' };

      // Store value
      await smartCacheManager.set(keyData, testValue);

      // Invalidate cache for workflow
      const invalidatedCount = await smartCacheManager.invalidate({
        workflowId: testWorkflow.id
      });

      expect(invalidatedCount).toBeGreaterThan(0);

      // Try to retrieve value - should be null
      const retrievedValue = await smartCacheManager.get(keyData);
      expect(retrievedValue).toBeNull();
    });
  });

  describe('Queue Statistics', () => {
    it('should get queue statistics', async () => {
      const stats = await recomputationEngine.getQueueStatistics();

      expect(stats).toBeDefined();
      expect(typeof stats.active).toBe('number');
      expect(typeof stats.waiting).toBe('number');
      expect(typeof stats.completed).toBe('number');
      expect(typeof stats.failed).toBe('number');
    });

    it('should get queue statistics via API', async () => {
      const response = await request(app)
        .get('/api/recomputation/plans/queue/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.queue).toBeDefined();
    });
  });

  describe('Cache Statistics', () => {
    it('should get cache statistics', async () => {
      const stats = await smartCacheManager.getStatistics();

      expect(stats).toBeDefined();
      expect(typeof stats.hitRate).toBe('number');
      expect(typeof stats.totalHits).toBe('number');
      expect(typeof stats.totalMisses).toBe('number');
      expect(typeof stats.cacheSize).toBe('number');
    });

    it('should perform cache optimization', async () => {
      const result = await smartCacheManager.optimize();

      expect(result).toBeDefined();
      expect(result.before).toBeDefined();
      expect(result.after).toBeDefined();
      expect(Array.isArray(result.improvements)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('Dependency Graph Integration', () => {
    it('should build dependency graph for workflow', async () => {
      const graph = await dependencyGraphEngine.buildDependencyGraph(testWorkflow.id);

      expect(graph).toBeDefined();
      expect(graph.workflowId).toBe(testWorkflow.id);
      expect(graph.nodes.size).toBe(3); // 3 nodes in test workflow
      expect(graph.edges.size).toBeGreaterThan(0);
      expect(Array.isArray(graph.topologicalOrder)).toBe(true);
    });

    it('should detect node changes', async () => {
      const currentNodeData = {
        id: 'node-2',
        type: 'llm',
        data: { prompt: 'Updated prompt' },
        config: { temperature: 0.7 }
      };

      const previousNodeData = {
        id: 'node-2',
        type: 'llm',
        data: { prompt: 'Original prompt' },
        config: { temperature: 0.5 }
      };

      const changeDetection = await dependencyGraphEngine.detectNodeChanges(
        testWorkflow.id,
        'node-2',
        currentNodeData,
        previousNodeData
      );

      expect(changeDetection.hasChanges).toBe(true);
      expect(changeDetection.changeType).toBeDefined();
      expect(Array.isArray(changeDetection.changedFields)).toBe(true);
    });

    it('should invalidate dependents correctly', async () => {
      const invalidation = await dependencyGraphEngine.invalidateDependents(
        testWorkflow.id,
        'node-1',
        'content',
        'Test invalidation'
      );

      expect(invalidation).toBeDefined();
      expect(invalidation.workflowId).toBe(testWorkflow.id);
      expect(invalidation.nodeId).toBe('node-1');
      expect(invalidation.changeType).toBe('content');
      expect(Array.isArray(invalidation.affectedNodes)).toBe(true);
      expect(Array.isArray(invalidation.cascadeNodes)).toBe(true);
    });
  });
});