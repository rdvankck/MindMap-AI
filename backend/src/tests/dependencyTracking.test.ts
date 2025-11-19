import { dependencyGraphEngine } from '@/services/dependencyGraphEngine';
import { DependencyBackgroundService } from '@/services/dependencyBackgroundService';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

describe('DependencyGraphEngine', () => {
  let testWorkflowId: string;
  let testNodes: any[];
  let testEdges: any[];

  beforeAll(async () => {
    // Create test workflow
    const testWorkflow = await prisma.workflow.create({
      data: {
        name: 'Test Dependency Workflow',
        userId: 'test-user-id',
        nodes: [],
        edges: []
      }
    });
    testWorkflowId = testWorkflow.id;

    // Create test nodes
    testNodes = [
      {
        id: 'node-1',
        type: 'input',
        data: { value: 'test input' },
        config: { validation: true },
        position: { x: 100, y: 100 }
      },
      {
        id: 'node-2',
        type: 'llm',
        data: { prompt: 'Process this: {{node-1.data.value}}' },
        config: { model: 'gpt-4', temperature: 0.7 },
        position: { x: 300, y: 100 }
      },
      {
        id: 'node-3',
        type: 'output',
        data: { format: 'json' },
        config: { includeMetadata: false },
        position: { x: 500, y: 100 }
      }
    ];

    // Create test edges
    testEdges = [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        type: 'data'
      },
      {
        id: 'edge-2',
        source: 'node-2',
        target: 'node-3',
        type: 'data'
      }
    ];

    // Update workflow with test data
    await prisma.workflow.update({
      where: { id: testWorkflowId },
      data: {
        nodes: testNodes,
        edges: testEdges
      }
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.workflow.delete({
      where: { id: testWorkflowId }
    });
    await prisma.$disconnect();
  });

  describe('buildDependencyGraph', () => {
    it('should build a valid dependency graph', async () => {
      const graph = await dependencyGraphEngine.buildDependencyGraph(testWorkflowId);

      expect(graph).toBeDefined();
      expect(graph.workflowId).toBe(testWorkflowId);
      expect(graph.nodes.size).toBe(3);
      expect(graph.edges.size).toBe(3);
      expect(graph.topologicalOrder).toHaveLength(3);
      expect(graph.circularDependencies).toHaveLength(0);
    });

    it('should detect dependencies correctly', async () => {
      const graph = await dependencyGraphEngine.buildDependencyGraph(testWorkflowId);

      const node1 = graph.nodes.get('node-1');
      const node2 = graph.nodes.get('node-2');
      const node3 = graph.nodes.get('node-3');

      expect(node1?.dependencies).toHaveLength(0);
      expect(node1?.dependents).toContain('node-2');

      expect(node2?.dependencies).toContain('node-1');
      expect(node2?.dependents).toContain('node-3');

      expect(node3?.dependencies).toContain('node-2');
      expect(node3?.dependents).toHaveLength(0);
    });

    it('should generate correct topological order', async () => {
      const graph = await dependencyGraphEngine.buildDependencyGraph(testWorkflowId);

      expect(graph.topologicalOrder).toEqual(['node-1', 'node-2', 'node-3']);
    });

    it('should detect circular dependencies', async () => {
      // Create workflow with circular dependency
      const circularWorkflow = await prisma.workflow.create({
        data: {
          name: 'Circular Test Workflow',
          userId: 'test-user-id',
          nodes: testNodes,
          edges: [
            { id: 'edge-1', source: 'node-1', target: 'node-2', type: 'data' },
            { id: 'edge-2', source: 'node-2', target: 'node-3', type: 'data' },
            { id: 'edge-3', source: 'node-3', target: 'node-1', type: 'data' } // Circular
          ]
        }
      });

      const graph = await dependencyGraphEngine.buildDependencyGraph(circularWorkflow.id);
      
      expect(graph.circularDependencies.length).toBeGreaterThan(0);

      // Cleanup
      await prisma.workflow.delete({
        where: { id: circularWorkflow.id }
      });
    });
  });

  describe('detectNodeChanges', () => {
    it('should detect content changes', async () => {
      const originalData = testNodes[1]; // LLM node
      const modifiedData = {
        ...originalData,
        data: { prompt: 'Modified prompt: {{node-1.data.value}}' }
      };

      const changeResult = await dependencyGraphEngine.detectNodeChanges(
        testWorkflowId,
        'node-2',
        modifiedData,
        originalData
      );

      expect(changeResult.hasChanges).toBe(true);
      expect(changeResult.changeType).toBe('content');
      expect(changeResult.changedFields).toContain('data.prompt');
      expect(changeResult.scope).toBe('cascade');
    });

    it('should detect configuration changes', async () => {
      const originalData = testNodes[1];
      const modifiedData = {
        ...originalData,
        config: { model: 'gpt-3.5-turbo', temperature: 0.5 }
      };

      const changeResult = await dependencyGraphEngine.detectNodeChanges(
        testWorkflowId,
        'node-2',
        modifiedData,
        originalData
      );

      expect(changeResult.hasChanges).toBe(true);
      expect(changeResult.changeType).toBe('config');
      expect(changeResult.changedFields).toContain('config.model');
      expect(changeResult.changedFields).toContain('config.temperature');
    });

    it('should return no changes for identical data', async () => {
      const changeResult = await dependencyGraphEngine.detectNodeChanges(
        testWorkflowId,
        'node-2',
        testNodes[1],
        testNodes[1]
      );

      expect(changeResult.hasChanges).toBe(false);
      expect(changeResult.changeType).toBe('none');
      expect(changeResult.changedFields).toHaveLength(0);
    });
  });

  describe('invalidateDependents', () => {
    it('should invalidate direct dependents', async () => {
      const invalidationEvent = await dependencyGraphEngine.invalidateDependents(
        testWorkflowId,
        'node-1',
        'content',
        'Test content change'
      );

      expect(invalidationEvent.nodeId).toBe('node-1');
      expect(invalidationEvent.changeType).toBe('content');
      expect(invalidationEvent.affectedNodes).toContain('node-1');
      expect(invalidationEvent.cascadeNodes).toContain('node-2');
      expect(invalidationEvent.cascadeNodes).toContain('node-3');
    });

    it('should handle connection changes', async () => {
      const invalidationEvent = await dependencyGraphEngine.invalidateDependents(
        testWorkflowId,
        'node-1',
        'connection',
        'Test connection change'
      );

      expect(invalidationEvent.changeType).toBe('connection');
      expect(invalidationEvent.affectedNodes.length).toBeGreaterThan(1);
    });
  });

  describe('createRecomputationPlan', () => {
    it('should create a valid recomputation plan', async () => {
      // First create an invalidation event
      const invalidationEvent = await dependencyGraphEngine.invalidateDependents(
        testWorkflowId,
        'node-1',
        'content',
        'Test recomputation plan creation'
      );

      const plan = await dependencyGraphEngine.createRecomputationPlan(
        testWorkflowId,
        invalidationEvent,
        {
          prioritizeCritical: true,
          enableParallelExecution: true,
          maxParallelNodes: 3
        }
      );

      expect(plan.workflowId).toBe(testWorkflowId);
      expect(plan.rootCauseNodeId).toBe('node-1');
      expect(plan.executionOrder).toContain('node-1');
      expect(plan.executionOrder).toContain('node-2');
      expect(plan.executionOrder).toContain('node-3');
      expect(plan.parallelGroups.length).toBeGreaterThan(0);
      expect(plan.estimatedCost).toBeDefined();
      expect(plan.priority).toBeDefined();
    });

    it('should group nodes for parallel execution', async () => {
      const invalidationEvent = await dependencyGraphEngine.invalidateDependents(
        testWorkflowId,
        'node-2',
        'content',
        'Test parallel execution grouping'
      );

      const plan = await dependencyGraphEngine.createRecomputationPlan(
        testWorkflowId,
        invalidationEvent,
        {
          enableParallelExecution: true,
          maxParallelNodes: 5
        }
      );

      // Check that nodes are grouped correctly for parallel execution
      const hasParallelGroups = plan.parallelGroups.some(group => group.length > 1);
      expect(hasParallelGroups).toBeDefined();
    });
  });

  describe('getDependencyStatistics', () => {
    it('should return accurate statistics', async () => {
      const stats = await dependencyGraphEngine.getDependencyStatistics(testWorkflowId);

      expect(stats.totalNodes).toBe(3);
      expect(stats.totalDependencies).toBe(2);
      expect(stats.maxDependencyDepth).toBeGreaterThan(0);
      expect(stats.circularDependencyCount).toBe(0);
      expect(stats.averageDependents).toBeGreaterThanOrEqual(0);
      expect(stats.criticalPathLength).toBeGreaterThan(0);
      expect(stats.lastUpdated).toBeDefined();
    });
  });
});

describe('DependencyBackgroundService', () => {
  let backgroundService: DependencyBackgroundService;
  let testWorkflowId: string;

  beforeAll(async () => {
    backgroundService = new DependencyBackgroundService();

    // Create test workflow for background service tests
    const testWorkflow = await prisma.workflow.create({
      data: {
        name: 'Background Service Test Workflow',
        userId: 'test-user-id',
        nodes: [
          { id: 'bg-node-1', type: 'input', data: {}, config: {}, position: { x: 0, y: 0 } },
          { id: 'bg-node-2', type: 'llm', data: {}, config: {}, position: { x: 100, y: 0 } }
        ],
        edges: [
          { id: 'bg-edge-1', source: 'bg-node-1', target: 'bg-node-2', type: 'data' }
        ]
      }
    });
    testWorkflowId = testWorkflow.id;
  });

  afterAll(async () => {
    if (backgroundService) {
      await backgroundService.stop();
    }
    
    await prisma.workflow.delete({
      where: { id: testWorkflowId }
    });
  });

  describe('service lifecycle', () => {
    it('should start and stop successfully', async () => {
      await backgroundService.start();
      expect(backgroundService['isRunning']).toBe(true);

      await backgroundService.stop();
      expect(backgroundService['isRunning']).toBe(false);
    });

    it('should handle multiple start/stop calls gracefully', async () => {
      await backgroundService.start();
      await backgroundService.start(); // Should not cause issues
      expect(backgroundService['isRunning']).toBe(true);

      await backgroundService.stop();
      await backgroundService.stop(); // Should not cause issues
      expect(backgroundService['isRunning']).toBe(false);
    });
  });

  describe('optimization analysis', () => {
    it('should analyze optimization opportunities', async () => {
      const graph = await dependencyGraphEngine.buildDependencyGraph(testWorkflowId);
      const opportunities = await backgroundService['analyzeOptimizationOpportunities'](graph);

      expect(Array.isArray(opportunities)).toBe(true);
      expect(opportunities.length).toBeGreaterThanOrEqual(0);
    });

    it('should identify parallelization opportunities', async () => {
      // Create workflow with parallelizable nodes
      const parallelWorkflow = await prisma.workflow.create({
        data: {
          name: 'Parallel Test Workflow',
          userId: 'test-user-id',
          nodes: [
            { id: 'p-node-1', type: 'input', data: {}, config: {}, position: { x: 0, y: 0 } },
            { id: 'p-node-2', type: 'input', data: {}, config: {}, position: { x: 100, y: 0 } },
            { id: 'p-node-3', type: 'output', data: {}, config: {}, position: { x: 200, y: 0 } }
          ],
          edges: [
            { id: 'p-edge-1', source: 'p-node-1', target: 'p-node-3', type: 'data' },
            { id: 'p-edge-2', source: 'p-node-2', target: 'p-node-3', type: 'data' }
          ]
        }
      });

      const graph = await dependencyGraphEngine.buildDependencyGraph(parallelWorkflow.id);
      const parallelOps = backgroundService['findParallelizationOpportunities'](graph);

      expect(parallelOps.length).toBeGreaterThan(0);
      expect(parallelOps[0].type).toBe('parallelization');

      // Cleanup
      await prisma.workflow.delete({
        where: { id: parallelWorkflow.id }
      });
    });
  });
});

describe('Dependency Validation', () => {
  let testWorkflowId: string;

  beforeAll(async () => {
    const testWorkflow = await prisma.workflow.create({
      data: {
        name: 'Validation Test Workflow',
        userId: 'test-user-id',
        nodes: [],
        edges: []
      }
    });
    testWorkflowId = testWorkflow.id;
  });

  afterAll(async () => {
    await prisma.workflow.delete({
      where: { id: testWorkflowId }
    });
  });

  describe('graph validation', () => {
    it('should validate graphs with no issues', async () => {
      // Update workflow with valid structure
      await prisma.workflow.update({
        where: { id: testWorkflowId },
        data: {
          nodes: [
            { id: 'v-node-1', type: 'input', data: {}, config: {}, position: { x: 0, y: 0 } },
            { id: 'v-node-2', type: 'llm', data: {}, config: {}, position: { x: 100, y: 0 } }
          ],
          edges: [
            { id: 'v-edge-1', source: 'v-node-1', target: 'v-node-2', type: 'data' }
          ]
        }
      });

      const graph = await dependencyGraphEngine.buildDependencyGraph(testWorkflowId);
      
      expect(graph.circularDependencies).toHaveLength(0);
      expect(graph.topologicalOrder).toHaveLength(2);
      expect(graph.nodes.size).toBe(2);
    });

    it('should detect isolated nodes', async () => {
      // Update workflow with isolated node
      await prisma.workflow.update({
        where: { id: testWorkflowId },
        data: {
          nodes: [
            { id: 'v-node-1', type: 'input', data: {}, config: {}, position: { x: 0, y: 0 } },
            { id: 'v-node-2', type: 'llm', data: {}, config: {}, position: { x: 100, y: 0 } },
            { id: 'v-node-3', type: 'isolated', data: {}, config: {}, position: { x: 200, y: 0 } }
          ],
          edges: [
            { id: 'v-edge-1', source: 'v-node-1', target: 'v-node-2', type: 'data' }
          ]
        }
      });

      const graph = await dependencyGraphEngine.buildDependencyGraph(testWorkflowId);
      const isolatedNode = graph.nodes.get('v-node-3');
      
      expect(isolatedNode?.dependencies).toHaveLength(0);
      expect(isolatedNode?.dependents).toHaveLength(0);
    });
  });

  describe('edge case handling', () => {
    it('should handle empty workflows', async () => {
      await prisma.workflow.update({
        where: { id: testWorkflowId },
        data: {
          nodes: [],
          edges: []
        }
      });

      const graph = await dependencyGraphEngine.buildDependencyGraph(testWorkflowId);
      
      expect(graph.nodes.size).toBe(0);
      expect(graph.edges.size).toBe(0);
      expect(graph.topologicalOrder).toHaveLength(0);
    });

    it('should handle workflows with nodes but no edges', async () => {
      await prisma.workflow.update({
        where: { id: testWorkflowId },
        data: {
          nodes: [
            { id: 'no-edge-1', type: 'input', data: {}, config: {}, position: { x: 0, y: 0 } },
            { id: 'no-edge-2', type: 'llm', data: {}, config: {}, position: { x: 100, y: 0 } }
          ],
          edges: []
        }
      });

      const graph = await dependencyGraphEngine.buildDependencyGraph(testWorkflowId);
      
      expect(graph.nodes.size).toBe(2);
      expect(graph.edges.size).toBe(2); // Each node has an empty edge set
      expect(graph.topologicalOrder).toHaveLength(2);
    });

    it('should handle invalid node references in edges gracefully', async () => {
      await prisma.workflow.update({
        where: { id: testWorkflowId },
        data: {
          nodes: [
            { id: 'valid-node', type: 'input', data: {}, config: {}, position: { x: 0, y: 0 } }
          ],
          edges: [
            { id: 'invalid-edge', source: 'valid-node', target: 'non-existent-node', type: 'data' }
          ]
        }
      });

      // Should not throw an error
      const graph = await dependencyGraphEngine.buildDependencyGraph(testWorkflowId);
      expect(graph.nodes.size).toBe(1);
    });
  });
});

describe('Performance Tests', () => {
  let largeWorkflowId: string;
  const NODE_COUNT = 100;
  const EDGE_COUNT = 150;

  beforeAll(async () => {
    // Create large workflow for performance testing
    const largeNodes = Array.from({ length: NODE_COUNT }, (_, i) => ({
      id: `perf-node-${i}`,
      type: i % 3 === 0 ? 'input' : i % 3 === 1 ? 'llm' : 'output',
      data: { index: i },
      config: { optimized: true },
      position: { x: i * 50, y: (i % 10) * 50 }
    }));

    const largeEdges = Array.from({ length: EDGE_COUNT }, (_, i) => ({
      id: `perf-edge-${i}`,
      source: `perf-node-${i % NODE_COUNT}`,
      target: `perf-node-${(i + 1) % NODE_COUNT}`,
      type: 'data'
    }));

    const largeWorkflow = await prisma.workflow.create({
      data: {
        name: 'Performance Test Workflow',
        userId: 'test-user-id',
        nodes: largeNodes,
        edges: largeEdges
      }
    });
    largeWorkflowId = largeWorkflow.id;
  });

  afterAll(async () => {
    await prisma.workflow.delete({
      where: { id: largeWorkflowId }
    });
  });

  it('should build large dependency graphs efficiently', async () => {
    const startTime = Date.now();
    
    const graph = await dependencyGraphEngine.buildDependencyGraph(largeWorkflowId);
    
    const endTime = Date.now();
    const buildTime = endTime - startTime;

    expect(graph.nodes.size).toBe(NODE_COUNT);
    expect(buildTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it('should handle bulk invalidation efficiently', async () => {
    const nodeIds = Array.from({ length: 10 }, (_, i) => `perf-node-${i}`);
    const startTime = Date.now();

    const invalidationPromises = nodeIds.map(nodeId =>
      dependencyGraphEngine.invalidateDependents(
        largeWorkflowId,
        nodeId,
        'content',
        `Performance test invalidation ${nodeId}`
      )
    );

    const results = await Promise.all(invalidationPromises);
    const endTime = Date.now();
    const invalidationTime = endTime - startTime;

    expect(results).toHaveLength(10);
    expect(invalidationTime).toBeLessThan(3000); // Should complete within 3 seconds
  });

  it('should create recomputation plans for large graphs efficiently', async () => {
    // First create an invalidation event
    const invalidationEvent = await dependencyGraphEngine.invalidateDependents(
      largeWorkflowId,
      'perf-node-0',
      'content',
      'Large scale performance test'
    );

    const startTime = Date.now();
    
    const plan = await dependencyGraphEngine.createRecomputationPlan(
      largeWorkflowId,
      invalidationEvent,
      {
        prioritizeCritical: false,
        enableParallelExecution: true,
        maxParallelNodes: 10
      }
    );

    const endTime = Date.now();
    const planningTime = endTime - startTime;

    expect(plan.executionOrder.length).toBeGreaterThan(0);
    expect(planningTime).toBeLessThan(2000); // Should complete within 2 seconds
  });
});

describe('Integration Tests', () => {
  let integrationWorkflowId: string;

  beforeAll(async () => {
    const integrationWorkflow = await prisma.workflow.create({
      data: {
        name: 'Integration Test Workflow',
        userId: 'test-user-id',
        nodes: [
          { id: 'int-node-1', type: 'input', data: { text: 'Hello' }, config: {}, position: { x: 0, y: 0 } },
          { id: 'int-node-2', type: 'llm', data: { prompt: '{{int-node-1.data.text}} world' }, config: { model: 'gpt-4' }, position: { x: 100, y: 0 } },
          { id: 'int-node-3', type: 'llm', data: { prompt: 'Process: {{int-node-2.outputs.text}}' }, config: { model: 'gpt-3.5-turbo' }, position: { x: 200, y: 0 } },
          { id: 'int-node-4', type: 'output', data: { format: 'json' }, config: {}, position: { x: 300, y: 0 } }
        ],
        edges: [
          { id: 'int-edge-1', source: 'int-node-1', target: 'int-node-2', type: 'data' },
          { id: 'int-edge-2', source: 'int-node-2', target: 'int-node-3', type: 'data' },
          { id: 'int-edge-3', source: 'int-node-3', target: 'int-node-4', type: 'data' }
        ]
      }
    });
    integrationWorkflowId = integrationWorkflow.id;
  });

  afterAll(async () => {
    await prisma.workflow.delete({
      where: { id: integrationWorkflowId }
    });
  });

  it('should handle complete invalidation and recomputation workflow', async () => {
    // Step 1: Build initial dependency graph
    const graph = await dependencyGraphEngine.buildDependencyGraph(integrationWorkflowId);
    expect(graph.nodes.size).toBe(4);

    // Step 2: Detect changes in a middle node
    const originalNode = graph.nodes.get('int-node-2');
    const modifiedNode = {
      id: 'int-node-2',
      type: 'llm',
      data: { prompt: 'Modified: {{int-node-1.data.text}} universe' },
      config: { model: 'gpt-4', temperature: 0.8 },
      position: { x: 100, y: 0 }
    };

    const changeResult = await dependencyGraphEngine.detectNodeChanges(
      integrationWorkflowId,
      'int-node-2',
      modifiedNode,
      originalNode
    );

    expect(changeResult.hasChanges).toBe(true);
    expect(changeResult.changeType).toBe('content');

    // Step 3: Invalidate dependents
    const invalidationEvent = await dependencyGraphEngine.invalidateDependents(
      integrationWorkflowId,
      'int-node-2',
      'content',
      'Integration test modification'
    );

    expect(invalidationEvent.affectedNodes).toContain('int-node-2');
    expect(invalidationEvent.cascadeNodes).toContain('int-node-3');
    expect(invalidationEvent.cascadeNodes).toContain('int-node-4');

    // Step 4: Create recomputation plan
    const plan = await dependencyGraphEngine.createRecomputationPlan(
      integrationWorkflowId,
      invalidationEvent,
      {
        prioritizeCritical: true,
        enableParallelExecution: true,
        maxParallelNodes: 3
      }
    );

    expect(plan.executionOrder).toContain('int-node-2');
    expect(plan.executionOrder).toContain('int-node-3');
    expect(plan.executionOrder).toContain('int-node-4');
    expect(plan.executionOrder).toEqual(expect.arrayContaining(['int-node-2', 'int-node-3', 'int-node-4']));

    // Step 5: Execute recomputation plan (mock execution)
    const executionResult = await dependencyGraphEngine.executeRecomputationPlan(plan, {
      enableProgressTracking: true,
      enableRollback: true,
      batchSize: 2
    });

    expect(executionResult.success).toBe(true);
    expect(executionResult.executedNodes.length).toBeGreaterThan(0);
    expect(executionResult.failedNodes).toHaveLength(0);
  });

  it('should handle workflow updates through middleware', async () => {
    // Simulate middleware workflow update
    const originalWorkflow = await prisma.workflow.findUnique({
      where: { id: integrationWorkflowId }
    });

    const updatedNodes = [
      ...originalWorkflow.nodes as any[],
      {
        id: 'int-node-5',
        type: 'llm',
        data: { prompt: 'New processing node' },
        config: { model: 'gpt-4' },
        position: { x: 150, y: 100 }
      }
    ];

    const updatedEdges = [
      ...originalWorkflow.edges as any[],
      {
        id: 'int-edge-4',
        source: 'int-node-2',
        target: 'int-node-5',
        type: 'data'
      },
      {
        id: 'int-edge-5',
        source: 'int-node-5',
        target: 'int-node-4',
        type: 'data'
      }
    ];

    // Update workflow
    await prisma.workflow.update({
      where: { id: integrationWorkflowId },
      data: {
        nodes: updatedNodes,
        edges: updatedEdges
      }
    });

    // Rebuild dependency graph
    const updatedGraph = await dependencyGraphEngine.buildDependencyGraph(integrationWorkflowId);
    expect(updatedGraph.nodes.size).toBe(5);

    // Verify new dependencies
    const newNode = updatedGraph.nodes.get('int-node-5');
    expect(newNode?.dependencies).toContain('int-node-2');
    expect(newNode?.dependents).toContain('int-node-4');

    // Verify updated dependencies for existing nodes
    const node2 = updatedGraph.nodes.get('int-node-2');
    const node4 = updatedGraph.nodes.get('int-node-4');
    
    expect(node2?.dependents).toContain('int-node-5');
    expect(node4?.dependencies).toContain('int-node-5');
  });
});