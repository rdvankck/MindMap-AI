import { Request, Response } from 'express';
import { dependencyGraphEngine } from '@/services/dependencyGraphEngine';
import { logger } from '@/utils/logger';
import { Server as SocketIOServer } from 'socket.io';

export class DependencyController {
  private io?: SocketIOServer;

  /**
   * Set Socket.IO instance for real-time updates
   */
  setSocketIO(io: SocketIOServer): void {
    this.io = io;
  }

  /**
   * Build dependency graph for a workflow
   */
  async buildDependencyGraph(req: Request, res: Response): Promise<void> {
    try {
      const { workflowId } = req.params;
      const {
        enableCircularDependencyDetection = true,
        enableChangeHashing = true,
        enableCacheInvalidation = true,
        enableRealTimeUpdates = false,
        maxDependencyDepth = 50,
        changeDetectionSensitivity = 'medium'
      } = req.body;

      const graph = await dependencyGraphEngine.buildDependencyGraph(workflowId, {
        enableCircularDependencyDetection,
        enableChangeHashing,
        enableCacheInvalidation,
        enableRealTimeUpdates,
        maxDependencyDepth,
        changeDetectionSensitivity
      });

      res.json({
        success: true,
        data: {
          workflowId: graph.workflowId,
          totalNodes: graph.nodes.size,
          totalEdges: Array.from(graph.edges.values()).reduce((sum, edges) => sum + edges.size, 0),
          topologicalOrder: graph.topologicalOrder,
          circularDependencies: graph.circularDependencies,
          lastComputed: graph.lastComputed,
          nodes: Array.from(graph.nodes.entries()).map(([id, node]) => ({
            id,
            nodeId: node.nodeId,
            dependencies: node.dependencies,
            dependents: node.dependents,
            lastUpdated: node.lastUpdated,
            hash: node.hash
          }))
        },
        message: 'Dependency graph built successfully'
      });
    } catch (error) {
      logger.error('Error building dependency graph:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to build dependency graph',
        code: 'BUILD_GRAPH_ERROR'
      });
    }
  }

  /**
   * Detect changes in a node
   */
  async detectNodeChanges(req: Request, res: Response): Promise<void> {
    try {
      const { workflowId, nodeId } = req.params;
      const { currentNodeData, previousNodeData } = req.body;

      const changeResult = await dependencyGraphEngine.detectNodeChanges(
        workflowId,
        nodeId,
        currentNodeData,
        previousNodeData
      );

      res.json({
        success: true,
        data: changeResult,
        message: 'Node changes detected successfully'
      });
    } catch (error) {
      logger.error('Error detecting node changes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to detect node changes',
        code: 'DETECT_CHANGES_ERROR'
      });
    }
  }

  /**
   * Invalidate dependent nodes
   */
  async invalidateDependents(req: Request, res: Response): Promise<void> {
    try {
      const { workflowId, nodeId } = req.params;
      const { 
        changeType, 
        reason, 
        metadata = {} 
      } = req.body;

      if (!['content', 'config', 'connection', 'deletion'].includes(changeType)) {
        res.status(400).json({
          success: false,
          error: 'Invalid change type. Must be: content, config, connection, or deletion',
          code: 'INVALID_CHANGE_TYPE'
        });
        return;
      }

      const invalidationEvent = await dependencyGraphEngine.invalidateDependents(
        workflowId,
        nodeId,
        changeType,
        reason,
        metadata
      );

      // Broadcast invalidation to connected clients
      if (this.io) {
        this.io.emit('nodes-invalidated', {
          workflowId,
          nodeId,
          changeType,
          affectedNodes: invalidationEvent.affectedNodes,
          cascadeNodes: invalidationEvent.cascadeNodes,
          invalidationId: invalidationEvent.id,
          timestamp: invalidationEvent.timestamp
        });

        // Send specific notifications to affected nodes
        const allAffectedNodes = [...invalidationEvent.affectedNodes, ...invalidationEvent.cascadeNodes];
        allAffectedNodes.forEach(affectedNodeId => {
          this.io.emit(`node-invalidated:${affectedNodeId}`, {
            workflowId,
            sourceNodeId: nodeId,
            changeType,
            reason,
            invalidationId: invalidationEvent.id,
            timestamp: invalidationEvent.timestamp
          });
        });
      }

      res.json({
        success: true,
        data: {
          invalidationId: invalidationEvent.id,
          workflowId,
          nodeId,
          changeType,
          affectedNodes: invalidationEvent.affectedNodes,
          cascadeNodes: invalidationEvent.cascadeNodes,
          totalAffected: invalidationEvent.affectedNodes.length + invalidationEvent.cascadeNodes.length,
          timestamp: invalidationEvent.timestamp
        },
        message: 'Dependents invalidated successfully'
      });
    } catch (error) {
      logger.error('Error invalidating dependents:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to invalidate dependents',
        code: 'INVALIDATE_DEPENDENTS_ERROR'
      });
    }
  }

  /**
   * Create recomputation plan
   */
  async createRecomputationPlan(req: Request, res: Response): Promise<void> {
    try {
      const { workflowId } = req.params;
      const { invalidationEvent, options = {} } = req.body;

      if (!invalidationEvent) {
        res.status(400).json({
          success: false,
          error: 'Invalidation event is required',
          code: 'MISSING_INVALIDATION_EVENT'
        });
        return;
      }

      const plan = await dependencyGraphEngine.createRecomputationPlan(
        workflowId,
        invalidationEvent,
        {
          prioritizeCritical: options.prioritizeCritical ?? true,
          enableParallelExecution: options.enableParallelExecution ?? true,
          maxParallelNodes: options.maxParallelNodes ?? 5
        }
      );

      res.json({
        success: true,
        data: {
          planId: plan.id,
          workflowId,
          rootCauseNodeId: plan.rootCauseNodeId,
          executionOrder: plan.executionOrder,
          parallelGroups: plan.parallelGroups,
          estimatedCost: plan.estimatedCost,
          priority: plan.priority,
          createdAt: plan.createdAt
        },
        message: 'Recomputation plan created successfully'
      });
    } catch (error) {
      logger.error('Error creating recomputation plan:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create recomputation plan',
        code: 'CREATE_PLAN_ERROR'
      });
    }
  }

  /**
   * Execute recomputation plan
   */
  async executeRecomputationPlan(req: Request, res: Response): Promise<void> {
    try {
      const { planId } = req.params;
      const { plan, options = {} } = req.body;

      if (!plan) {
        res.status(400).json({
          success: false,
          error: 'Recomputation plan is required',
          code: 'MISSING_PLAN'
        });
        return;
      }

      // Start execution asynchronously
      const executionPromise = dependencyGraphEngine.executeRecomputationPlan(plan, {
        enableProgressTracking: options.enableProgressTracking ?? true,
        enableRollback: options.enableRollback ?? true,
        batchSize: options.batchSize ?? 10
      });

      // Respond immediately with execution started
      res.json({
        success: true,
        data: {
          planId: plan.id,
          workflowId: plan.workflowId,
          status: 'started',
          totalNodes: plan.executionOrder.length,
          parallelGroups: plan.parallelGroups.length,
          estimatedCost: plan.estimatedCost
        },
        message: 'Recomputation plan execution started'
      });

      // Execute in background and broadcast results
      executionPromise
        .then(async (result) => {
          if (this.io) {
            this.io.emit(`recomputation-completed:${planId}`, {
              planId,
              workflowId: plan.workflowId,
              success: result.success,
              executedNodes: result.executedNodes,
              failedNodes: result.failedNodes,
              executionTime: result.executionTime,
              errors: result.errors,
              completedAt: new Date()
            });
          }
          
          logger.info(`Recomputation plan ${planId} completed. Success: ${result.success}`);
        })
        .catch(async (error) => {
          if (this.io) {
            this.io.emit(`recomputation-failed:${planId}`, {
              planId,
              workflowId: plan.workflowId,
              error: error.message,
              failedAt: new Date()
            });
          }
          
          logger.error(`Recomputation plan ${planId} failed:`, error);
        });

    } catch (error) {
      logger.error('Error executing recomputation plan:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute recomputation plan',
        code: 'EXECUTE_PLAN_ERROR'
      });
    }
  }

  /**
   * Get dependency statistics for a workflow
   */
  async getDependencyStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { workflowId } = req.params;

      const statistics = await dependencyGraphEngine.getDependencyStatistics(workflowId);

      res.json({
        success: true,
        data: statistics,
        message: 'Dependency statistics retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting dependency statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get dependency statistics',
        code: 'GET_STATISTICS_ERROR'
      });
    }
  }

  /**
   * Get invalidation history for a workflow
   */
  async getInvalidationHistory(req: Request, res: Response): Promise<void> {
    try {
      const { workflowId } = req.params;
      const { limit = 50, offset = 0, nodeId, changeType } = req.query;

      // This would typically query a database table for invalidation history
      // For now, we'll return a mock response
      const history = {
        invalidations: [],
        total: 0,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      };

      res.json({
        success: true,
        data: history,
        message: 'Invalidation history retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting invalidation history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get invalidation history',
        code: 'GET_HISTORY_ERROR'
      });
    }
  }

  /**
   * Get recomputation progress
   */
  async getRecomputationProgress(req: Request, res: Response): Promise<void> {
    try {
      const { planId } = req.params;

      // This would typically get progress from Redis or a progress tracking system
      // For now, we'll return a mock response
      const progress = {
        planId,
        status: 'running',
        completedNodes: 0,
        totalNodes: 0,
        currentGroup: 0,
        totalGroups: 0,
        estimatedTimeRemaining: 0,
        startTime: new Date(),
        lastUpdate: new Date()
      };

      res.json({
        success: true,
        data: progress,
        message: 'Recomputation progress retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting recomputation progress:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get recomputation progress',
        code: 'GET_PROGRESS_ERROR'
      });
    }
  }

  /**
   * Cancel recomputation plan
   */
  async cancelRecomputationPlan(req: Request, res: Response): Promise<void> {
    try {
      const { planId } = req.params;

      // This would implement cancellation logic
      // For now, we'll just acknowledge the request

      if (this.io) {
        this.io.emit(`recomputation-cancelled:${planId}`, {
          planId,
          cancelledAt: new Date()
        });
      }

      res.json({
        success: true,
        data: { planId, cancelled: true },
        message: 'Recomputation plan cancelled successfully'
      });
    } catch (error) {
      logger.error('Error cancelling recomputation plan:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel recomputation plan',
        code: 'CANCEL_PLAN_ERROR'
      });
    }
  }

  /**
   * Bulk invalidate multiple nodes
   */
  async bulkInvalidateNodes(req: Request, res: Response): Promise<void> {
    try {
      const { workflowId } = req.params;
      const { nodeIds, changeType, reason, metadata = {} } = req.body;

      if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Node IDs array is required and cannot be empty',
          code: 'INVALID_NODE_IDS'
        });
        return;
      }

      const invalidationEvents = [];
      const allAffectedNodes = new Set<string>();
      const allCascadeNodes = new Set<string>();

      // Process each node
      for (const nodeId of nodeIds) {
        try {
          const invalidationEvent = await dependencyGraphEngine.invalidateDependents(
            workflowId,
            nodeId,
            changeType,
            reason,
            { ...metadata, bulkOperation: true }
          );

          invalidationEvents.push(invalidationEvent);
          invalidationEvent.affectedNodes.forEach(id => allAffectedNodes.add(id));
          invalidationEvent.cascadeNodes.forEach(id => allCascadeNodes.add(id));
        } catch (error) {
          logger.error(`Error invalidating node ${nodeId}:`, error);
        }
      }

      // Broadcast bulk invalidation
      if (this.io) {
        this.io.emit('bulk-nodes-invalidated', {
          workflowId,
          sourceNodeIds: nodeIds,
          changeType,
          reason,
          invalidationEvents: invalidationEvents.map(e => e.id),
          totalAffected: allAffectedNodes.size + allCascadeNodes.size,
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        data: {
          workflowId,
          sourceNodeIds: nodeIds,
          changeType,
          reason,
          invalidationEvents: invalidationEvents.map(e => ({
            id: e.id,
            nodeId: e.nodeId,
            affectedNodes: e.affectedNodes,
            cascadeNodes: e.cascadeNodes
          })),
          totalInvalidations: invalidationEvents.length,
          totalAffectedNodes: allAffectedNodes.size,
          totalCascadeNodes: allCascadeNodes.size,
          totalAffected: allAffectedNodes.size + allCascadeNodes.size
        },
        message: 'Bulk invalidation completed successfully'
      });
    } catch (error) {
      logger.error('Error in bulk invalidation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform bulk invalidation',
        code: 'BULK_INVALIDATION_ERROR'
      });
    }
  }

  /**
   * Validate dependency graph integrity
   */
  async validateDependencyGraph(req: Request, res: Response): Promise<void> {
    try {
      const { workflowId } = req.params;

      const graph = await dependencyGraphEngine.buildDependencyGraph(workflowId);
      
      const validation = {
        isValid: true,
        issues: [] as string[],
        warnings: [] as string[],
        statistics: {
          totalNodes: graph.nodes.size,
          totalEdges: Array.from(graph.edges.values()).reduce((sum, edges) => sum + edges.size, 0),
          circularDependencies: graph.circularDependencies.length,
          isolatedNodes: 0,
          maxDependencyDepth: 0
        }
      };

      // Check for circular dependencies
      if (graph.circularDependencies.length > 0) {
        validation.isValid = false;
        validation.issues.push(`Found ${graph.circularDependencies.length} circular dependencies`);
      }

      // Check for isolated nodes (nodes with no dependencies or dependents)
      for (const [nodeId, nodeDep] of graph.nodes.entries()) {
        if (nodeDep.dependencies.length === 0 && nodeDep.dependents.length === 0) {
          validation.warnings.push(`Node ${nodeId} is isolated (no dependencies or dependents)`);
          validation.statistics.isolatedNodes++;
        }
      }

      // Check for nodes with excessive dependencies
      for (const [nodeId, nodeDep] of graph.nodes.entries()) {
        if (nodeDep.dependencies.length > 10) {
          validation.warnings.push(`Node ${nodeId} has ${nodeDep.dependencies.length} dependencies (consider refactoring)`);
        }
        if (nodeDep.dependents.length > 20) {
          validation.warnings.push(`Node ${nodeId} has ${nodeDep.dependents.length} dependents (performance impact)`);
        }
      }

      res.json({
        success: true,
        data: validation,
        message: validation.isValid ? 'Dependency graph is valid' : 'Dependency graph has issues'
      });
    } catch (error) {
      logger.error('Error validating dependency graph:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate dependency graph',
        code: 'VALIDATE_GRAPH_ERROR'
      });
    }
  }

  /**
   * Optimize dependency graph
   */
  async optimizeDependencyGraph(req: Request, res: Response): Promise<void> {
    try {
      const { workflowId } = req.params;
      const { optimizationLevel = 'medium' } = req.body;

      const graph = await dependencyGraphEngine.buildDependencyGraph(workflowId);
      
      const optimizations = {
        suggestions: [] as string[],
        potentialImprovements: {
          parallelization: [] as string[],
          caching: [] as string[],
          restructuring: [] as string[]
        },
        estimatedImpact: {
          performanceImprovement: 0,
          complexityReduction: 0,
          maintenanceBenefit: 0
        }
      };

      // Analyze graph for optimization opportunities
      for (const [nodeId, nodeDep] of graph.nodes.entries()) {
        // Suggest parallelization opportunities
        if (nodeDep.dependencies.length === 0 && nodeDep.dependents.length > 1) {
          const parallelizableNodes = nodeDep.dependents.filter(depId => {
            const depNode = graph.nodes.get(depId);
            return depNode && depNode.dependencies.length === 1;
          });
          
          if (parallelizableNodes.length > 1) {
            optimizations.potentialImprovements.parallelization.push(
              `Nodes ${parallelizableNodes.join(', ')} can be executed in parallel`
            );
          }
        }

        // Suggest caching opportunities
        if (nodeDep.dependents.length > 5) {
          optimizations.potentialImprovements.caching.push(
            `Consider caching output of node ${nodeId} (used by ${nodeDep.dependents.length} dependents)`
          );
        }

        // Suggest restructuring for complex nodes
        if (nodeDep.dependencies.length > 8) {
          optimizations.potentialImprovements.restructuring.push(
            `Consider breaking down node ${nodeId} (has ${nodeDep.dependencies.length} dependencies)`
          );
        }
      }

      // Calculate estimated impact
      optimizations.estimatedImpact.performanceImprovement = 
        optimizations.potentialImprovements.parallelization.length * 15 +
        optimizations.potentialImprovements.caching.length * 25;
      
      optimizations.estimatedImpact.complexityReduction = 
        optimizations.potentialImprovements.restructuring.length * 20;
      
      optimizations.estimatedImpact.maintenanceBenefit = 
        (optimizations.potentialImprovements.parallelization.length +
         optimizations.potentialImprovements.caching.length +
         optimizations.potentialImprovements.restructuring.length) * 10;

      res.json({
        success: true,
        data: optimizations,
        message: 'Dependency graph optimization analysis completed'
      });
    } catch (error) {
      logger.error('Error optimizing dependency graph:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to optimize dependency graph',
        code: 'OPTIMIZE_GRAPH_ERROR'
      });
    }
  }
}

export const dependencyController = new DependencyController();