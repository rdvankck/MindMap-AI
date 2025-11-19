import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { config } from '@/config';

/**
 * Enhanced Error Boundary Middleware
 * 
 * This middleware provides comprehensive error handling for the application,
 * including proper logging, error classification, and user-friendly responses.
 */

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
  details?: any;
  path?: string;
  value?: any;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code?: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: any;
  requestId?: string;
  timestamp: string;
  path?: string;
}

// Error classes for different types of errors
export class ValidationError extends Error implements AppError {
  statusCode = 400;
  isOperational = true;
  errors: ValidationError[];

  constructor(message: string, errors: ValidationError[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends Error implements AppError {
  statusCode = 401;
  isOperational = true;

  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthorizationError extends Error implements AppError {
  statusCode = 403;
  isOperational = true;

  constructor(message = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends Error implements AppError {
  statusCode = 404;
  isOperational = true;

  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConflictError extends Error implements AppError {
  statusCode = 409;
  isOperational = true;

  constructor(message = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class RateLimitError extends Error implements AppError {
  statusCode = 429;
  isOperational = true;

  constructor(message = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class DatabaseError extends Error implements AppError {
  statusCode = 500;
  isOperational = false;

  constructor(message = 'Database operation failed', originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
    if (originalError) {
      this.cause = originalError;
    }
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ExternalServiceError extends Error implements AppError {
  statusCode = 502;
  isOperational = true;
  service: string;

  constructor(service: string, message = 'External service error') {
    super(message);
    this.name = 'ExternalServiceError';
    this.service = service;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class CircuitBreakerError extends Error implements AppError {
  statusCode = 503;
  isOperational = true;
  service: string;

  constructor(service: string, message = 'Service temporarily unavailable') {
    super(message);
    this.name = 'CircuitBreakerError';
    this.service = service;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Central error handler middleware
 */
export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] as string || 
                   generateRequestId();

  // Set error details on request for downstream middleware
  req.error = error;

  // Log the error
  logError(error, req, requestId);

  // Determine if this is an operational error
  const isOperational = error.isOperational ?? false;

  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: classifyError(error),
    message: getErrorMessage(error, isOperational),
    requestId,
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  // Add additional error details in development mode
  if (config.env === 'development' && isOperational) {
    errorResponse.details = {
      stack: error.stack,
      code: error.code,
      ...(error.details && { details: error.details }),
      ...(error.errors && { errors: error.errors }),
    };
  }

  // Add specific error codes
  if (error.code) {
    errorResponse.code = error.code;
  }

  // Set cache headers for error responses
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Request-ID': requestId,
  });

  // Send error response
  res.status(error.statusCode || 500).json(errorResponse);

  // In production, also send to monitoring services
  if (config.env === 'production' && !isOperational) {
    sendToMonitoring(error, req, requestId);
  }
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Error logging function
 */
function logError(error: AppError, req: Request, requestId: string): void {
  const logData = {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
    error: {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      stack: error.stack,
      isOperational: error.isOperational,
    },
  };

  if (error.statusCode && error.statusCode < 500) {
    // Client errors - log as warning
    logger.warn('Client error', logData);
  } else {
    // Server errors - log as error
    logger.error('Server error', logData);
  }
}

/**
 * Classify error type
 */
function classifyError(error: AppError): string {
  if (error instanceof ValidationError) return 'VALIDATION_ERROR';
  if (error instanceof AuthenticationError) return 'AUTHENTICATION_ERROR';
  if (error instanceof AuthorizationError) return 'AUTHORIZATION_ERROR';
  if (error instanceof NotFoundError) return 'NOT_FOUND_ERROR';
  if (error instanceof ConflictError) return 'CONFLICT_ERROR';
  if (error instanceof RateLimitError) return 'RATE_LIMIT_ERROR';
  if (error instanceof DatabaseError) return 'DATABASE_ERROR';
  if (error instanceof ExternalServiceError) return 'EXTERNAL_SERVICE_ERROR';
  if (error instanceof CircuitBreakerError) return 'CIRCUIT_BREAKER_ERROR';
  
  // Check for common error patterns
  if (error.name === 'CastError') return 'INVALID_DATA_TYPE';
  if (error.name === 'ValidationError') return 'VALIDATION_ERROR';
  if (error.name === 'MongoError') return 'DATABASE_ERROR';
  if (error.name === 'MulterError') return 'FILE_UPLOAD_ERROR';
  if (error.code === 'ECONNREFUSED') return 'CONNECTION_ERROR';
  if (error.code === 'ETIMEDOUT') return 'TIMEOUT_ERROR';
  
  return 'INTERNAL_ERROR';
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error: AppError, isOperational: boolean): string {
  if (isOperational) {
    return error.message;
  }

  // Don't expose internal error details to users
  if (config.env === 'production') {
    return 'An unexpected error occurred. Please try again later.';
  }

  return error.message || 'Internal server error';
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Send error to monitoring services
 */
function sendToMonitoring(error: AppError, req: Request, requestId: string): void {
  // This would integrate with services like Sentry, DataDog, etc.
  try {
    // Example: Send to Sentry
    if (global.Sentry) {
      global.Sentry.captureException(error, {
        tags: {
          component: 'api',
          requestId,
        },
        extra: {
          method: req.method,
          url: req.url,
          userId: (req as any).user?.id,
        },
      });
    }

    // Example: Send to custom monitoring
    logger.error('Critical error sent to monitoring', {
      requestId,
      error: error.name,
      message: error.message,
      stack: error.stack,
    });
  } catch (monitoringError) {
    logger.error('Failed to send error to monitoring', { monitoringError });
  }
}

/**
 * Graceful shutdown handler
 */
export const gracefulShutdownHandler = (signal: string) => {
  return (error: Error, req: Request, res: Response, next: NextFunction) => {
    if (req.headers['x-shutdown']) {
      res.set('Connection', 'close');
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Server is shutting down. Please try again later.',
        timestamp: new Date().toISOString(),
      });
    }
    next(error);
  };
};

/**
 * Timeout handler for long-running requests
 */
export const timeoutHandler = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          error: 'REQUEST_TIMEOUT',
          message: 'Request took too long to process',
          timestamp: new Date().toISOString(),
        });
        req.destroy();
      }
    }, timeoutMs);

    res.on('finish', () => clearTimeout(timeout));
    next();
  };
};

/**
 * Circuit breaker pattern implementation
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private options: {
      threshold: number;
      timeout: number;
      resetTimeout: number;
    }
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    serviceName: string
  ): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.options.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new CircuitBreakerError(serviceName, 'Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.options.threshold) {
      this.state = 'OPEN';
    }
  }
}

/**
 * Retry mechanism with exponential backoff
 */
export const retry = async <T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    factor?: number;
    retryCondition?: (error: Error) => boolean;
  } = {}
): Promise<T> => {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    retryCondition = (error) => error.statusCode >= 500,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts || !retryCondition(lastError as Error)) {
        throw lastError;
      }

      const delay = Math.min(
        baseDelay * Math.pow(factor, attempt - 1),
        maxDelay
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
};