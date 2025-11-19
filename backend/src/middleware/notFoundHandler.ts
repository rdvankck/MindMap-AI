import { Request, Response } from 'express';
import { logger } from '@/utils/logger';

/**
 * 404 Not Found handler middleware
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const error = {
    success: false,
    error: 'Route not found',
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    availableRoutes: [
      'GET /health',
      'GET /api/*',
      'POST /api/*',
      'PUT /api/*',
      'DELETE /api/*',
    ],
  };

  logger.warn('404 Not Found:', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.status(404).json(error);
};