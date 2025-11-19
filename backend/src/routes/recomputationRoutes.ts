import { Router, Request, Response } from 'express';
import { recomputationController } from '@/controllers/recomputationController';
import { validate, validateQuery, validateParams } from '@/validators/recomputationValidator';
import { authMiddleware } from '@/middleware/auth';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import {
  createRecomputationSchema,
  getPlansSchema,
  batchRecomputeSchema,
  updatePlanSchema,
  planActionSchema,
  cleanupSchema,
  queueStatsSchema,
  progressQuerySchema
} from '@/validators/recomputationValidator';

const router = Router();

// Apply authentication to all routes
router.use(authMiddleware);

// Rate limiting for re-computation operations
const recomputationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: 'Too many re-computation requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const batchRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 batch requests per windowMs
  message: 'Too many batch re-computation requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Re-computation plan routes
router.post('/plans', 
  recomputationRateLimit,
  validate(createRecomputationSchema),
  recomputationController.createRecomputation
);

router.get('/plans',
  validateQuery(getPlansSchema),
  recomputationController.getPlans
);

router.get('/plans/queue/stats',
  recomputationController.getQueueStatistics
);

router.post('/plans/batch',
  batchRateLimit,
  validate(batchRecomputeSchema),
  recomputationController.batchRecompute
);

router.delete('/plans/cleanup',
  validateQuery(cleanupSchema),
  recomputationController.cleanupPlans
);

// Specific plan routes
router.get('/plans/:planId',
  validateParams(z.object({ planId: z.string().uuid() })),
  recomputationController.getPlan
);

router.get('/plans/:planId/progress',
  validateParams(z.object({ planId: z.string().uuid() })),
  validateQuery(progressQuerySchema),
  recomputationController.getPlanProgress
);

router.post('/plans/:planId/cancel',
  validateParams(z.object({ planId: z.string().uuid() })),
  validate(planActionSchema.partial().omit({ action: true })),
  recomputationController.cancelPlan
);

router.post('/plans/:planId/pause',
  validateParams(z.object({ planId: z.string().uuid() })),
  validate(planActionSchema.partial().omit({ action: true })),
  recomputationController.pausePlan
);

router.post('/plans/:planId/resume',
  validateParams(z.object({ planId: z.string().uuid() })),
  validate(planActionSchema.partial().omit({ action: true })),
  recomputationController.resumePlan
);

router.post('/plans/:planId/retry',
  validateParams(z.object({ planId: z.string().uuid() })),
  validate(planActionSchema.partial().omit({ action: true })),
  recomputationController.retryPlan
);

router.put('/plans/:planId',
  validateParams(z.object({ planId: z.string().uuid() })),
  validate(updatePlanSchema),
  async (req: Request, res: Response) => {
    // Implementation for updating plan metadata
    res.status(501).json({ error: 'Not implemented yet' });
  }
);

// Legacy route compatibility
router.post('/recompute',
  recomputationRateLimit,
  validate(createRecomputationSchema),
  recomputationController.createRecomputation
);

router.post('/recompute/batch',
  batchRateLimit,
  validate(batchRecomputeSchema),
  recomputationController.batchRecompute
);

router.get('/recompute/status/:planId',
  validateParams(z.object({ planId: z.string().uuid() })),
  recomputationController.getPlanProgress
);

router.post('/recompute/:planId/cancel',
  validateParams(z.object({ planId: z.string().uuid() })),
  recomputationController.cancelPlan
);

export { router as recomputationRoutes };