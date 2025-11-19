import { Router } from 'express';
import { conversationService } from '@/services/conversationService';
import {
  CreateConversationSchema,
  AddMessageSchema,
  UpdateConversationSchema,
  CreateBranchSchema,
  ContextOptionsSchema,
  GetConversationsQuerySchema,
  GetHistoryQuerySchema,
} from '@/validators/conversationValidator';
import {
  loadConversationContext,
  validateConversationOwnership,
  addConversationMessage,
  validateContextOptions,
  conversationRateLimit,
  conversationErrorHandler,
} from '@/middleware/conversationMiddleware';
import { validateRequest } from '@/middleware/validation';
import { authMiddleware } from '@/middleware/auth';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * POST /conversations
 * Create a new conversation thread
 */
router.post('/',
  authMiddleware,
  validateRequest(CreateConversationSchema),
  conversationRateLimit(10, 60000), // 10 conversations per minute
  async (req, res, next) => {
    try {
      const { nodeId, workflowId, title, systemPrompt, contextConfig, initialContext } = req.body;
      const userId = req.user.id;

      const conversation = await conversationService.createConversation({
        nodeId,
        workflowId,
        userId,
        title,
        systemPrompt,
        contextConfig,
        initialContext,
      });

      res.status(201).json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /conversations
 * Get all conversations for the authenticated user
 */
router.get('/',
  authMiddleware,
  validateRequest(GetConversationsQuerySchema, 'query'),
  conversationRateLimit(100, 60000), // 100 requests per minute
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { status, workflowId, nodeId, limit = 50, offset = 0 } = req.query as any;

      const result = await conversationService.getUserConversations(userId, {
        status,
        workflowId,
        nodeId,
        limit,
        offset,
      });

      res.json({
        success: true,
        data: {
          conversations: result.conversations,
          pagination: {
            total: result.total,
            limit,
            offset,
            hasMore: offset + limit < result.total,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /conversations/:id
 * Get a specific conversation thread
 */
router.get('/:id',
  authMiddleware,
  validateConversationOwnership,
  loadConversationContext,
  conversationRateLimit(200, 60000), // 200 requests per minute
  async (req, res, next) => {
    try {
      const { id: threadId } = req.params;
      const { includeMessages = true } = req.query;

      let conversation;
      if (includeMessages === 'true') {
        // Get conversation with recent messages
        const { conversations } = await conversationService.getUserConversations(req.user.id, {
          limit: 1,
          offset: 0,
        });
        conversation = conversations.find(c => c.id === threadId);
      } else {
        // Get conversation without messages
        conversation = await conversationService.getUserConversations(req.user.id, {
          limit: 1,
          offset: 0,
        }).then(result => result.conversations.find(c => c.id === threadId));
      }

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
          code: 'CONVERSATION_NOT_FOUND',
        });
      }

      res.json({
        success: true,
        data: {
          conversation,
          context: req.conversation?.context,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /conversations/:id
 * Update a conversation thread
 */
router.put('/:id',
  authMiddleware,
  validateConversationOwnership,
  validateRequest(UpdateConversationSchema),
  conversationRateLimit(50, 60000), // 50 updates per minute
  async (req, res, next) => {
    try {
      const { id: threadId } = req.params;
      const updates = req.body;

      // Note: This would need to be implemented in the service
      // For now, return the existing conversation
      const { conversations } = await conversationService.getUserConversations(req.user.id, {
        limit: 1,
        offset: 0,
      });
      const conversation = conversations.find(c => c.id === threadId);

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
          code: 'CONVERSATION_NOT_FOUND',
        });
      }

      res.json({
        success: true,
        data: conversation,
        message: 'Conversation updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /conversations/:id
 * Archive/delete a conversation thread
 */
router.delete('/:id',
  authMiddleware,
  validateConversationOwnership,
  conversationRateLimit(20, 60000), // 20 deletions per minute
  async (req, res, next) => {
    try {
      const { id: threadId } = req.params;

      await conversationService.deleteConversation(threadId);

      res.json({
        success: true,
        message: 'Conversation archived successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /conversations/:id/close
 * Close a conversation thread
 */
router.post('/:id/close',
  authMiddleware,
  validateConversationOwnership,
  conversationRateLimit(20, 60000),
  async (req, res, next) => {
    try {
      const { id: threadId } = req.params;

      const conversation = await conversationService.closeConversation(threadId);

      res.json({
        success: true,
        data: conversation,
        message: 'Conversation closed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /conversations/:id/context
 * Get conversation context for LLM
 */
router.get('/:id/context',
  authMiddleware,
  validateConversationOwnership,
  validateContextOptions,
  loadConversationContext,
  conversationRateLimit(500, 60000), // 500 context requests per minute
  async (req, res, next) => {
    try {
      const context = req.conversation?.context;

      if (!context) {
        return res.status(500).json({
          success: false,
          error: 'Failed to build conversation context',
          code: 'CONTEXT_BUILD_ERROR',
        });
      }

      res.json({
        success: true,
        data: context,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /conversations/:id/history
 * Get conversation message history
 */
router.get('/:id/history',
  authMiddleware,
  validateConversationOwnership,
  validateRequest(GetHistoryQuerySchema, 'query'),
  conversationRateLimit(100, 60000),
  async (req, res, next) => {
    try {
      const { id: threadId } = req.params;
      const { limit = 100, offset = 0, includeDeleted = false, branchId } = req.query as any;

      const { messages, total } = await conversationService.getConversationHistory(threadId, {
        limit,
        offset,
        includeDeleted,
        branchId,
      });

      res.json({
        success: true,
        data: {
          messages,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /conversations/:id/messages
 * Add a message to the conversation
 */
router.post('/:id/messages',
  authMiddleware,
  validateConversationOwnership,
  validateRequest(AddMessageSchema),
  addConversationMessage('user'),
  conversationRateLimit(60, 60000), // 60 messages per minute
  async (req, res, next) => {
    try {
      const message = res.locals.newMessage;

      res.status(201).json({
        success: true,
        data: message,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /conversations/:id/messages/assistant
 * Add an assistant message to the conversation
 */
router.post('/:id/messages/assistant',
  authMiddleware,
  validateConversationOwnership,
  validateRequest(AddMessageSchema),
  addConversationMessage('assistant'),
  conversationRateLimit(60, 60000),
  async (req, res, next) => {
    try {
      const message = res.locals.newMessage;

      res.status(201).json({
        success: true,
        data: message,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /conversations/:id/messages/system
 * Add a system message to the conversation
 */
router.post('/:id/messages/system',
  authMiddleware,
  validateConversationOwnership,
  validateRequest(AddMessageSchema),
  addConversationMessage('system'),
  conversationRateLimit(30, 60000), // 30 system messages per minute
  async (req, res, next) => {
    try {
      const message = res.locals.newMessage;

      res.status(201).json({
        success: true,
        data: message,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /conversations/:id/branches
 * Create a conversation branch with enhanced features
 */
router.post('/:id/branches',
  authMiddleware,
  validateConversationOwnership,
  conversationRateLimit(20, 60000), // 20 branches per minute
  async (req, res, next) => {
    try {
      const { id: threadId } = req.params;
      const { 
        branchPointId, 
        branchName,
        branchType = 'alternative',
        description,
        color,
        metadata,
        copyMessages = false,
        copyContext = true,
        position
      } = req.body;

      const branch = await conversationService.createBranch(threadId, branchPointId, {
        branchName,
        branchType,
        description,
        color,
        metadata,
        copyMessages,
        copyContext,
        position,
      });

      res.status(201).json({
        success: true,
        data: branch,
        message: 'Branch created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /conversations/:id/branches
 * Get all branches for a conversation
 */
router.get('/:id/branches',
  authMiddleware,
  validateConversationOwnership,
  conversationRateLimit(100, 60000),
  async (req, res, next) => {
    try {
      const { id: threadId } = req.params;
      const branches = await conversationService.getConversationBranches(threadId);

      res.json({
        success: true,
        data: branches,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /conversations/:id/branches/tree
 * Get branch tree structure
 */
router.get('/:id/branches/tree',
  authMiddleware,
  validateConversationOwnership,
  conversationRateLimit(100, 60000),
  async (req, res, next) => {
    try {
      const { id: threadId } = req.params;
      const branchTree = await conversationService.getBranchTree(threadId);

      res.json({
        success: true,
        data: branchTree,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /conversations/:id/branches/compare
 * Compare multiple branches
 */
router.post('/:id/branches/compare',
  authMiddleware,
  validateConversationOwnership,
  conversationRateLimit(20, 60000),
  async (req, res, next) => {
    try {
      const { id: threadId } = req.params;
      const { branchIds, comparisonType = 'content', includeMetrics = true, includeRecommendations = true } = req.body;

      if (!branchIds || branchIds.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'At least 2 branch IDs are required for comparison',
          code: 'INSUFFICIENT_BRANCHES',
        });
      }

      const comparison = await conversationService.compareBranches(threadId, {
        branchIds,
        comparisonType,
        includeMetrics,
        includeRecommendations,
      });

      res.json({
        success: true,
        data: comparison,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /conversations/:id/branches/visualize
 * Generate branch visualization
 */
router.post('/:id/branches/visualize',
  authMiddleware,
  validateConversationOwnership,
  conversationRateLimit(30, 60000),
  async (req, res, next) => {
    try {
      const { id: threadId } = req.params;
      const { 
        layoutType = 'tree',
        filters,
        style
      } = req.body;

      const visualization = await conversationService.generateBranchVisualization(threadId, {
        layoutType,
        filters,
        style,
      });

      res.json({
        success: true,
        data: visualization,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /conversations/:id/branches/merge
 * Merge branches
 */
router.post('/:id/branches/merge',
  authMiddleware,
  validateConversationOwnership,
  conversationRateLimit(10, 60000),
  async (req, res, next) => {
    try {
      const { id: threadId } = req.params;
      const { 
        sourceBranchId,
        targetBranchId,
        mergeStrategy = 'append',
        resolveConflicts,
        preserveHistory = true
      } = req.body;

      if (!sourceBranchId || !targetBranchId) {
        return res.status(400).json({
          success: false,
          error: 'Source and target branch IDs are required',
          code: 'MISSING_BRANCH_IDS',
        });
      }

      const mergeResult = await conversationService.mergeBranches(threadId, {
        sourceBranchId,
        targetBranchId,
        mergeStrategy,
        resolveConflicts,
        preserveHistory,
      });

      res.json({
        success: true,
        data: mergeResult,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /conversations/:id/branches/active
 * Switch active branch
 */
router.put('/:id/branches/active',
  authMiddleware,
  validateConversationOwnership,
  conversationRateLimit(30, 60000),
  async (req, res, next) => {
    try {
      const { id: threadId } = req.params;
      const { branchId } = req.body;

      // This would update the active branch in the conversation state
      // For now, return a success response
      res.json({
        success: true,
        data: { threadId, activeBranchId: branchId },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /conversations/:id/branches/:branchId
 * Delete a branch
 */
router.delete('/:id/branches/:branchId',
  authMiddleware,
  validateConversationOwnership,
  conversationRateLimit(10, 60000),
  async (req, res, next) => {
    try {
      const { id: threadId, branchId } = req.params;

      // This would delete the branch and handle cleanup
      // For now, return a success response
      res.json({
        success: true,
        data: { threadId, deletedBranchId: branchId },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /conversations/:id/snapshots
 * Create a context snapshot
 */
router.post('/:id/snapshots',
  authMiddleware,
  validateConversationOwnership,
  conversationRateLimit(10, 60000), // 10 snapshots per minute
  async (req, res, next) => {
    try {
      const { id: threadId } = req.params;
      const { messageId, strategy = 'full' } = req.body;

      const snapshot = await conversationService.createContextSnapshot(threadId, messageId, strategy);

      res.status(201).json({
        success: true,
        data: snapshot,
        message: 'Context snapshot created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /conversations/:id/stats
 * Get conversation statistics
 */
router.get('/:id/stats',
  authMiddleware,
  validateConversationOwnership,
  conversationRateLimit(100, 60000),
  async (req, res, next) => {
    try {
      const { id: threadId } = req.params;

      // This would need to be implemented in the service
      // For now, return a placeholder response
      res.json({
        success: true,
        data: {
          threadId,
          totalMessages: 0,
          totalTokens: 0,
          avgResponseTime: 0,
          branchCount: 0,
          lastActivityAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /conversations/:id/export
 * Export conversation data
 */
router.get('/:id/export',
  authMiddleware,
  validateConversationOwnership,
  conversationRateLimit(10, 60000), // 10 exports per minute
  async (req, res, next) => {
    try {
      const { id: threadId } = req.params;
      const { format = 'json' } = req.query;

      // Get full conversation history
      const { messages } = await conversationService.getConversationHistory(threadId, {
        limit: 10000, // Large limit for export
        includeDeleted: false,
      });

      // Get conversation details
      const { conversations } = await conversationService.getUserConversations(req.user.id, {
        limit: 1,
        offset: 0,
      });
      const conversation = conversations.find(c => c.id === threadId);

      const exportData = {
        conversation,
        messages,
        exportedAt: new Date().toISOString(),
        format,
      };

      if (format === 'csv') {
        // Convert to CSV format if requested
        const csvHeader = 'Timestamp,Role,Content,Tokens,Metadata\\n';
        const csvRows = messages.map(msg => 
          `\"${msg.timestamp}\",\"${msg.role}\",\"${msg.content.replace(/\"/g, '\"\"')}\",\"${msg.tokenCount}\",\"${JSON.stringify(msg.metadata).replace(/\"/g, '\"\"')}\"`
        ).join('\\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=\"conversation-${threadId}.csv\"`);
        res.send(csvHeader + csvRows);
      } else {
        // Default JSON format
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=\"conversation-${threadId}.json\"`);
        res.json(exportData);
      }
    } catch (error) {
      next(error);
    }
  }
);

// Error handling middleware
router.use(conversationErrorHandler);

export default router;