import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { validateRequest } from '@/middleware/validation';
import { z } from 'zod';

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      query: {},
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextFunction = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Request Body Validation', () => {
    const userSchema = z.object({
      name: z.string().min(2, 'Name must be at least 2 characters'),
      email: z.string().email('Invalid email format'),
      age: z.number().min(0, 'Age must be positive').optional(),
      preferences: z.object({
        theme: z.enum(['light', 'dark']).optional(),
        notifications: z.boolean().optional(),
      }).optional(),
    });

    it('should validate correct request body', async () => {
      const validBody = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        preferences: {
          theme: 'dark',
          notifications: true,
        },
      };

      mockRequest.body = validBody;

      const middleware = validateRequest(userSchema, 'body');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should reject invalid request body with detailed errors', async () => {
      const invalidBody = {
        name: 'J', // Too short
        email: 'invalid-email', // Invalid format
        age: -5, // Negative
        preferences: {
          theme: 'invalid-theme', // Invalid enum
        },
      };

      mockRequest.body = invalidBody;

      const middleware = validateRequest(userSchema, 'body');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'name',
              message: 'Name must be at least 2 characters',
            }),
            expect.objectContaining({
              field: 'email',
              message: 'Invalid email format',
            }),
            expect.objectContaining({
              field: 'age',
              message: 'Age must be positive',
            }),
            expect.objectContaining({
              field: 'preferences.theme',
              message: expect.stringContaining('Invalid'),
            }),
          ]),
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should handle missing required fields', async () => {
      const incompleteBody = {
        age: 25,
      };

      mockRequest.body = incompleteBody;

      const middleware = validateRequest(userSchema, 'body');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'name',
              message: expect.stringContaining('Required'),
            }),
            expect.objectContaining({
              field: 'email',
              message: expect.stringContaining('Required'),
            }),
          ]),
        })
      );
    });

    it('should validate partial objects correctly', async () => {
      const partialSchema = userSchema.partial();
      const partialBody = {
        name: 'Jane Doe',
      };

      mockRequest.body = partialBody;

      const middleware = validateRequest(partialSchema, 'body');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });
  });

  describe('Query Parameter Validation', () => {
    const querySchema = z.object({
      page: z.string().transform((val) => parseInt(val, 10)).pipe(
        z.number().int().positive().default(1)
      ),
      limit: z.string().transform((val) => parseInt(val, 10)).pipe(
        z.number().int().positive().max(100).default(10)
      ),
      sort: z.enum(['name', 'date', 'relevance']).default('date'),
      filter: z.string().optional(),
      include: z.string().transform((val) => val.split(',')).optional(),
    });

    it('should validate and transform query parameters', async () => {
      const validQuery = {
        page: '2',
        limit: '20',
        sort: 'name',
        include: 'users,posts,comments',
      };

      mockRequest.query = validQuery;

      const middleware = validateRequest(querySchema, 'query');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.query.page).toBe(2);
      expect(mockRequest.query.limit).toBe(20);
      expect(mockRequest.query.sort).toBe('name');
      expect(mockRequest.query.include).toEqual(['users', 'posts', 'comments']);
    });

    it('should apply default values for missing parameters', async () => {
      const partialQuery = {
        filter: 'active',
      };

      mockRequest.query = partialQuery;

      const middleware = validateRequest(querySchema, 'query');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.query.page).toBe(1);
      expect(mockRequest.query.limit).toBe(10);
      expect(mockRequest.query.sort).toBe('date');
      expect(mockRequest.query.filter).toBe('active');
    });

    it('should reject invalid query parameters', async () => {
      const invalidQuery = {
        page: '-1',
        limit: '200',
        sort: 'invalid-field',
      };

      mockRequest.query = invalidQuery;

      const middleware = validateRequest(querySchema, 'query');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'page',
            }),
            expect.objectContaining({
              field: 'limit',
            }),
            expect.objectContaining({
              field: 'sort',
            }),
          ]),
        })
      );
    });
  });

  describe('Path Parameter Validation', () => {
    const paramsSchema = z.object({
      id: z.string().uuid('Invalid ID format'),
      category: z.enum(['users', 'posts', 'comments']),
      action: z.enum(['view', 'edit', 'delete']).optional(),
    });

    it('should validate path parameters', async () => {
      const validParams = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        category: 'users',
        action: 'edit',
      };

      mockRequest.params = validParams;

      const middleware = validateRequest(paramsSchema, 'params');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reject invalid path parameters', async () => {
      const invalidParams = {
        id: 'invalid-uuid',
        category: 'invalid-category',
        action: 'invalid-action',
      };

      mockRequest.params = invalidParams;

      const middleware = validateRequest(paramsSchema, 'params');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'id',
              message: 'Invalid ID format',
            }),
            expect.objectContaining({
              field: 'category',
            }),
            expect.objectContaining({
              field: 'action',
            }),
          ]),
        })
      );
    });
  });

  describe('Header Validation', () => {
    const headersSchema = z.object({
      'content-type': z.literal('application/json'),
      'x-api-key': z.string().min(10),
      'x-request-id': z.string().uuid().optional(),
      authorization: z.string().startsWith('Bearer ').optional(),
    });

    it('should validate request headers', async () => {
      const validHeaders = {
        'content-type': 'application/json',
        'x-api-key': 'secure-api-key-123',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
        authorization: 'Bearer token123',
      };

      mockRequest.headers = validHeaders;

      const middleware = validateRequest(headersSchema, 'headers');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reject invalid headers', async () => {
      const invalidHeaders = {
        'content-type': 'text/plain',
        'x-api-key': 'short',
        'x-request-id': 'invalid-uuid',
      };

      mockRequest.headers = invalidHeaders;

      const middleware = validateRequest(headersSchema, 'headers');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'content-type',
            }),
            expect.objectContaining({
              field: 'x-api-key',
            }),
          ]),
        })
      );
    });
  });

  describe('Complex Validation Scenarios', () => {
    const workflowSchema = z.object({
      name: z.string().min(1),
      nodes: z.array(z.object({
        id: z.string().uuid(),
        type: z.enum(['prompt', 'llm', 'condition', 'aggregation']),
        data: z.record(z.any()),
        position: z.object({
          x: z.number(),
          y: z.number(),
        }),
      })).min(1),
      edges: z.array(z.object({
        id: z.string().uuid(),
        source: z.string().uuid(),
        target: z.string().uuid(),
        sourceHandle: z.string().optional(),
        targetHandle: z.string().optional(),
      })),
    }).refine(
      (data) => {
        // Validate that all edge source and target nodes exist
        const nodeIds = new Set(data.nodes.map(node => node.id));
        return data.edges.every(edge => 
          nodeIds.has(edge.source) && nodeIds.has(edge.target)
        );
      },
      {
        message: 'All edges must connect to existing nodes',
        path: ['edges'],
      }
    );

    it('should validate complex workflow structure', async () => {
      const validWorkflow = {
        name: 'Test Workflow',
        nodes: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            type: 'prompt',
            data: { prompt: 'Hello, world!' },
            position: { x: 100, y: 100 },
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            type: 'llm',
            data: { model: 'gpt-3.5-turbo' },
            position: { x: 300, y: 100 },
          },
        ],
        edges: [
          {
            id: '550e8400-e29b-41d4-a716-446655440003',
            source: '550e8400-e29b-41d4-a716-446655440001',
            target: '550e8400-e29b-41d4-a716-446655440002',
          },
        ],
      };

      mockRequest.body = validWorkflow;

      const middleware = validateRequest(workflowSchema, 'body');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reject workflow with invalid edges', async () => {
      const invalidWorkflow = {
        name: 'Invalid Workflow',
        nodes: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            type: 'prompt',
            data: { prompt: 'Hello, world!' },
            position: { x: 100, y: 100 },
          },
        ],
        edges: [
          {
            id: '550e8400-e29b-41d4-a716-446655440003',
            source: 'non-existent-node',
            target: '550e8400-e29b-41d4-a716-446655440001',
          },
        ],
      };

      mockRequest.body = invalidWorkflow;

      const middleware = validateRequest(workflowSchema, 'body');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              message: 'All edges must connect to existing nodes',
              path: ['edges'],
            }),
          ]),
        })
      );
    });
  });

  describe('Error Handling and Performance', () => {
    it('should handle validation errors gracefully', async () => {
      const schema = z.object({
        field: z.string(),
      });

      mockRequest.body = null; // Null body to cause potential error

      const middleware = validateRequest(schema, 'body');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should handle async validation efficiently', async () => {
      const asyncSchema = z.object({
        email: z.string().email(),
      });

      const requests = Array.from({ length: 100 }, (_, i) => {
        const req = {
          body: { email: `user${i}@example.com` },
          params: {},
          query: {},
          headers: {},
        };
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        };
        const next = jest.fn();

        return validateRequest(asyncSchema, 'body')(req as Request, res as Response, next);
      });

      const startTime = Date.now();
      await Promise.all(requests);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});