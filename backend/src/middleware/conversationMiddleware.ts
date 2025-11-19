import { Request, Response, NextFunction } from 'express';
import { conversationService } from '@/services/conversationService';
import { logger } from '@/utils/logger';

declare global {
  namespace Express {
    interface Request {
      conversation?: {
        threadId: string;
        context: any;
        nodeId: string;
        workflowId: string;
      };
    }
  }
}

/**
 * Middleware to load conversation context
 */
export const loadConversationContext = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { threadId } = req.params;
    
    if (!threadId) {
      return res.status(400).json({
        error: 'Conversation thread ID is required',
        code: 'MISSING_THREAD_ID',
      });
    }

    // Build conversation context
    const context = await conversationService.buildContext(threadId, {
      maxTokens: parseInt(req.query.maxTokens as string) || undefined,
      strategy: req.query.strategy as any,
      branchId: req.query.branchId as string,
    });

    // Attach to request
    req.conversation = {
      threadId,
      context,
      nodeId: context.nodeId,
      workflowId: context.workflowId,
    };

    next();
  } catch (error) {
    logger.error('Error loading conversation context:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Conversation thread not found',
        code: 'CONVERSATION_NOT_FOUND',
      });
    }

    return res.status(500).json({
      error: 'Failed to load conversation context',
      code: 'CONTEXT_LOAD_ERROR',
    });
  }
};

/**
 * Middleware to validate conversation ownership
 */
export const validateConversationOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { threadId } = req.params;
    const userId = req.user?.id; // Assuming auth middleware sets user

    if (!userId) {
      return res.status(401).json({
        error: 'User authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    // Get the conversation to check ownership
    const conversations = await conversationService.getUserConversations(userId, {
      limit: 1,
      offset: 0,
    });

    const conversation = conversations.conversations.find(c => c.id === threadId);
    
    if (!conversation) {
      return res.status(403).json({
        error: 'Access denied to this conversation',
        code: 'ACCESS_DENIED',
      });
    }

    next();
  } catch (error) {
    logger.error('Error validating conversation ownership:', error);
    return res.status(500).json({
      error: 'Failed to validate conversation access',
      code: 'VALIDATION_ERROR',
    });
  }
};

/**
 * Middleware to add message to conversation
 */
export const addConversationMessage = (
  role: 'user' | 'assistant' | 'system' | 'tool'
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { threadId } = req.params;
      const { content, metadata, parentMessageId } = req.body;

      if (!content) {
        return res.status(400).json({
          error: 'Message content is required',
          code: 'MISSING_CONTENT',
        });
      }

      // Add the message
      const message = await conversationService.addMessage(threadId, {
        role: role.toUpperCase() as any,
        content,
        metadata: metadata || {},
        parentMessageId,
        isSystem: role === 'system',
      });

      // Attach message to response locals for further processing
      res.locals.newMessage = message;
      
      next();
    } catch (error) {
      logger.error('Error adding conversation message:', error);
      return res.status(500).json({
        error: 'Failed to add message to conversation',
        code: 'MESSAGE_ADD_ERROR',
      });
    }
  };
};

/**
 * Middleware to track conversation activity
 */
export const trackConversationActivity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { threadId } = req.params;
    
    // This middleware just updates the last activity timestamp
    // The actual stats update is handled in the conversation service
    if (threadId) {
      // Update activity tracking here if needed
      logger.debug(`Conversation activity tracked for thread ${threadId}`);
    }
    
    next();
  } catch (error) {
    logger.error('Error tracking conversation activity:', error);
    // Don't block the request for tracking errors
    next();
  }
};

/**
 * Middleware to validate context building options
 */
export const validateContextOptions = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { maxTokens, strategy, branchId } = req.query;

    // Validate maxTokens
    if (maxTokens) {
      const parsed = parseInt(maxTokens as string);
      if (isNaN(parsed) || parsed < 1 || parsed > 128000) {
        return res.status(400).json({
          error: 'Invalid maxTokens. Must be between 1 and 128000',
          code: 'INVALID_MAX_TOKENS',
        });
      }
    }

    // Validate strategy
    const validStrategies = ['FULL', 'SLIDING_WINDOW', 'SUMMARIZATION', 'SELECTIVE', 'HYBRID'];
    if (strategy && !validStrategies.includes(strategy as string)) {
      return res.status(400).json({
        error: `Invalid strategy. Must be one of: ${validStrategies.join(', ')}`,
        code: 'INVALID_STRATEGY',
      });
    }

    // Validate branchId format (UUID)
    if (branchId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(branchId as string)) {
        return res.status(400).json({
          error: 'Invalid branch ID format',
          code: 'INVALID_BRANCH_ID',
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Error validating context options:', error);
    return res.status(500).json({
      error: 'Failed to validate context options',
      code: 'VALIDATION_ERROR',
    });
  }
};

/**
 * Rate limiting middleware for conversations
 */
export const conversationRateLimit = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user?.id || req.ip;
    const threadId = req.params.threadId || 'global';
    const key = `${userId}:${threadId}`;

    const now = Date.now();
    const userRequests = requests.get(key);

    if (!userRequests || now > userRequests.resetTime) {
      requests.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    if (userRequests.count >= maxRequests) {
      const resetIn = Math.ceil((userRequests.resetTime - now) / 1000);
      res.set('Retry-After', resetIn.toString());
      return res.status(429).json({
        error: 'Too many conversation requests',
        code: 'RATE_LIMIT_EXCEEDED',
        resetIn,
      });
    }

    userRequests.count++;
    next();
  };
};

/**
 * Middleware to handle conversation errors gracefully
 */
export const conversationErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Conversation middleware error:', error);

  // Handle specific error types
  if (error.message.includes('not found')) {
    return res.status(404).json({
      error: 'Conversation not found',
      code: 'CONVERSATION_NOT_FOUND',
    });
  }

  if (error.message.includes('access denied')) {
    return res.status(403).json({
      error: 'Access denied',
      code: 'ACCESS_DENIED',
    });
  }

  if (error.message.includes('token limit')) {
    return res.status(400).json({
      error: 'Token limit exceeded',
      code: 'TOKEN_LIMIT_EXCEEDED',
    });
  }

  // Generic error
  res.status(500).json({
    error: 'Internal conversation error',
    code: 'INTERNAL_ERROR',
  });
};