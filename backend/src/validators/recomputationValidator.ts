import { z } from 'zod';

export const createRecomputationSchema = z.object({
  workflowId: z.string().uuid('Invalid workflow ID format'),
  invalidationEventId: z.string().uuid('Invalid invalidation event ID format').optional(),
  nodeId: z.string().uuid('Invalid node ID format').optional(),
  changeType: z.enum(['CONTENT', 'CONFIG', 'CONNECTION', 'DELETION'], {
    errorMap: () => ({ message: 'Change type must be one of: CONTENT, CONFIG, CONNECTION, DELETION' })
  }).optional(),
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long').optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
    errorMap: () => ({ message: 'Priority must be one of: LOW, MEDIUM, HIGH, CRITICAL' })
  }).optional(),
  enableParallelExecution: z.boolean().optional(),
  maxBatchSize: z.number().int().min(1, 'Batch size must be at least 1').max(100, 'Batch size cannot exceed 100').optional(),
  metadata: z.record(z.any()).optional()
}).refine(
  (data) => data.invalidationEventId || data.nodeId,
  {
    message: 'Either invalidationEventId or nodeId must be provided',
    path: ['nodeId']
  }
);

export const getPlansSchema = z.object({
  workflowId: z.string().uuid('Invalid workflow ID format').optional(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED'], {
    errorMap: () => ({ message: 'Invalid status value' })
  }).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
    errorMap: () => ({ message: 'Invalid priority value' })
  }).optional(),
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'status'], {
    errorMap: () => ({ message: 'Invalid sort field' })
  }).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc'], {
    errorMap: () => ({ message: 'Sort order must be asc or desc' })
  }).default('desc')
});

export const batchRecomputeSchema = z.object({
  workflowId: z.string().uuid('Invalid workflow ID format'),
  nodeIds: z.array(z.string().uuid('Invalid node ID format'))
    .min(1, 'At least one node ID is required')
    .max(50, 'Cannot process more than 50 nodes at once'),
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long').optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
    errorMap: () => ({ message: 'Priority must be one of: LOW, MEDIUM, HIGH, CRITICAL' })
  }).optional(),
  enableParallelExecution: z.boolean().optional(),
  batchId: z.string().optional()
});

export const updatePlanSchema = z.object({
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
    errorMap: () => ({ message: 'Priority must be one of: LOW, MEDIUM, HIGH, CRITICAL' })
  }).optional(),
  metadata: z.record(z.any()).optional()
});

export const planActionSchema = z.object({
  action: z.enum(['cancel', 'pause', 'resume', 'retry'], {
    errorMap: () => ({ message: 'Action must be one of: cancel, pause, resume, retry' })
  }),
  reason: z.string().max(500, 'Reason too long').optional()
});

export const cleanupSchema = z.object({
  olderThan: z.coerce.number().int().min(1, 'Must delete plans older than at least 1 day').max(90, 'Cannot delete plans older than 90 days').default(7),
  status: z.array(z.enum(['COMPLETED', 'FAILED', 'CANCELLED'])).optional()
});

export const queueStatsSchema = z.object({
  includeDetails: z.boolean().default(false)
});

export const progressQuerySchema = z.object({
  planId: z.string().uuid('Invalid plan ID format'),
  includeExecutions: z.boolean().default(false),
  includeErrors: z.boolean().default(true)
});

// Validation middleware factory
export const validate = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      if (req.body) {
        req.body = schema.parse(req.body);
      }
      if (req.query) {
        req.query = schema.parse(req.query);
      }
      if (req.params) {
        req.params = schema.parse(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
};

// Validation middleware for query parameters
export const validateQuery = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Query validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
};

// Validation middleware for request parameters
export const validateParams = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Parameter validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
};