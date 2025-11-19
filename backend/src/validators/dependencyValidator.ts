import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Zod schemas for dependency validation
export const dependencyValidationSchemas = {
  // Build dependency graph
  buildDependencyGraph: z.object({
    enableCircularDependencyDetection: z.boolean().optional().default(true),
    enableChangeHashing: z.boolean().optional().default(true),
    enableCacheInvalidation: z.boolean().optional().default(true),
    enableRealTimeUpdates: z.boolean().optional().default(false),
    maxDependencyDepth: z.number().int().min(1).max(100).optional().default(50),
    changeDetectionSensitivity: z.enum(['low', 'medium', 'high']).optional().default('medium')
  }),

  // Detect node changes
  detectNodeChanges: z.object({
    currentNodeData: z.record(z.any()).refine(
      (data) => data && typeof data === 'object' && 'id' in data,
      { message: 'Current node data must be a valid object with an id property' }
    ),
    previousNodeData: z.record(z.any()).optional()
  }),

  // Invalidate dependents
  invalidateDependents: z.object({
    changeType: z.enum(['content', 'config', 'connection', 'deletion'], {
      errorMap: () => ({ message: 'Change type must be one of: content, config, connection, deletion' })
    }),
    reason: z.string().min(1).max(500, {
      message: 'Reason must be between 1 and 500 characters'
    }),
    metadata: z.record(z.any()).optional().default({})
  }),

  // Create recomputation plan
  createRecomputationPlan: z.object({
    invalidationEvent: z.object({
      id: z.string().min(1),
      workflowId: z.string().uuid(),
      nodeId: z.string().uuid(),
      changeType: z.enum(['content', 'config', 'connection', 'deletion']),
      reason: z.string().min(1),
      affectedNodes: z.array(z.string().uuid()),
      cascadeNodes: z.array(z.string().uuid()),
      timestamp: z.string().datetime(),
      metadata: z.record(z.any()).optional()
    }),
    options: z.object({
      prioritizeCritical: z.boolean().optional().default(true),
      enableParallelExecution: z.boolean().optional().default(true),
      maxParallelNodes: z.number().int().min(1).max(20).optional().default(5)
    }).optional().default({})
  }),

  // Execute recomputation plan
  executeRecomputationPlan: z.object({
    plan: z.object({
      id: z.string().min(1),
      workflowId: z.string().uuid(),
      rootCauseNodeId: z.string().uuid(),
      invalidationEvents: z.array(z.any()),
      executionOrder: z.array(z.string().uuid()),
      parallelGroups: z.array(z.array(z.string().uuid())),
      estimatedCost: z.object({
        nodes: z.number().int().min(0),
        tokens: z.number().int().min(0),
        timeMs: z.number().int().min(0)
      }),
      priority: z.enum(['low', 'medium', 'high', 'critical']),
      createdAt: z.string().datetime()
    }),
    options: z.object({
      enableProgressTracking: z.boolean().optional().default(true),
      enableRollback: z.boolean().optional().default(true),
      batchSize: z.number().int().min(1).max(100).optional().default(10)
    }).optional().default({})
  }),

  // Bulk invalidate nodes
  bulkInvalidateNodes: z.object({
    nodeIds: z.array(z.string().uuid()).min(1, {
      message: 'At least one node ID must be provided'
    }),
    changeType: z.enum(['content', 'config', 'connection', 'deletion']),
    reason: z.string().min(1).max(500),
    metadata: z.record(z.any()).optional().default({})
  }),

  // Optimize dependency graph
  optimizeDependencyGraph: z.object({
    optimizationLevel: z.enum(['low', 'medium', 'high']).optional().default('medium')
  })
};

/**
 * Middleware to validate dependency-related requests
 */
export const validateDependencyRequest = (schemaName: keyof typeof dependencyValidationSchemas) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = dependencyValidationSchemas[schemaName];
      const result = schema.safeParse(req.body);

      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors
        });
      }

      // Replace request body with validated data
      req.body = result.data;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Validation error occurred',
        code: 'VALIDATION_PROCESSING_ERROR'
      });
    }
  };
};

/**
 * Validate workflow and node UUID parameters
 */
export const validateDependencyParams = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workflowId, nodeId, planId } = req.params;

    // Validate workflow ID
    if (workflowId) {
      const workflowIdSchema = z.string().uuid('Invalid workflow ID format');
      const workflowResult = workflowIdSchema.safeParse(workflowId);
      
      if (!workflowResult.success) {
        return res.status(400).json({
          success: false,
          error: workflowResult.error.errors[0].message,
          code: 'INVALID_WORKFLOW_ID'
        });
      }
    }

    // Validate node ID
    if (nodeId) {
      const nodeIdSchema = z.string().uuid('Invalid node ID format');
      const nodeResult = nodeIdSchema.safeParse(nodeId);
      
      if (!nodeResult.success) {
        return res.status(400).json({
          success: false,
          error: nodeResult.error.errors[0].message,
          code: 'INVALID_NODE_ID'
        });
      }
    }

    // Validate plan ID (if present)
    if (planId) {
      const planIdSchema = z.string().min(1, 'Plan ID is required');
      const planResult = planIdSchema.safeParse(planId);
      
      if (!planResult.success) {
        return res.status(400).json({
          success: false,
          error: planResult.error.errors[0].message,
          code: 'INVALID_PLAN_ID'
        });
      }
    }

    // Validate query parameters
    const queryValidation = z.object({
      limit: z.coerce.number().int().min(1).max(1000).optional(),
      offset: z.coerce.number().int().min(0).optional(),
      nodeId: z.string().uuid().optional(),
      changeType: z.enum(['content', 'config', 'connection', 'deletion']).optional(),
      optimizationLevel: z.enum(['low', 'medium', 'high']).optional()
    });

    const queryResult = queryValidation.safeParse(req.query);
    if (!queryResult.success) {
      const errors = queryResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        code: 'INVALID_QUERY_PARAMS',
        details: errors
      });
    }

    req.query = queryResult.data;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Parameter validation error occurred',
      code: 'PARAMETER_VALIDATION_ERROR'
    });
  }
};

/**
 * Validate dependency graph data structure
 */
export const validateDependencyGraphData = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nodes, edges } = req.body;

    if (nodes && !Array.isArray(nodes)) {
      return res.status(400).json({
        success: false,
        error: 'Nodes must be an array',
        code: 'INVALID_NODES_FORMAT'
      });
    }

    if (edges && !Array.isArray(edges)) {
      return res.status(400).json({
        success: false,
        error: 'Edges must be an array',
        code: 'INVALID_EDGES_FORMAT'
      });
    }

    // Validate node structure
    if (nodes) {
      const nodeSchema = z.object({
        id: z.string().uuid(),
        type: z.string().min(1),
        data: z.record(z.any()).optional(),
        config: z.record(z.any()).optional(),
        position: z.object({
          x: z.number(),
          y: z.number()
        }).optional()
      });

      for (let i = 0; i < nodes.length; i++) {
        const result = nodeSchema.safeParse(nodes[i]);
        if (!result.success) {
          return res.status(400).json({
            success: false,
            error: `Invalid node structure at index ${i}`,
            code: 'INVALID_NODE_STRUCTURE',
            details: result.error.errors
          });
        }
      }
    }

    // Validate edge structure
    if (edges) {
      const edgeSchema = z.object({
        id: z.string().optional(),
        source: z.string().uuid(),
        target: z.string().uuid(),
        type: z.string().optional(),
        data: z.record(z.any()).optional()
      });

      for (let i = 0; i < edges.length; i++) {
        const result = edgeSchema.safeParse(edges[i]);
        if (!result.success) {
          return res.status(400).json({
            success: false,
            error: `Invalid edge structure at index ${i}`,
            code: 'INVALID_EDGE_STRUCTURE',
            details: result.error.errors
          });
        }
      }
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Graph data validation error occurred',
      code: 'GRAPH_VALIDATION_ERROR'
    });
  }
};

/**
 * Validate invalidation event data
 */
export const validateInvalidationEvent = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { invalidationEvent } = req.body;

    if (!invalidationEvent) {
      return res.status(400).json({
        success: false,
        error: 'Invalidation event is required',
        code: 'MISSING_INVALIDATION_EVENT'
      });
    }

    const invalidationEventSchema = z.object({
      id: z.string().min(1),
      workflowId: z.string().uuid(),
      nodeId: z.string().uuid(),
      changeType: z.enum(['content', 'config', 'connection', 'deletion']),
      reason: z.string().min(1),
      affectedNodes: z.array(z.string().uuid()),
      cascadeNodes: z.array(z.string().uuid()),
      timestamp: z.string().datetime(),
      metadata: z.record(z.any()).optional()
    });

    const result = invalidationEventSchema.safeParse(invalidationEvent);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid invalidation event structure',
        code: 'INVALID_INVALIDATION_EVENT',
        details: result.error.errors
      });
    }

    // Ensure affectedNodes and cascadeNodes are not empty
    if (result.data.affectedNodes.length === 0 && result.data.cascadeNodes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalidation event must affect at least one node',
        code: 'EMPTY_INVALIDATION_EVENT'
      });
    }

    req.body.invalidationEvent = result.data;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Invalidation event validation error occurred',
      code: 'INVALIDATION_VALIDATION_ERROR'
    });
  }
};

/**
 * Validate recomputation plan execution constraints
 */
export const validateRecomputationExecution = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { plan } = req.body;

    if (!plan) {
      return res.status(400).json({
        success: false,
        error: 'Recomputation plan is required',
        code: 'MISSING_RECOMPUTATION_PLAN'
      });
    }

    // Validate that the plan has nodes to execute
    if (!plan.executionOrder || plan.executionOrder.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recomputation plan must have at least one node to execute',
        code: 'EMPTY_EXECUTION_ORDER'
      });
    }

    // Validate parallel groups consistency
    const totalNodesInGroups = plan.parallelGroups?.flat().length || 0;
    if (totalNodesInGroups !== plan.executionOrder.length) {
      return res.status(400).json({
        success: false,
        error: 'Parallel groups must contain all nodes from execution order',
        code: 'INCONSISTENT_PARALLEL_GROUPS'
      });
    }

    // Validate cost estimation
    if (plan.estimatedCost) {
      const costSchema = z.object({
        nodes: z.number().int().min(0),
        tokens: z.number().int().min(0),
        timeMs: z.number().int().min(0)
      });

      const costResult = costSchema.safeParse(plan.estimatedCost);
      if (!costResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid cost estimation format',
          code: 'INVALID_COST_ESTIMATION',
          details: costResult.error.errors
        });
      }
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Recomputation execution validation error occurred',
      code: 'RECOMPUTATION_VALIDATION_ERROR'
    });
  }
};