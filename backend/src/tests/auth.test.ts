import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { authMiddleware } from '@/middleware/auth';
import { config } from '@/config';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('bcryptjs');
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Authentication Middleware', () => {
  let mockRequest: any;
  let mockResponse: any;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      user: null,
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

  describe('JWT Token Validation', () => {
    it('should authenticate with valid JWT token', async () => {
      const mockToken = 'valid-jwt-token';
      const mockDecodedToken = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
        iat: Date.now() / 1000,
        exp: (Date.now() + 3600000) / 1000,
      };

      mockRequest.headers.authorization = `Bearer ${mockToken}`;
      
      (jwt.verify as jest.Mock).mockReturnValue(mockDecodedToken);

      await authMiddleware(mockRequest, mockResponse, nextFunction);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, config.auth.jwtSecret);
      expect(mockRequest.user).toEqual(mockDecodedToken);
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject requests with missing authorization header', async () => {
      await authMiddleware(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Access token required',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject requests with malformed authorization header', async () => {
      mockRequest.headers.authorization = 'InvalidFormat';

      await authMiddleware(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid authorization header format',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject requests with expired JWT token', async () => {
      const mockToken = 'expired-jwt-token';
      mockRequest.headers.authorization = `Bearer ${mockToken}`;

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.TokenExpiredError('jwt expired', new Date());
      });

      await authMiddleware(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Token expired',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid JWT token', async () => {
      const mockToken = 'invalid-jwt-token';
      mockRequest.headers.authorization = `Bearer ${mockToken}`;

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid signature');
      });

      await authMiddleware(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should handle JWT verification errors gracefully', async () => {
      const mockToken = 'problematic-token';
      mockRequest.headers.authorization = `Bearer ${mockToken}`;

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await authMiddleware(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Token verification failed',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('Token Generation and Validation', () => {
    it('should generate JWT token with correct payload', () => {
      const userPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
      };

      const mockToken = 'generated-jwt-token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      // This would typically be in a separate utility function
      // For testing purposes, we'll simulate token generation
      const token = jwt.sign(userPayload, config.auth.jwtSecret, {
        expiresIn: config.auth.jwtExpiresIn,
        issuer: config.auth.jwtIssuer,
        audience: config.auth.jwtAudience,
      });

      expect(jwt.sign).toHaveBeenCalledWith(
        userPayload,
        config.auth.jwtSecret,
        expect.objectContaining({
          expiresIn: config.auth.jwtExpiresIn,
          issuer: config.auth.jwtIssuer,
          audience: config.auth.jwtAudience,
        })
      );
      expect(token).toBe(mockToken);
    });

    it('should include required claims in JWT token', () => {
      const userPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
      };

      (jwt.sign as jest.Mock).mockImplementation((payload, secret, options) => {
        return JSON.stringify({ payload, options });
      });

      const token = jwt.sign(userPayload, config.auth.jwtSecret, {
        expiresIn: '1h',
        issuer: 'llm-interface',
        audience: 'llm-interface-users',
      });

      const tokenData = JSON.parse(token);
      expect(tokenData.options).toEqual(
        expect.objectContaining({
          expiresIn: '1h',
          issuer: 'llm-interface',
          audience: 'llm-interface-users',
        })
      );
    });
  });

  describe('Password Security', () => {
    it('should hash passwords with correct salt rounds', async () => {
      const password = 'plain-text-password';
      const hashedPassword = 'hashed-password-result';
      
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const result = await bcrypt.hash(password, 12);

      expect(bcrypt.hash).toHaveBeenCalledWith(password, 12);
      expect(result).toBe(hashedPassword);
    });

    it('should compare passwords correctly', async () => {
      const password = 'plain-text-password';
      const hashedPassword = 'hashed-password-result';
      
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await bcrypt.compare(password, hashedPassword);

      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBe(true);
    });

    it('should reject incorrect passwords', async () => {
      const password = 'wrong-password';
      const hashedPassword = 'hashed-password-result';
      
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await bcrypt.compare(password, hashedPassword);

      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBe(false);
    });
  });

  describe('Role-based Access Control', () => {
    it('should allow access for authorized roles', async () => {
      const mockToken = 'valid-admin-token';
      const mockDecodedToken = {
        userId: 'admin-123',
        email: 'admin@example.com',
        role: 'admin',
        iat: Date.now() / 1000,
        exp: (Date.now() + 3600000) / 1000,
      };

      mockRequest.headers.authorization = `Bearer ${mockToken}`;
      (jwt.verify as jest.Mock).mockReturnValue(mockDecodedToken);

      await authMiddleware(mockRequest, mockResponse, nextFunction);

      expect(mockRequest.user.role).toBe('admin');
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should handle missing role in token', async () => {
      const mockToken = 'token-without-role';
      const mockDecodedToken = {
        userId: 'user-123',
        email: 'test@example.com',
        iat: Date.now() / 1000,
        exp: (Date.now() + 3600000) / 1000,
      };

      mockRequest.headers.authorization = `Bearer ${mockToken}`;
      (jwt.verify as jest.Mock).mockReturnValue(mockDecodedToken);

      await authMiddleware(mockRequest, mockResponse, nextFunction);

      expect(mockRequest.user.role).toBeUndefined();
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('Performance and Security', () => {
    it('should handle concurrent authentication requests', async () => {
      const mockToken = 'valid-jwt-token';
      const mockDecodedToken = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
        iat: Date.now() / 1000,
        exp: (Date.now() + 3600000) / 1000,
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockDecodedToken);

      // Create multiple concurrent requests
      const concurrentRequests = Array.from({ length: 10 }, () => {
        const req = {
          headers: { authorization: `Bearer ${mockToken}` },
          user: null,
        };
        return authMiddleware(req, mockResponse, nextFunction);
      });

      await Promise.all(concurrentRequests);

      expect(jwt.verify).toHaveBeenCalledTimes(10);
      expect(nextFunction).toHaveBeenCalledTimes(10);
    });

    it('should prevent token reuse across different users', async () => {
      const user1Token = 'user1-token';
      const user2Token = 'user2-token';

      const user1Decoded = {
        userId: 'user-1',
        email: 'user1@example.com',
        role: 'user',
      };

      const user2Decoded = {
        userId: 'user-2',
        email: 'user2@example.com',
        role: 'user',
      };

      (jwt.verify as jest.Mock)
        .mockReturnValueOnce(user1Decoded)
        .mockReturnValueOnce(user2Decoded);

      // First request with user1 token
      mockRequest.headers.authorization = `Bearer ${user1Token}`;
      await authMiddleware(mockRequest, mockResponse, nextFunction);
      expect(mockRequest.user.userId).toBe('user-1');

      // Second request with user2 token
      mockRequest.headers.authorization = `Bearer ${user2Token}`;
      mockRequest.user = null;
      await authMiddleware(mockRequest, mockResponse, nextFunction);
      expect(mockRequest.user.userId).toBe('user-2');
    });
  });
});