import { Request, Response } from 'express';
import { conversationService } from '@/services/conversationService';
import { logger } from '@/utils/logger';
import { broadcastToConversation } from '@/websocket';
import { Server as SocketIOServer } from 'socket.io';

export class ConversationController {
  private io?: SocketIOServer;

  /**
   * Set Socket.IO instance for real-time updates
   */
  setSocketIO(io: SocketIOServer): void {
    this.io = io;
  }

  /**
   * Create a new conversation thread
   */
  async createConversation(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId, workflowId, title, systemPrompt, contextConfig, initialContext } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      const conversation = await conversationService.createConversation({
        nodeId,
        workflowId,
        userId,
        title,
        systemPrompt,
        contextConfig,
        initialContext,
      });

      // Broadcast to workflow participants if Socket.IO is available
      if (this.io) {
        broadcastToConversation(this.io, conversation.id, 'conversation-created', {
          conversation,
          createdBy: userId,
        });
      }

      res.status(201).json({
        success: true,
        data: conversation,
        message: 'Conversation created successfully',
      });
    } catch (error) {
      logger.error('Error in createConversation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create conversation',
        code: 'CREATE_CONVERSATION_ERROR',
      });
    }
  }

  /**
   * Get conversation with context
   */
  async getConversationWithContext(req: Request, res: Response): Promise<void> {
    try {
      const { id: threadId } = req.params;
      const { maxTokens, strategy, branchId } = req.query;

      const context = await conversationService.buildContext(threadId, {
        maxTokens: maxTokens ? parseInt(maxTokens as string) : undefined,
        strategy: strategy as any,
        branchId: branchId as string,
      });

      res.json({
        success: true,
        data: context,
      });
    } catch (error) {
      logger.error('Error in getConversationWithContext:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Conversation not found',
          code: 'CONVERSATION_NOT_FOUND',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to get conversation context',
        code: 'GET_CONTEXT_ERROR',
      });
    }
  }

  /**
   * Add message with real-time updates
   */
  async addMessageWithBroadcast(req: Request, res: Response): Promise<void> {
    try {
      const { id: threadId } = req.params;
      const { role, content, metadata, parentMessageId } = req.body;
      const userId = req.user?.id;

      const message = await conversationService.addMessage(threadId, {
        role,
        content,
        metadata,
        parentMessageId,
        isSystem: role === 'SYSTEM',
      });

      // Broadcast to conversation participants
      if (this.io) {
        broadcastToConversation(this.io, threadId, 'message-added', {
          message,
          addedBy: userId,
        });

        // If it's a user message, trigger LLM response
        if (role === 'USER') {
          broadcastToConversation(this.io, threadId, 'user-message-received', {
            messageId: message.id,
            userId,
            timestamp: new Date().toISOString(),
          });
        }
      }

      res.status(201).json({
        success: true,
        data: message,
        message: 'Message added successfully',
      });
    } catch (error) {
      logger.error('Error in addMessageWithBroadcast:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add message',
        code: 'ADD_MESSAGE_ERROR',
      });
    }
  }

  /**
   * Create branch with enhanced features and real-time updates
   */
  async createBranchWithBroadcast(req: Request, res: Response): Promise<void> {
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
      const userId = req.user?.id;

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

      // Broadcast branch creation with enhanced data
      if (this.io) {
        broadcastToConversation(this.io, threadId, 'branch-created', {
          branch,
          createdBy: userId,
          threadId,
        });

        // Also broadcast branch tree update
        const branchTree = await conversationService.getBranchTree(threadId);
        broadcastToConversation(this.io, threadId, 'branch-tree-updated', {
          branchTree,
          updatedBy: userId,
        });
      }

      res.status(201).json({
        success: true,
        data: branch,
        message: 'Branch created successfully',
      });
    } catch (error) {
      logger.error('Error in createBranchWithBroadcast:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create branch',
        code: 'CREATE_BRANCH_ERROR',
      });
    }
  }

  /**
   * Get conversation analytics
   */
  async getConversationAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { id: threadId } = req.params;
      const userId = req.user?.id;

      // Get conversation history for analytics
      const { messages } = await conversationService.getConversationHistory(threadId, {
        limit: 10000, // Large limit for analytics
      });

      // Calculate analytics
      const totalMessages = messages.length;
      const totalTokens = messages.reduce((sum, msg) => sum + msg.tokenCount, 0);
      const userMessages = messages.filter(msg => msg.role === 'USER').length;
      const assistantMessages = messages.filter(msg => msg.role === 'ASSISTANT').length;
      const systemMessages = messages.filter(msg => msg.role === 'SYSTEM').length;
      const toolMessages = messages.filter(msg => msg.role === 'TOOL').length;

      // Calculate average response time (simplified)
      let totalResponseTime = 0;
      let responseCount = 0;
      
      for (let i = 0; i < messages.length - 1; i++) {
        if (messages[i].role === 'USER' && messages[i + 1].role === 'ASSISTANT') {
          const responseTime = messages[i + 1].timestamp.getTime() - messages[i].timestamp.getTime();
          totalResponseTime += responseTime;
          responseCount++;
        }
      }

      const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

      const analytics = {
        threadId,
        totalMessages,
        totalTokens,
        avgResponseTime: Math.round(avgResponseTime),
        messageBreakdown: {
          user: userMessages,
          assistant: assistantMessages,
          system: systemMessages,
          tool: toolMessages,
        },
        messageDistribution: {
          user: Math.round((userMessages / totalMessages) * 100),
          assistant: Math.round((assistantMessages / totalMessages) * 100),
          system: Math.round((systemMessages / totalMessages) * 100),
          tool: Math.round((toolMessages / totalMessages) * 100),
        },
        conversationDuration: messages.length > 0 ? 
          messages[messages.length - 1].timestamp.getTime() - messages[0].timestamp.getTime() : 0,
        lastActivity: messages.length > 0 ? messages[messages.length - 1].timestamp : null,
        generatedAt: new Date(),
      };

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      logger.error('Error in getConversationAnalytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get conversation analytics',
        code: 'GET_ANALYTICS_ERROR',
      });
    }
  }

  /**
   * Export conversation with different formats
   */
  async exportConversation(req: Request, res: Response): Promise<void> {
    try {
      const { id: threadId } = req.params;
      const { format = 'json', includeContext = false } = req.query;

      // Get conversation data
      const { messages } = await conversationService.getConversationHistory(threadId, {
        limit: 10000,
        includeDeleted: false,
      });

      const { conversations } = await conversationService.getUserConversations(req.user!.id, {
        limit: 1,
        offset: 0,
      });
      const conversation = conversations.find(c => c.id === threadId);

      if (!conversation) {
        res.status(404).json({
          success: false,
          error: 'Conversation not found',
          code: 'CONVERSATION_NOT_FOUND',
        });
        return;
      }

      // Prepare export data based on format
      let exportData: any;
      let contentType: string;
      let filename: string;

      switch (format) {
        case 'markdown':
          exportData = this.convertToMarkdown(conversation, messages, includeContext === 'true');
          contentType = 'text/markdown';
          filename = `conversation-${threadId}.md`;
          break;
        
        case 'txt':
          exportData = this.convertToText(conversation, messages);
          contentType = 'text/plain';
          filename = `conversation-${threadId}.txt`;
          break;
        
        case 'csv':
          exportData = this.convertToCSV(messages);
          contentType = 'text/csv';
          filename = `conversation-${threadId}.csv`;
          break;
        
        default: // json
          exportData = {
            conversation: {
              id: conversation.id,
              title: conversation.title,
              nodeId: conversation.nodeId,
              workflowId: conversation.workflowId,
              status: conversation.status,
              createdAt: conversation.createdAt,
              updatedAt: conversation.updatedAt,
            },
            messages: messages.map(msg => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              tokenCount: msg.tokenCount,
              timestamp: msg.timestamp,
              metadata: msg.metadata,
            })),
            context: includeContext === 'true' ? await conversationService.buildContext(threadId) : undefined,
            exportedAt: new Date().toISOString(),
            format: 'json',
          };
          contentType = 'application/json';
          filename = `conversation-${threadId}.json`;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exportData);
    } catch (error) {
      logger.error('Error in exportConversation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export conversation',
        code: 'EXPORT_ERROR',
      });
    }
  }

  /**
   * Convert conversation to Markdown format
   */
  private convertToMarkdown(conversation: any, messages: any[], includeContext: boolean = false): string {
    let markdown = `# ${conversation.title}\n\n`;
    markdown += `**Conversation ID:** ${conversation.id}\n`;
    markdown += `**Node ID:** ${conversation.nodeId}\n`;
    markdown += `**Workflow ID:** ${conversation.workflowId}\n`;
    markdown += `**Status:** ${conversation.status}\n`;
    markdown += `**Created:** ${conversation.createdAt}\n`;
    markdown += `**Last Updated:** ${conversation.updatedAt}\n\n`;

    if (includeContext) {
      markdown += `## System Context\n\n`;
      markdown += `${conversation.context?.systemPrompt || 'No system prompt'}\n\n`;
    }

    markdown += `## Conversation History\n\n`;

    messages.forEach(msg => {
      const roleIcon = {
        'USER': '👤',
        'ASSISTANT': '🤖',
        'SYSTEM': '⚙️',
        'TOOL': '🔧',
        'FUNCTION': '📋',
      }[msg.role] || '💬';

      markdown += `### ${roleIcon} ${msg.role}\n\n`;
      markdown += `${msg.content}\n\n`;
      markdown += `*${msg.timestamp} | ${msg.tokenCount} tokens*\n\n`;
      
      if (Object.keys(msg.metadata || {}).length > 0) {
        markdown += `**Metadata:** \`${JSON.stringify(msg.metadata, null, 2)}\`\n\n`;
      }
    });

    markdown += `---\n\n`;
    markdown += `*Exported on ${new Date().toISOString()}*\n`;

    return markdown;
  }

  /**
   * Convert conversation to plain text format
   */
  private convertToText(conversation: any, messages: any[]): string {
    let text = `Conversation: ${conversation.title}\n`;
    text += `ID: ${conversation.id}\n`;
    text += `Created: ${conversation.createdAt}\n\n`;

    messages.forEach(msg => {
      text += `[${msg.role}] ${msg.timestamp}\n`;
      text += `${msg.content}\n\n`;
    });

    return text;
  }

  /**
   * Convert conversation to CSV format
   */
  private convertToCSV(messages: any[]): string {
    const headers = ['Timestamp', 'Role', 'Content', 'Tokens', 'Metadata'];
    const csvRows = [headers.join(',')];

    messages.forEach(msg => {
      const row = [
        msg.timestamp.toISOString(),
        msg.role,
        `"${msg.content.replace(/"/g, '""')}"`,
        msg.tokenCount,
        `"${JSON.stringify(msg.metadata || {}).replace(/"/g, '""')}"`,
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Get conversation branches
   */
  async getConversationBranches(req: Request, res: Response): Promise<void> {
    try {
      const { id: threadId } = req.params;

      const branches = await conversationService.getConversationBranches(threadId);

      res.json({
        success: true,
        data: branches,
        message: 'Branches retrieved successfully',
      });
    } catch (error) {
      logger.error('Error in getConversationBranches:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get branches',
        code: 'GET_BRANCHES_ERROR',
      });
    }
  }

  /**
   * Get branch tree structure
   */
  async getBranchTree(req: Request, res: Response): Promise<void> {
    try {
      const { id: threadId } = req.params;

      const branchTree = await conversationService.getBranchTree(threadId);

      res.json({
        success: true,
        data: branchTree,
        message: 'Branch tree retrieved successfully',
      });
    } catch (error) {
      logger.error('Error in getBranchTree:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get branch tree',
        code: 'GET_BRANCH_TREE_ERROR',
      });
    }
  }

  /**
   * Compare branches
   */
  async compareBranches(req: Request, res: Response): Promise<void> {
    try {
      const { id: threadId } = req.params;
      const { branchIds, comparisonType = 'content', includeMetrics = true, includeRecommendations = true } = req.body;

      if (!branchIds || branchIds.length < 2) {
        res.status(400).json({
          success: false,
          error: 'At least 2 branch IDs are required for comparison',
          code: 'INSUFFICIENT_BRANCHES',
        });
        return;
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
        message: 'Branch comparison completed successfully',
      });
    } catch (error) {
      logger.error('Error in compareBranches:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to compare branches',
        code: 'COMPARE_BRANCHES_ERROR',
      });
    }
  }

  /**
   * Generate branch visualization
   */
  async generateBranchVisualization(req: Request, res: Response): Promise<void> {
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
        message: 'Branch visualization generated successfully',
      });
    } catch (error) {
      logger.error('Error in generateBranchVisualization:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate branch visualization',
        code: 'GENERATE_VISUALIZATION_ERROR',
      });
    }
  }

  /**
   * Merge branches
   */
  async mergeBranches(req: Request, res: Response): Promise<void> {
    try {
      const { id: threadId } = req.params;
      const { 
        sourceBranchId,
        targetBranchId,
        mergeStrategy = 'append',
        resolveConflicts,
        preserveHistory = true
      } = req.body;
      const userId = req.user?.id;

      if (!sourceBranchId || !targetBranchId) {
        res.status(400).json({
          success: false,
          error: 'Source and target branch IDs are required',
          code: 'MISSING_BRANCH_IDS',
        });
        return;
      }

      const mergeResult = await conversationService.mergeBranches(threadId, {
        sourceBranchId,
        targetBranchId,
        mergeStrategy,
        resolveConflicts,
        preserveHistory,
      });

      // Broadcast merge operation
      if (this.io) {
        broadcastToConversation(this.io, threadId, 'branches-merged', {
          mergeResult,
          mergedBy: userId,
        });

        // Update branch tree
        const branchTree = await conversationService.getBranchTree(threadId);
        broadcastToConversation(this.io, threadId, 'branch-tree-updated', {
          branchTree,
          updatedBy: userId,
        });
      }

      res.json({
        success: true,
        data: mergeResult,
        message: 'Branches merged successfully',
      });
    } catch (error) {
      logger.error('Error in mergeBranches:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to merge branches',
        code: 'MERGE_BRANCHES_ERROR',
      });
    }
  }

  /**
   * Switch active branch
   */
  async switchActiveBranch(req: Request, res: Response): Promise<void> {
    try {
      const { id: threadId } = req.params;
      const { branchId } = req.body;
      const userId = req.user?.id;

      // This would update the active branch in the conversation state
      // For now, return a success response
      
      // Broadcast branch switch
      if (this.io) {
        broadcastToConversation(this.io, threadId, 'active-branch-changed', {
          threadId,
          newActiveBranchId: branchId,
          switchedBy: userId,
        });
      }

      res.json({
        success: true,
        data: { threadId, activeBranchId: branchId },
        message: 'Active branch switched successfully',
      });
    } catch (error) {
      logger.error('Error in switchActiveBranch:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to switch active branch',
        code: 'SWITCH_BRANCH_ERROR',
      });
    }
  }

  /**
   * Delete branch
   */
  async deleteBranch(req: Request, res: Response): Promise<void> {
    try {
      const { id: threadId, branchId } = req.params;
      const userId = req.user?.id;

      // This would delete the branch and handle cleanup
      // For now, return a success response
      
      // Broadcast branch deletion
      if (this.io) {
        broadcastToConversation(this.io, threadId, 'branch-deleted', {
          threadId,
          deletedBranchId: branchId,
          deletedBy: userId,
        });

        // Update branch tree
        const branchTree = await conversationService.getBranchTree(threadId);
        broadcastToConversation(this.io, threadId, 'branch-tree-updated', {
          branchTree,
          updatedBy: userId,
        });
      }

      res.json({
        success: true,
        data: { threadId, deletedBranchId: branchId },
        message: 'Branch deleted successfully',
      });
    } catch (error) {
      logger.error('Error in deleteBranch:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete branch',
        code: 'DELETE_BRANCH_ERROR',
      });
    }
  }
}

export const conversationController = new ConversationController();