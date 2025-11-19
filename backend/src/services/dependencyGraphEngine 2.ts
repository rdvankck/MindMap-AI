import { PrismaClient, Workflow, WorkflowExecution, ExecutionLog } from '@prisma/client';
import { Redis } from 'ioredis';
import { logger } from '@/utils/logger';
import { redis } from '@/config/redis';

export interface NodeDependency {
  nodeId: string;
  workflowId: string;
  dependencies: string[]; // Array of node IDs this node depends on
  dependents: string[];  // Array of node IDs that depend on this node
  lastUpdated: Date;
  hash: string; // Content hash for change detection
}

export interface DependencyGraph {
  workflowId: string;
  nodes: Map<string, NodeDependency>;
  edges: Map<string, Set<string>>; // adjacency list for fast traversal
  circularDependencies: string[][]; // detected circular dependencies
  topologicalOrder: string[]; // valid execution order
  lastComputed: Date;
}

export interface InvalidationEvent {
  id: string;
  workflowId: string;
  nodeId: string;
  changeType: 'content' | 'config' | 'connection' | 'deletion';
  reason: string;
  affectedNodes: string[]; // directly affected nodes
  cascadeNodes: string[];  // indirectly affected nodes (dependents)
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface ChangeDetectionResult {
  hasChanges: boolean;
  changeType: 'content' | 'config' | 'connection' | 'none';
  changedFields: string[];
  oldHash: string;
  newHash: string;
  scope: 'node' | 'dependencies' | 'dependents' | 'cascade';
}

export interface RecomputationPlan {
  id: string;
  workflowId: string;
  rootCauseNodeId: string;
  invalidationEvents: InvalidationEvent[];
  executionOrder: string[];
  parallelGroups: string[][]; // nodes that can be executed in parallel
  estimatedCost: {
    nodes: number;
    tokens: number;
    timeMs: number;
  };
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
}

export interface DependencyTrackingOptions {
  enableCircularDependencyDetection: boolean;
  enableChangeHashing: boolean;
  enableCacheInvalidation: boolean;
  enableRealTimeUpdates: boolean;
  maxDependencyDepth: number;
  changeDetectionSensitivity: 'low' | 'medium' | 'high';
}

export class DependencyGraphEngine {
  private prisma: PrismaClient;
  private redis: Redis;
  private readonly DEPENDENCY_CACHE_TTL = 1800; // 30 minutes
  private readonly GRAPH_CACHE_TTL = 3600; // 1 hour
  private readonly INVALIDATION_CACHE_TTL = 900; // 15 minutes
  private readonly PLAN_CACHE_TTL = 600; // 10 minutes

  // In-memory caches for performance
  private graphCache: Map<string, DependencyGraph> = new Map();
  private nodeHashes: Map<string, string> = new Map();
  private invalidationQueue: InvalidationEvent[] = [];

  constructor() {
    this.prisma = new PrismaClient();
    this.redis = redis;
  }

  /**
   * Build and maintain dependency graph for a workflow
   */
  async buildDependencyGraph(
    workflowId: string,
    options: DependencyTrackingOptions = {
      enableCircularDependencyDetection: true,
      enableChangeHashing: true,
      enableCacheInvalidation: true,
      enableRealTimeUpdates: false,
      maxDependencyDepth: 50,
      changeDetectionSensitivity: 'medium'
    }
  ): Promise<DependencyGraph> {
    try {
      const cacheKey = `dependency-graph:${workflowId}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        const graph = JSON.parse(cached) as DependencyGraph;
        // Restore Map structures
        graph.nodes = new Map(Object.entries(graph.nodes));
        graph.edges = new Map(Object.entries(graph.edges).map(([k, v]) => [k, new Set(v)]));
        return graph;
      }

      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        select: { nodes: true, edges: true }
      });

      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      const nodes = workflow.nodes as any[];
      const edges = workflow.edges as any[];

      // Build dependency relationships
      const nodeDependencies = new Map<string, NodeDependency>();
      const adjacencyList = new Map<string, Set<string>>();

      // Initialize all nodes
      nodes.forEach(node => {
        const nodeDep: NodeDependency = {
          nodeId: node.id,
          workflowId,
          dependencies: [],
          dependents: [],
          lastUpdated: new Date(node.data?.lastModified || Date.now()),
          hash: options.enableChangeHashing ? await this.calculateNodeHash(node) : ''
        };
        nodeDependencies.set(node.id, nodeDep);
        adjacencyList.set(node.id, new Set());
      });

      // Process edges to build dependencies
      edges.forEach(edge => {
        const sourceNode = edge.source;
        const targetNode = edge.target;

        // targetNode depends on sourceNode
        if (nodeDependencies.has(targetNode) && nodeDependencies.has(sourceNode)) {
          const targetDep = nodeDependencies.get(targetNode)!;
          const sourceDep = nodeDependencies.get(sourceNode)!;

          targetDep.dependencies.push(sourceNode);
          sourceDep.dependents.push(targetNode);

          adjacencyList.get(sourceNode)!.add(targetNode);
        }
      });

      // Detect circular dependencies
      const circularDependencies = options.enableCircularDependencyDetection 
        ? await this.detectCircularDependencies(adjacencyList)
        : [];

      // Compute topological order
      const topologicalOrder = await this.computeTopologicalOrder(adjacencyList, circularDependencies);

      const graph: DependencyGraph = {
        workflowId,
        nodes: nodeDependencies,
        edges: adjacencyList,
        circularDependencies,
        topologicalOrder,
        lastComputed: new Date()
      };

      // Cache the graph
      await this.redis.setex(cacheKey, this.GRAPH_CACHE_TTL, JSON.stringify({
        ...graph,
        nodes: Object.fromEntries(graph.nodes),
        edges: Object.fromEntries(Array.from(graph.edges.entries()).map(([k, v]) => [k, Array.from(v)]))
      }));

      // Store in memory cache
      this.graphCache.set(workflowId, graph);

      logger.info(`Built dependency graph for workflow ${workflowId} with ${nodes.length} nodes and ${edges.length} edges`);
      return graph;
    } catch (error) {
      logger.error('Error building dependency graph:', error);
      throw new Error('Failed to build dependency graph');
    }
  }

  /**
   * Detect changes in node content or configuration
   */
  async detectNodeChanges(
    workflowId: string,
    nodeId: string,
    currentNodeData: any,
    previousNodeData?: any
  ): Promise<ChangeDetectionResult> {
    try {
      const graph = await this.buildDependencyGraph(workflowId);
      const nodeDep = graph.nodes.get(nodeId);

      if (!nodeDep) {
        throw new Error(`Node ${nodeId} not found in workflow ${workflowId}`);
      }

      const newHash = await this.calculateNodeHash(currentNodeData);
      const oldHash = previousNodeData ? await this.calculateNodeHash(previousNodeData) : nodeDep.hash;

      if (newHash === oldHash) {
        return {
          hasChanges: false,
          changeType: 'none',
          changedFields: [],
          oldHash,
          newHash,
          scope: 'node'
        };
      }

      // Analyze what changed
      const changedFields = await this.analyzeChangedFields(currentNodeData, previousNodeData);
      const changeType = this.determineChangeType(changedFields);

      return {
        hasChanges: true,
        changeType,
        changedFields,
        oldHash,
        newHash,
        scope: await this.determineChangeScope(workflowId, nodeId, changeType)
      };
    } catch (error) {
      logger.error('Error detecting node changes:', error);
      throw new Error('Failed to detect node changes');
    }
  }

  /**
   * Invalidate dependent nodes when a parent node changes
   */
  async invalidateDependents(
    workflowId: string,
    nodeId: string,
    changeType: 'content' | 'config' | 'connection' | 'deletion',
    reason: string,
    metadata: Record<string, any> = {}
  ): Promise<InvalidationEvent> {
    try {
      const graph = await this.buildDependencyGraph(workflowId);
      const nodeDep = graph.nodes.get(nodeId);

      if (!nodeDep) {
        throw new Error(`Node ${nodeId} not found in workflow ${workflowId}`);
      }

      // Find all affected nodes through dependency traversal
      const affectedNodes = await this.findAffectedNodes(graph, nodeId, changeType);
      const cascadeNodes = await this.findCascadeNodes(graph, affectedNodes);

      const invalidationEvent: InvalidationEvent = {
        id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        workflowId,
        nodeId,
        changeType,
        reason,
        affectedNodes,
        cascadeNodes,
        timestamp: new Date(),
        metadata
      };

      // Cache the invalidation event
      const cacheKey = `invalidation:${invalidationEvent.id}`;
      await this.redis.setex(cacheKey, this.INVALIDATION_CACHE_TTL, JSON.stringify(invalidationEvent));

      // Add to queue for processing
      this.invalidationQueue.push(invalidationEvent);

      // Update node hash if content changed
      if (changeType === 'content' || changeType === 'config') {
        nodeDep.lastUpdated = new Date();
        this.nodeHashes.set(`${workflowId}:${nodeId}`, nodeDep.hash);
      }

      // Invalidate related caches
      await this.invalidateRelatedCaches(workflowId, nodeId, affectedNodes, cascadeNodes);

      logger.info(`Invalidated ${cascadeNodes.length + 1} nodes due to ${changeType} change in node ${nodeId}`);
      return invalidationEvent;
    } catch (error) {
      logger.error('Error invalidating dependents:', error);
      throw new Error('Failed to invalidate dependents');
    }
  }

  /**
   * Create a recomputation plan for invalidated nodes
   */
  async createRecomputationPlan(
    workflowId: string,
    invalidationEvent: InvalidationEvent,
    options: {
      prioritizeCritical: boolean;
      enableParallelExecution: boolean;
      maxParallelNodes: number;
    } = {
      prioritizeCritical: true,
      enableParallelExecution: true,
      maxParallelNodes: 5
    }
  ): Promise<RecomputationPlan> {
    try {
      const graph = await this.buildDependencyGraph(workflowId);
      const allAffectedNodes = [...invalidationEvent.affectedNodes, ...invalidationEvent.cascadeNodes];

      // Determine optimal execution order
      const executionOrder = await this.computeExecutionOrder(graph, allAffectedNodes);

      // Group nodes for parallel execution
      const parallelGroups = options.enableParallelExecution 
        ? await this.groupNodesForParallelExecution(graph, executionOrder, options.maxParallelNodes)
        : executionOrder.map(nodeId => [nodeId]);

      // Estimate computational cost
      const estimatedCost = await this.estimateComputationCost(workflowId, allAffectedNodes);

      // Determine priority
      const priority = await this.determinePriority(workflowId, invalidationEvent, options.prioritizeCritical);

      const plan: RecomputationPlan = {
        id: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        workflowId,
        rootCauseNodeId: invalidationEvent.nodeId,
        invalidationEvents: [invalidationEvent],
        executionOrder,
        parallelGroups,
        estimatedCost,
        priority,
        createdAt: new Date()
      };

      // Cache the plan
      const cacheKey = `recomputation-plan:${plan.id}`;
      await this.redis.setex(cacheKey, this.PLAN_CACHE_TTL, JSON.stringify(plan));

      return plan;
    } catch (error) {
      logger.error('Error creating recomputation plan:', error);
      throw new Error('Failed to create recomputation plan');
    }
  }

  /**
   * Execute recomputation plan
   */
  async executeRecomputationPlan(
    plan: RecomputationPlan,
    options: {
      enableProgressTracking: boolean;
      enableRollback: boolean;
      batchSize: number;
    } = {
      enableProgressTracking: true,
      enableRollback: true,
      batchSize: 10
    }
  ): Promise<{
    success: boolean;
    executedNodes: string[];
    failedNodes: string[];
    executionTime: number;
    errors: any[];
  }> {
    const startTime = Date.now();
    const executedNodes: string[] = [];
    const failedNodes: string[] = [];
    const errors: any[] = [];

    try {
      logger.info(`Executing recomputation plan ${plan.id} for ${plan.executionOrder.length} nodes`);

      // Execute in parallel groups
      for (let groupIndex = 0; groupIndex < plan.parallelGroups.length; groupIndex++) {
        const group = plan.parallelGroups[groupIndex];
        
        if (options.enableProgressTracking) {
          logger.info(`Executing group ${groupIndex + 1}/${plan.parallelGroups.length} with ${group.length} nodes`);
        }

        // Execute nodes in this group in parallel
        const groupPromises = group.map(async (nodeId) => {
          try {
            await this.executeNode(plan.workflowId, nodeId, {
              enableRollback: options.enableRollback,
              batchExecution: group.length > 1
            });
            executedNodes.push(nodeId);
            
            if (options.enableProgressTracking) {
              await this.updateProgress(plan.id, nodeId, 'completed', groupIndex, group.length);
            }
          } catch (error) {
            failedNodes.push(nodeId);
            errors.push({ nodeId, error: error.message });
            
            if (options.enableProgressTracking) {
              await this.updateProgress(plan.id, nodeId, 'failed', groupIndex, group.length);
            }
            
            logger.error(`Failed to execute node ${nodeId}:`, error);
          }
        });

        // Wait for all nodes in this group to complete
        await Promise.allSettled(groupPromises);

        // Brief pause between groups to prevent overwhelming the system
        if (groupIndex < plan.parallelGroups.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const executionTime = Date.now() - startTime;
      const success = failedNodes.length === 0;

      // Cache execution results
      const resultCacheKey = `execution-result:${plan.id}`;
      await this.redis.setex(resultCacheKey, this.PLAN_CACHE_TTL, JSON.stringify({
        success,
        executedNodes,
        failedNodes,
        executionTime,
        errors,
        completedAt: new Date()
      }));

      logger.info(`Recomputation plan ${plan.id} completed in ${executionTime}ms. Success: ${success}, Failed: ${failedNodes.length}`);
      
      return {
        success,
        executedNodes,
        failedNodes,
        executionTime,
        errors
      };
    } catch (error) {
      logger.error('Error executing recomputation plan:', error);
      throw new Error('Failed to execute recomputation plan');
    }
  }

  /**
   * Get dependency statistics for monitoring
   */
  async getDependencyStatistics(workflowId: string): Promise<{
    totalNodes: number;
    totalDependencies: number;
    maxDependencyDepth: number;
    circularDependencyCount: number;
    averageDependents: number;
    criticalPathLength: number;
    lastUpdated: Date;
  }> {
    try {
      const graph = await this.buildDependencyGraph(workflowId);
      
      const totalNodes = graph.nodes.size;
      const totalDependencies = Array.from(graph.nodes.values())
        .reduce((sum, node) => sum + node.dependencies.length, 0);
      
      const maxDependencyDepth = await this.calculateMaxDependencyDepth(graph);
      const circularDependencyCount = graph.circularDependencies.length;
      
      const averageDependents = totalNodes > 0 
        ? Array.from(graph.nodes.values())
          .reduce((sum, node) => sum + node.dependents.length, 0) / totalNodes
        : 0;

      const criticalPathLength = await this.calculateCriticalPathLength(graph);
      const lastUpdated = graph.lastComputed;

      return {
        totalNodes,
        totalDependencies,
        maxDependencyDepth,
        circularDependencyCount,
        averageDependents: Math.round(averageDependents * 100) / 100,
        criticalPathLength,
        lastUpdated
      };
    } catch (error) {
      logger.error('Error getting dependency statistics:', error);
      throw new Error('Failed to get dependency statistics');
    }
  }

  // Private helper methods

  private async calculateNodeHash(nodeData: any): Promise<string> {
    try {
      const crypto = require('crypto');
      const content = JSON.stringify({
        id: nodeData.id,
        type: nodeData.type,
        data: nodeData.data,
        config: nodeData.config || {},
        position: nodeData.position
      });
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      logger.error('Error calculating node hash:', error);
      return Date.now().toString();
    }
  }

  private async detectCircularDependencies(
    adjacencyList: Map<string, Set<string>>
  ): Promise<string[][]> {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (nodeId: string, path: string[]): boolean => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        cycles.push([...path.slice(cycleStart), nodeId]);
        return true;
      }

      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const dependents = adjacencyList.get(nodeId) || new Set();
      for (const dependent of dependents) {
        if (dfs(dependent, [...path])) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of adjacencyList.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    return cycles;
  }

  private async computeTopologicalOrder(
    adjacencyList: Map<string, Set<string>>,
    circularDependencies: string[][]
  ): Promise<string[]> {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // Initialize in-degrees
    for (const nodeId of adjacencyList.keys()) {
      inDegree.set(nodeId, 0);
    }

    // Calculate in-degrees
    for (const [sourceNode, dependents] of adjacencyList.entries()) {
      for (const dependent of dependents) {
        inDegree.set(dependent, (inDegree.get(dependent) || 0) + 1);
      }
    }

    // Find nodes with no incoming edges
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    // Process nodes
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const dependents = adjacencyList.get(current) || new Set();
      for (const dependent of dependents) {
        const newDegree = (inDegree.get(dependent) || 0) - 1;
        inDegree.set(dependent, newDegree);
        
        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }

    // Check if topological sort is possible (no cycles)
    if (result.length !== adjacencyList.size && circularDependencies.length > 0) {
      logger.warn(`Topological sort incomplete due to circular dependencies. Sorted ${result.length}/${adjacencyList.size} nodes`);
    }

    return result;
  }

  private async analyzeChangedFields(currentData: any, previousData?: any): Promise<string[]> {
    if (!previousData) return ['all'];

    const changedFields: string[] = [];
    
    const compareObjects = (obj1: any, obj2: any, prefix: string = '') => {
      const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
      
      for (const key of allKeys) {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        const val1 = obj1?.[key];
        const val2 = obj2?.[key];
        
        if (JSON.stringify(val1) !== JSON.stringify(val2)) {
          if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
            compareObjects(val1, val2, fieldPath);
          } else {
            changedFields.push(fieldPath);
          }
        }
      }
    };

    compareObjects(currentData, previousData);
    return changedFields;
  }

  private determineChangeType(changedFields: string[]): 'content' | 'config' | 'connection' | 'none' {
    if (changedFields.length === 0) return 'none';
    
    const configFields = ['config', 'settings', 'parameters'];
    const connectionFields = ['position', 'connections', 'edges'];
    const contentFields = ['data', 'content', 'value'];

    if (changedFields.some(field => configFields.some(config => field.includes(config)))) {
      return 'config';
    }
    
    if (changedFields.some(field => connectionFields.some(conn => field.includes(conn)))) {
      return 'connection';
    }
    
    return 'content';
  }

  private async determineChangeScope(
    workflowId: string,
    nodeId: string,
    changeType: string
  ): Promise<'node' | 'dependencies' | 'dependents' | 'cascade'> {
    const graph = await this.buildDependencyGraph(workflowId);
    const nodeDep = graph.nodes.get(nodeId);
    
    if (!nodeDep) return 'node';
    
    if (changeType === 'deletion') return 'cascade';
    if (nodeDep.dependents.length > 0) return 'cascade';
    if (nodeDep.dependencies.length > 0) return 'dependencies';
    
    return 'node';
  }

  private async findAffectedNodes(
    graph: DependencyGraph,
    nodeId: string,
    changeType: string
  ): Promise<string[]> {
    const affected = new Set<string>([nodeId]);
    
    if (changeType === 'connection') {
      // For connection changes, both source and target nodes are affected
      const nodeDep = graph.nodes.get(nodeId);
      if (nodeDep) {
        nodeDep.dependencies.forEach(dep => affected.add(dep));
        nodeDep.dependents.forEach(dep => affected.add(dep));
      }
    }
    
    return Array.from(affected);
  }

  private async findCascadeNodes(
    graph: DependencyGraph,
    affectedNodes: string[]
  ): Promise<string[]> {
    const cascaded = new Set<string>();
    const visited = new Set<string>();

    const bfs = async (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const nodeDep = graph.nodes.get(nodeId);
      if (nodeDep) {
        for (const dependent of nodeDep.dependents) {
          if (!affectedNodes.includes(dependent)) {
            cascaded.add(dependent);
          }
          await bfs(dependent);
        }
      }
    };

    for (const nodeId of affectedNodes) {
      await bfs(nodeId);
    }

    return Array.from(cascaded);
  }

  private async invalidateRelatedCaches(
    workflowId: string,
    nodeId: string,
    affectedNodes: string[],
    cascadeNodes: string[]
  ): Promise<void> {
    try {
      const patterns = [
        `execution-cache:${workflowId}:*`,
        `node-output:${workflowId}:*`,
        `context-cache:*`,
        `recomputation-plan:*`
      ];

      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }

      // Clear in-memory caches
      this.graphCache.delete(workflowId);
      this.nodeHashes.delete(`${workflowId}:${nodeId}`);

      affectedNodes.forEach(nodeId => {
        this.nodeHashes.delete(`${workflowId}:${nodeId}`);
      });

      cascadeNodes.forEach(nodeId => {
        this.nodeHashes.delete(`${workflowId}:${nodeId}`);
      });
    } catch (error) {
      logger.error('Error invalidating related caches:', error);
    }
  }

  private async computeExecutionOrder(
    graph: DependencyGraph,
    affectedNodes: string[]
  ): Promise<string[]> {
    // Filter topological order to include only affected nodes
    return graph.topologicalOrder.filter(nodeId => affectedNodes.includes(nodeId));
  }

  private async groupNodesForParallelExecution(
    graph: DependencyGraph,
    executionOrder: string[],
    maxParallelNodes: number
  ): Promise<string[][]> {
    const groups: string[][] = [];
    const processed = new Set<string>();

    for (const nodeId of executionOrder) {
      if (processed.has(nodeId)) continue;

      const currentGroup: string[] = [];
      const nodeDep = graph.nodes.get(nodeId);

      // Check if this node can be executed in parallel with others
      if (nodeDep && nodeDep.dependencies.every(dep => processed.has(dep))) {
        currentGroup.push(nodeId);
        processed.add(nodeId);

        // Find other nodes that can be executed in parallel
        for (const otherNodeId of executionOrder) {
          if (processed.has(otherNodeId)) continue;
          if (currentGroup.length >= maxParallelNodes) break;

          const otherNodeDep = graph.nodes.get(otherNodeId);
          if (otherNodeDep && otherNodeDep.dependencies.every(dep => processed.has(dep))) {
            // Check if there are no dependencies between nodes in current group
            const canExecuteInParallel = currentGroup.every(groupNodeId => {
              const groupNodeDep = graph.nodes.get(groupNodeId)!;
              return !groupNodeDep.dependencies.includes(otherNodeId) && 
                     !otherNodeDep.dependencies.includes(groupNodeId);
            });

            if (canExecuteInParallel) {
              currentGroup.push(otherNodeId);
              processed.add(otherNodeId);
            }
          }
        }
      }

      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
    }

    return groups;
  }

  private async estimateComputationCost(
    workflowId: string,
    nodeIds: string[]
  ): Promise<{ nodes: number; tokens: number; timeMs: number }> {
    try {
      // Get historical execution data for cost estimation
      const executions = await this.prisma.workflowExecution.findMany({
        where: {
          workflowId,
          status: 'COMPLETED'
        },
        orderBy: { completedAt: 'desc' },
        take: 10,
        select: {
          nodeExecutions: true
        }
      });

      const nodeCosts = new Map<string, { tokens: number; timeMs: number }>();

      // Analyze historical data
      executions.forEach(execution => {
        const nodeExecs = execution.nodeExecutions as any[];
        nodeExecs.forEach(nodeExec => {
          const existing = nodeCosts.get(nodeExec.nodeId) || { tokens: 0, timeMs: 0 };
          nodeCosts.set(nodeExec.nodeId, {
            tokens: Math.max(existing.tokens, nodeExec.outputs?.tokens || 0),
            timeMs: Math.max(existing.timeMs, nodeExec.completedAt ? 
              new Date(nodeExec.completedAt).getTime() - new Date(nodeExec.startedAt).getTime() : 0)
          });
        });
      });

      // Calculate total cost
      let totalTokens = 0;
      let totalTimeMs = 0;

      nodeIds.forEach(nodeId => {
        const cost = nodeCosts.get(nodeId) || { tokens: 1000, timeMs: 1000 }; // Default estimates
        totalTokens += cost.tokens;
        totalTimeMs += cost.timeMs;
      });

      return {
        nodes: nodeIds.length,
        tokens: totalTokens,
        timeMs: totalTimeMs
      };
    } catch (error) {
      logger.error('Error estimating computation cost:', error);
      return {
        nodes: nodeIds.length,
        tokens: nodeIds.length * 1000, // Default estimate
        timeMs: nodeIds.length * 1000 // Default estimate
      };
    }
  }

  private async determinePriority(
    workflowId: string,
    invalidationEvent: InvalidationEvent,
    prioritizeCritical: boolean
  ): Promise<'low' | 'medium' | 'high' | 'critical'> {
    if (!prioritizeCritical) return 'medium';

    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { isPublic: true }
    });

    // Critical if it's a public workflow or affects many nodes
    const affectedCount = invalidationEvent.cascadeNodes.length + invalidationEvent.affectedNodes.length;
    
    if (workflow?.isPublic && affectedCount > 10) return 'critical';
    if (affectedCount > 20) return 'critical';
    if (affectedCount > 5) return 'high';
    if (affectedCount > 2) return 'medium';
    
    return 'low';
  }

  private async executeNode(
    workflowId: string,
    nodeId: string,
    options: { enableRollback: boolean; batchExecution: boolean }
  ): Promise<void> {
    // This would integrate with the existing workflow execution system
    // For now, we'll simulate node execution
    logger.debug(`Executing node ${nodeId} in workflow ${workflowId}`);
    
    // Simulate execution time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    // In a real implementation, this would:
    // 1. Get the node configuration
    // 2. Execute the node's logic (LLM call, API call, etc.)
    // 3. Store the results
    // 4. Handle errors and rollback if needed
  }

  private async updateProgress(
    planId: string,
    nodeId: string,
    status: 'completed' | 'failed',
    groupIndex: number,
    groupSize: number
  ): Promise<void> {
    try {
      const progressKey = `recomputation-progress:${planId}`;
      const progressData = {
        nodeId,
        status,
        groupIndex,
        groupSize,
        timestamp: new Date()
      };
      
      await this.redis.lpush(progressKey, JSON.stringify(progressData));
      await this.redis.expire(progressKey, this.PLAN_CACHE_TTL);
    } catch (error) {
      logger.error('Error updating progress:', error);
    }
  }

  private async calculateMaxDependencyDepth(graph: DependencyGraph): Promise<number> {
    let maxDepth = 0;

    const dfs = (nodeId: string, visited: Set<string>): number => {
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);

      const nodeDep = graph.nodes.get(nodeId);
      if (!nodeDep || nodeDep.dependencies.length === 0) return 1;

      let maxChildDepth = 0;
      for (const dep of nodeDep.dependencies) {
        maxChildDepth = Math.max(maxChildDepth, dfs(dep, new Set(visited)));
      }

      return maxChildDepth + 1;
    };

    for (const nodeId of graph.nodes.keys()) {
      maxDepth = Math.max(maxDepth, dfs(nodeId, new Set()));
    }

    return maxDepth;
  }

  private async calculateCriticalPathLength(graph: DependencyGraph): Promise<number> {
    // Find the longest path in the dependency graph
    const longestPath = new Map<string, number>();

    const topologicalOrder = [...graph.topologicalOrder].reverse(); // Process from leaves to roots

    for (const nodeId of topologicalOrder) {
      const nodeDep = graph.nodes.get(nodeId);
      if (!nodeDep) continue;

      if (nodeDep.dependents.length === 0) {
        longestPath.set(nodeId, 1);
      } else {
        let maxDependentPath = 0;
        for (const dependent of nodeDep.dependents) {
          maxDependentPath = Math.max(maxDependentPath, longestPath.get(dependent) || 0);
        }
        longestPath.set(nodeId, maxDependentPath + 1);
      }
    }

    return Math.max(...Array.from(longestPath.values()), 0);
  }
}

export const dependencyGraphEngine = new DependencyGraphEngine();