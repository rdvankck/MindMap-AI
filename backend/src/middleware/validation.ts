import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '@/utils/logger';

/**
 * Generic validation middleware using Zod schemas
 */
export const validateRequest = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      let data;
      
      switch (source) {
        case 'body':
          data = req.body;
          break;
        case 'query':
          data = req.query;
          break;
        case 'params':
          data = req.params;
          break;
        default:
          data = req.body;
      }

      const validatedData = schema.parse(data);
      
      // Update the request with validated data
      switch (source) {
        case 'body':
          req.body = validatedData;
          break;
        case 'query':
          req.query = validatedData;
          break;
        case 'params':
          req.params = validatedData;
          break;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        logger.warn('Validation error:', { errors: validationErrors, request: {
          method: req.method,
          url: req.url,
          ip: req.ip,
        } });

        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationErrors,
        });
        return;
      }

      logger.error('Unexpected validation error:', error);
      res.status(500).json({
        error: 'Internal validation error',
        code: 'INTERNAL_VALIDATION_ERROR',
      });
    }
  };
};

/**
 * Multiple schemas validation middleware
 */
export const validateMultiple = (schemas: { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema }) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const errors: any[] = [];

      // Validate body if schema provided
      if (schemas.body) {
        try {
          req.body = schemas.body.parse(req.body);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...error.errors.map(err => ({
              location: 'body',
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })));
          }
        }
      }

      // Validate query if schema provided
      if (schemas.query) {
        try {
          req.query = schemas.query.parse(req.query);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...error.errors.map(err => ({
              location: 'query',
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })));
          }
        }
      }

      // Validate params if schema provided
      if (schemas.params) {
        try {
          req.params = schemas.params.parse(req.params);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...error.errors.map(err => ({
              location: 'params',
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })));
          }
        }
      }

      if (errors.length > 0) {
        logger.warn('Multiple validation errors:', { errors, request: {
          method: req.method,
          url: req.url,
          ip: req.ip,
        } });

        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors,
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Unexpected validation error:', error);
      res.status(500).json({
        error: 'Internal validation error',
        code: 'INTERNAL_VALIDATION_ERROR',
      });
    }
  };
};

/**
 * File upload validation middleware
 */
export const validateFileUpload = (options: {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  required?: boolean;
} = {}) => {
  const { maxSize = 10 * 1024 * 1024, allowedTypes = [], required = false } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const file = req.file;

      if (required && !file) {
        res.status(400).json({
          error: 'File is required',
          code: 'FILE_REQUIRED',
        });
        return;
      }

      if (!file) {
        return next();
      }

      // Check file size
      if (file.size > maxSize) {
        res.status(400).json({
          error: `File size exceeds limit of ${maxSize} bytes`,
          code: 'FILE_TOO_LARGE',
          maxSize,
          actualSize: file.size,
        });
        return;
      }

      // Check file type
      if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
        res.status(400).json({
          error: `File type ${file.mimetype} is not allowed`,
          code: 'FILE_TYPE_NOT_ALLOWED',
          allowedTypes,
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('File validation error:', error);
      res.status(500).json({
        error: 'File validation failed',
        code: 'FILE_VALIDATION_ERROR',
      });
    }
  };
};

/**
 * Generic validation error handler
 */
export const handleValidationError = (error: any, req: Request, res: Response, next: NextFunction): void => {
  if (error.name === 'ValidationError') {
    const validationErrors = Object.keys(error.errors).map(key => ({
      field: key,
      message: error.errors[key].message,
    }));

    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: validationErrors,
    });
    return;
  }

  next(error);
};