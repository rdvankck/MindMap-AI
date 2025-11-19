import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { config } from '@/config';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
  details?: any;
}

/**
 * Custom Error class for application errors
 */
export class CustomError extends Error implements AppError {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.name = 'CustomError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let { statusCode = 500, code = 'INTERNAL_ERROR', message, details } = error;

  // Log error details
  const errorLog = {
    message: error.message,
    stack: error.stack,
    statusCode,
    code,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
    timestamp: new Date().toISOString(),
  };

  if (statusCode >= 500) {
    logger.error('Server error:', errorLog);
  } else {
    logger.warn('Client error:', errorLog);
  }

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Invalid ID format';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token expired';
  } else if (error.name === 'MulterError') {
    statusCode = 400;
    code = 'FILE_UPLOAD_ERROR';
    if (error.message.includes('File too large')) {
      message = 'File size exceeds limit';
    } else if (error.message.includes('Unexpected field')) {
      message = 'Invalid file field name';
    }
  }

  // Prepare error response
  const errorResponse: any = {
    success: false,
    error: message || 'Internal server error',
    code,
    timestamp: new Date().toISOString(),
  };

  // Include details in development environment
  if (config.env === 'development') {
    errorResponse.details = details || error.stack;
    errorResponse.debug = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      query: req.query,
      params: req.params,
    };
  } else {
    // Include sanitized details in production
    if (details && typeof details === 'object') {
      const sanitizedDetails = { ...details };
      // Remove sensitive information
      delete sanitizedDetails.password;
      delete sanitizedDetails.token;
      delete sanitizedDetails.apiKey;
      errorResponse.details = sanitizedDetails;
    }
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const error = {
    success: false,
    error: 'Route not found',
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
  };

  logger.warn('404 Not Found:', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.status(404).json(error);
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error handler
 */
export const validationErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error.name === 'ValidationError' || error.code === 'VALIDATION_ERROR') {
    const statusCode = 400;
    const code = 'VALIDATION_ERROR';
    
    let details: any[] = [];
    
    if (error.errors) {
      // Mongoose validation errors
      details = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message,
        value: error.errors[key].value,
      }));
    } else if (error.details) {
      // Zod validation errors
      details = error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
    }

    res.status(statusCode).json({
      success: false,
      error: 'Validation failed',
      code,
      details,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next(error);
};

/**
 * Rate limit error handler
 */
export const rateLimitHandler = (
  req: Request,
  res: Response
): void => {
  const error = {
    success: false,
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString(),
    retryAfter: res.get('Retry-After') || '60',
  };

  logger.warn('Rate limit exceeded:', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.status(429).json(error);
};