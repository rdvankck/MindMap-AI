import { Router } from 'express';
import { dependencyController } from '@/controllers/dependencyController';
import { authMiddleware } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route GET /api/dependencies/:workflowId/graph
 * @desc Build dependency graph for a workflow
 * @access Private
 */
router.get(
  '/:workflowId/graph',
  [
    param('workflowId').isUUID().withMessage('Invalid workflow ID'),
    body('enableCircularDependencyDetection').optional().isBoolean(),
    body('enableChangeHashing').optional().isBoolean(),
    body('enableCacheInvalidation').optional().isBoolean(),
    body('enableRealTimeUpdates').optional().isBoolean(),
    body('maxDependencyDepth').optional().isInt({ min: 1, max: 100 }),
    body('changeDetectionSensitivity').optional().isIn(['low', 'medium', 'high'])
  ],
  validateRequest,
  (req, res) => dependencyController.buildDependencyGraph(req as any, res as any)
);

/**
 * @route POST /api/dependencies/:workflowId/:nodeId/detect-changes
 * @desc Detect changes in a node
 * @access Private
 */
router.post(
  '/:workflowId/:nodeId/detect-changes',
  [
    param('workflowId').isUUID().withMessage('Invalid workflow ID'),
    param('nodeId').isUUID().withMessage('Invalid node ID'),
    body('currentNodeData').isObject().withMessage('Current node data is required'),
    body('previousNodeData').optional().isObject()
  ],
  validateRequest,
  (req, res) => dependencyController.detectNodeChanges(req as any, res as any)
);

/**
 * @route POST /api/dependencies/:workflowId/:nodeId/invalidate
 * @desc Invalidate dependent nodes
 * @access Private
 */
router.post(
  '/:workflowId/:nodeId/invalidate',
  [
    param('workflowId').isUUID().withMessage('Invalid workflow ID'),
    param('nodeId').isUUID().withMessage('Invalid node ID'),
    body('changeType').isIn(['content', 'config', 'connection', 'deletion'])
      .withMessage('Invalid change type'),
    body('reason').isString().isLength({ min: 1, max: 500 })
      .withMessage('Reason is required (1-500 characters)'),
    body('metadata').optional().isObject()
  ],
  validateRequest,
  (req, res) => dependencyController.invalidateDependents(req as any, res as any)
);

/**
 * @route POST /api/dependencies/:workflowId/recomputation-plan
 * @desc Create recomputation plan
 * @access Private
 */
router.post(
  '/:workflowId/recomputation-plan',
  [
    param('workflowId').isUUID().withMessage('Invalid workflow ID'),
    body('invalidationEvent').isObject().withMessage('Invalidation event is required'),
    body('options.prioritizeCritical').optional().isBoolean(),
    body('options.enableParallelExecution').optional().isBoolean(),
    body('options.maxParallelNodes').optional().isInt({ min: 1, max: 20 })
  ],
  validateRequest,
  (req, res) => dependencyController.createRecomputationPlan(req as any, res as any)
);

/**
 * @route POST /api/dependencies/recomputation/:planId/execute
 * @desc Execute recomputation plan
 * @access Private
 */
router.post(
  '/recomputation/:planId/execute',
  [
    param('planId').isString().isLength({ min: 1 })
      .withMessage('Invalid plan ID'),
    body('plan').isObject().withMessage('Recomputation plan is required'),
    body('options.enableProgressTracking').optional().isBoolean(),
    body('options.enableRollback').optional().isBoolean(),
    body('options.batchSize').optional().isInt({ min: 1, max: 100 })
  ],
  validateRequest,
  (req, res) => dependencyController.executeRecomputationPlan(req as any, res as any)
);

/**
 * @route GET /api/dependencies/:workflowId/statistics
 * @desc Get dependency statistics for a workflow
 * @access Private
 */
router.get(
  '/:workflowId/statistics',
  [
    param('workflowId').isUUID().withMessage('Invalid workflow ID')
  ],
  validateRequest,
  (req, res) => dependencyController.getDependencyStatistics(req as any, res as any)
);

/**
 * @route GET /api/dependencies/:workflowId/invalidation-history
 * @desc Get invalidation history for a workflow
 * @access Private
 */
router.get(
  '/:workflowId/invalidation-history',
  [
    param('workflowId').isUUID().withMessage('Invalid workflow ID'),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('offset').optional().isInt({ min: 0 }),
    query('nodeId').optional().isUUID(),
    query('changeType').optional().isIn(['content', 'config', 'connection', 'deletion'])
  ],
  validateRequest,
  (req, res) => dependencyController.getInvalidationHistory(req as any, res as any)
);

/**
 * @route GET /api/dependencies/recomputation/:planId/progress
 * @desc Get recomputation progress
 * @access Private
 */
router.get(
  '/recomputation/:planId/progress',
  [
    param('planId').isString().isLength({ min: 1 })
      .withMessage('Invalid plan ID')
  ],
  validateRequest,
  (req, res) => dependencyController.getRecomputationProgress(req as any, res as any)
);

/**
 * @route DELETE /api/dependencies/recomputation/:planId/cancel
 * @desc Cancel recomputation plan
 * @access Private
 */
router.delete(
  '/recomputation/:planId/cancel',
  [
    param('planId').isString().isLength({ min: 1 })
      .withMessage('Invalid plan ID')
  ],
  validateRequest,
  (req, res) => dependencyController.cancelRecomputationPlan(req as any, res as any)
);

/**
 * @route POST /api/dependencies/:workflowId/bulk-invalidate
 * @desc Bulk invalidate multiple nodes
 * @access Private
 */
router.post(
  '/:workflowId/bulk-invalidate',
  [
    param('workflowId').isUUID().withMessage('Invalid workflow ID'),
    body('nodeIds').isArray({ min: 1 }).withMessage('Node IDs array is required'),
    body('nodeIds.*').isUUID().withMessage('Invalid node ID in array'),
    body('changeType').isIn(['content', 'config', 'connection', 'deletion'])
      .withMessage('Invalid change type'),
    body('reason').isString().isLength({ min: 1, max: 500 })
      .withMessage('Reason is required (1-500 characters)'),
    body('metadata').optional().isObject()
  ],
  validateRequest,
  (req, res) => dependencyController.bulkInvalidateNodes(req as any, res as any)
);

/**
 * @route GET /api/dependencies/:workflowId/validate
 * @desc Validate dependency graph integrity
 * @access Private
 */
router.get(
  '/:workflowId/validate',
  [
    param('workflowId').isUUID().withMessage('Invalid workflow ID')
  ],
  validateRequest,
  (req, res) => dependencyController.validateDependencyGraph(req as any, res as any)
);

/**
 * @route POST /api/dependencies/:workflowId/optimize
 * @desc Optimize dependency graph
 * @access Private
 */
router.post(
  '/:workflowId/optimize',
  [
    param('workflowId').isUUID().withMessage('Invalid workflow ID'),
    body('optimizationLevel').optional().isIn(['low', 'medium', 'high'])
      .withMessage('Invalid optimization level')
  ],
  validateRequest,
  (req, res) => dependencyController.optimizeDependencyGraph(req as any, res as any)
);

export default router;