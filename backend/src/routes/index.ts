import { Router } from 'express';
import conversationRoutes from './conversationRoutes';
import dependencyRoutes from './dependencyRoutes';
import { recomputationRoutes } from './recomputationRoutes';
import llmRoutes from './llmRoutes';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API version
router.get('/version', (req, res) => {
  res.json({
    version: '1.0.0',
    apiVersion: 'v1',
    timestamp: new Date().toISOString(),
  });
});

// Mount conversation routes
router.use('/conversations', conversationRoutes);

// Mount dependency routes
router.use('/dependencies', dependencyRoutes);

// Mount re-computation routes
router.use('/recomputation', recomputationRoutes);

// Mount LLM routes
router.use('/llm', llmRoutes);

// Default route
router.get('/', (req, res) => {
  res.json({
    message: 'LLM Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      version: '/version',
      conversations: '/conversations',
      dependencies: '/dependencies',
      recomputation: '/recomputation',
      llm: '/llm',
    },
  });
});

export const setupRoutes = (): Router => {
  return router;
};