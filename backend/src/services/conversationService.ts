import { PrismaClient, ConversationThread, ConversationMessage, ConversationStatus, ConversationRole, ContextStrategy, LLMContextConfig, ConversationStats, ContextSnapshot, ConversationBranch } from '@prisma/client';
import { Redis } from 'ioredis';
import { logger } from '@/utils/logger';
import { redis } from '@/config/redis';

export interface ConversationContext {
  messages: ConversationMessage[];
  systemPrompt?: string;
  totalTokens: number;
  contextWindow: number;
  strategy: ContextStrategy;
  nodeId: string;
  workflowId: string;
  threadId: string;
}

export interface ContextBuildingOptions {
  maxTokens?: number;
  strategy?: ContextStrategy;
  includeSystemPrompt?: boolean;
  branchId?: string;
  includeBranchContext?: boolean;
  maxBranchDepth?: number;
  prioritizeActiveBranches?: boolean;
  summaryConfig?: {
    model: string;
    maxSummaryTokens: number;
  };
}

export interface CreateConversationOptions {
  nodeId: string;
  workflowId: string;
  userId: string;
  title: string;
  systemPrompt?: string;
  contextConfig?: Partial<LLMContextConfig>;
  initialContext?: Record<string, any>;
}

export interface MessageOptions {
  role: ConversationRole;
  content: string;
  metadata?: Record<string, any>;
  parentMessageId?: string;
  isSystem?: boolean;
  branchId?: string;
  isBranchPoint?: boolean;
  branchReason?: string;
}

export interface BranchCreationOptions {
  branchName: string;
  branchType: 'question' | 'alternative' | 'clarification' | 'correction' | 'exploration' | 'summary';
  description?: string;
  color?: string;
  metadata?: {
    reasoning?: string;
    contextKeywords?: string[];
    tags?: string[];
    parentMessageId?: string;
    alternativePrompt?: string;
    expectedOutcome?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    confidence?: number;
    userIntent?: string;
  };
  copyMessages?: boolean;
  copyContext?: boolean;
  position?: { x: number; y: number };
}

export interface BranchComparisonOptions {
  branchIds: string[];
  comparisonType: 'content' | 'structure' | 'performance' | 'outcomes' | 'comprehensive';
  includeMetrics?: boolean;
  includeRecommendations?: boolean;
}

export interface BranchVisualizationOptions {
  layoutType: 'tree' | 'radial' | 'force' | 'hierarchical' | 'circular';
  filters?: {
    branchTypes?: string[];
    dateRange?: { start: Date; end: Date };
    participants?: string[];
    tags?: string[];
    depth?: { min: number; max: number };
  };
  style?: {
    colorScheme?: 'rainbow' | 'ocean' | 'sunset' | 'forest' | 'monochrome' | 'custom';
    nodeSize?: 'uniform' | 'byDepth' | 'byActivity';
    edgeWeight?: 'uniform' | 'byTime' | 'bySimilarity';
  };
}

export interface BranchMergeOptions {
  sourceBranchId: string;
  targetBranchId: string;
  mergeStrategy: 'append' | 'interleave' | 'selective' | 'summarize' | 'vote';
  resolveConflicts?: {
    messageId: string;
    resolution: 'keep_source' | 'keep_target' | 'merge' | 'manual';
    manualResolution?: string;
  }[];
  preserveHistory?: boolean;
}

export class ConversationService {
  private prisma: PrismaClient;
  private redis: Redis;
  private readonly CONTEXT_CACHE_TTL = 3600; // 1 hour
  private readonly SNAPSHOT_CACHE_TTL = 7200; // 2 hours
  private readonly BRANCH_CACHE_TTL = 1800; // 30 minutes
  private readonly VISUALIZATION_CACHE_TTL = 900; // 15 minutes

  constructor() {
    this.prisma = new PrismaClient();
    this.redis = redis;
  }

  /**
   * Create a new conversation thread
   */
  async createConversation(options: CreateConversationOptions): Promise<ConversationThread> {
    try {
      const conversation = await this.prisma.conversationThread.create({
        data: {
          nodeId: options.nodeId,
          workflowId: options.workflowId,
          userId: options.userId,
          title: options.title,
          status: ConversationStatus.ACTIVE,
          context: {
            systemPrompt: options.systemPrompt,
            settings: options.contextConfig || {},
            ...options.initialContext,
          },
          settings: options.contextConfig || {},
        },
        include: {
          messages: true,
          branches: true,
        },
      });

      // Initialize conversation stats
      await this.prisma.conversationStats.create({
        data: {
          threadId: conversation.id,
          lastActivityAt: new Date(),
        },
      });

      // Cache the conversation context
      await this.cacheConversationContext(conversation.id, {
        messages: [],
        totalTokens: 0,
        contextWindow: options.contextConfig?.contextWindow || 8192,
        strategy: options.contextConfig?.contextStrategy || ContextStrategy.FULL,
        nodeId: options.nodeId,
        workflowId: options.workflowId,
        threadId: conversation.id,
        systemPrompt: options.systemPrompt,
      });

      logger.info(`Created conversation thread ${conversation.id} for node ${options.nodeId}`);
      return conversation;
    } catch (error) {
      logger.error('Error creating conversation:', error);
      throw new Error('Failed to create conversation thread');
    }
  }

  /**
   * Add a message to a conversation thread
   */
  async addMessage(
    threadId: string,
    options: MessageOptions,
    updateContext: boolean = true
  ): Promise<ConversationMessage> {
    try {
      // Calculate token count (simplified - in production, use proper tokenizer)
      const tokenCount = await this.calculateTokenCount(options.content);

      const message = await this.prisma.conversationMessage.create({
        data: {
          threadId,
          nodeId: await this.getNodeIdForThread(threadId),
          parentMessageId: options.parentMessageId,
          role: options.role,
          content: options.content,
          tokenCount,
          metadata: options.metadata || {},
          isSystem: options.isSystem || false,
        },
        include: {
          thread: true,
          parentMessage: true,
          childMessages: true,
        },
      });

      // Update conversation stats
      await this.updateConversationStats(threadId, {
        messageCount: 1,
        tokenCount,
        role: options.role,
      });

      // Invalidate cached context if needed
      if (updateContext) {
        await this.invalidateConversationContextCache(threadId);
      }

      logger.debug(`Added message ${message.id} to conversation ${threadId}`);
      return message;
    } catch (error) {
      logger.error('Error adding message:', error);
      throw new Error('Failed to add message');
    }
  }

  /**
   * Build conversation context for LLM
   */
  async buildContext(
    threadId: string,
    options: ContextBuildingOptions = {}
  ): Promise<ConversationContext> {
    try {
      const cacheKey = `conversation:${threadId}:context:${JSON.stringify(options)}`;
      
      // Try to get from cache first
      const cachedContext = await this.redis.get(cacheKey);
      if (cachedContext) {
        return JSON.parse(cachedContext);
      }

      // Get conversation thread with messages
      const thread = await this.prisma.conversationThread.findUnique({
        where: { id: threadId },
        include: {
          messages: {
            where: { isDeleted: false },
            orderBy: { timestamp: 'asc' },
          },
          branches: options.branchId ? {
            where: { id: options.branchId, isActive: true },
          } : false,
        },
      });

      if (!thread) {
        throw new Error('Conversation thread not found');
      }

      const maxTokens = options.maxTokens || thread.settings.maxTokens || 4096;
      const strategy = options.strategy || thread.settings.contextStrategy || ContextStrategy.FULL;

      let contextMessages: ConversationMessage[];
      let totalTokens = 0;

      switch (strategy) {
        case ContextStrategy.FULL:
          contextMessages = await this.buildFullContext(thread.messages, maxTokens);
          break;
        case ContextStrategy.SLIDING_WINDOW:
          contextMessages = await this.buildSlidingWindowContext(thread.messages, maxTokens);
          break;
        case ContextStrategy.SUMMARIZATION:
          contextMessages = await this.buildSummarizationContext(thread, maxTokens, options.summaryConfig);
          break;
        case ContextStrategy.SELECTIVE:
          contextMessages = await this.buildSelectiveContext(thread.messages, maxTokens);
          break;
        case ContextStrategy.HYBRID:
          contextMessages = await this.buildHybridContext(thread, maxTokens, options);
          break;
        default:
          contextMessages = thread.messages;
      }

      // Calculate total tokens
      totalTokens = contextMessages.reduce((sum, msg) => sum + msg.tokenCount, 0);

      const context: ConversationContext = {
        messages: contextMessages,
        systemPrompt: thread.context.systemPrompt as string,
        totalTokens,
        contextWindow: maxTokens,
        strategy,
        nodeId: thread.nodeId,
        workflowId: thread.workflowId,
        threadId,
      };

      // Cache the context
      await this.redis.setex(cacheKey, this.CONTEXT_CACHE_TTL, JSON.stringify(context));

      return context;
    } catch (error) {
      logger.error('Error building conversation context:', error);
      throw new Error('Failed to build conversation context');
    }
  }

  /**
   * Create a conversation branch with enhanced features
   */
  async createBranch(
    threadId: string,
    branchPointId: string,
    options: BranchCreationOptions
  ): Promise<ConversationBranch> {
    try {
      // Validate that the branch point exists
      const branchPoint = await this.prisma.conversationMessage.findUnique({
        where: { id: branchPointId },
        include: { thread: true },
      });

      if (!branchPoint || branchPoint.threadId !== threadId) {
        throw new Error('Invalid branch point');
      }

      // Calculate branch depth
      const parentBranch = await this.getParentBranch(threadId, branchPointId);
      const depth = parentBranch ? parentBranch.depth + 1 : 1;

      // Generate branch color if not provided
      const color = options.color || await this.generateBranchColor(threadId, options.branchType);

      const branch = await this.prisma.conversationBranch.create({
        data: {
          threadId,
          branchPointId,
          branchName: options.branchName,
          branchType: options.branchType,
          description: options.description,
          color,
          isActive: true,
          metadata: options.metadata || {},
          parentBranchId: parentBranch?.id,
          depth,
          isMainBranch: false,
        },
        include: {
          thread: true,
          branchPoint: true,
          parentBranch: true,
        },
      });

      // Update parent branch with child reference
      if (parentBranch) {
        await this.prisma.conversationBranch.update({
          where: { id: parentBranch.id },
          data: {
            childBranchIds: [...(parentBranch.childBranchIds || []), branch.id],
          },
        });
      }

      // Create branch point node in visualization
      await this.createConversationNode(threadId, {
        messageId: branchPointId,
        branchId: branch.id,
        nodeType: 'branch_point',
        position: options.position || await this.calculateNodePosition(threadId),
        data: {
          branch,
          metadata: { branchReason: options.metadata?.reasoning },
        },
      });

      // Copy context if requested
      if (options.copyContext) {
        await this.copyContextToBranch(threadId, branch.id, branchPointId);
      }

      // Copy messages if requested
      if (options.copyMessages) {
        await this.copyMessagesToBranch(threadId, branch.id, branchPointId);
      }

      // Update conversation stats
      await this.updateConversationStats(threadId, { branchCount: 1 });

      // Invalidate branch cache
      await this.invalidateBranchCache(threadId);

      logger.info(`Created branch ${branch.id} of type ${options.branchType} from message ${branchPointId}`);
      return branch;
    } catch (error) {
      logger.error('Error creating conversation branch:', error);
      throw new Error('Failed to create conversation branch');
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(
    threadId: string,
    options: {
      limit?: number;
      offset?: number;
      includeDeleted?: boolean;
      branchId?: string;
    } = {}
  ): Promise<{ messages: ConversationMessage[]; total: number }> {
    try {
      const { limit = 100, offset = 0, includeDeleted = false, branchId } = options;

      const whereClause: any = { threadId };
      if (!includeDeleted) {
        whereClause.isDeleted = false;
      }
      if (branchId) {
        whereClause.parentMessageId = branchId;
      }

      const [messages, total] = await Promise.all([
        this.prisma.conversationMessage.findMany({
          where: whereClause,
          orderBy: { timestamp: 'asc' },
          skip: offset,
          take: limit,
          include: {
            parentMessage: true,
            childMessages: true,
          },
        }),
        this.prisma.conversationMessage.count({
          where: whereClause,
        }),
      ]);

      return { messages, total };
    } catch (error) {
      logger.error('Error getting conversation history:', error);
      throw new Error('Failed to get conversation history');
    }
  }

  /**
   * Create context snapshot
   */
  async createContextSnapshot(
    threadId: string,
    messageId?: string,
    strategy: string = 'full'
  ): Promise<ContextSnapshot> {
    try {
      const context = await this.buildContext(threadId, { strategy: strategy as ContextStrategy });

      const snapshot = await this.prisma.contextSnapshot.create({
        data: {
          threadId,
          messageId,
          context: context as any,
          tokenCount: context.totalTokens,
          contextStrategy: strategy,
          expiresAt: new Date(Date.now() + this.SNAPSHOT_CACHE_TTL * 1000),
        },
      });

      // Cache the snapshot
      const snapshotKey = `conversation:${threadId}:snapshot:${snapshot.id}`;
      await this.redis.setex(snapshotKey, this.SNAPSHOT_CACHE_TTL, JSON.stringify(snapshot));

      logger.debug(`Created context snapshot ${snapshot.id} for conversation ${threadId}`);
      return snapshot;
    } catch (error) {
      logger.error('Error creating context snapshot:', error);
      throw new Error('Failed to create context snapshot');
    }
  }

  /**
   * Build full context (include all messages up to token limit)
   */
  private async buildFullContext(
    messages: ConversationMessage[],
    maxTokens: number
  ): Promise<ConversationMessage[]> {
    const result: ConversationMessage[] = [];
    let currentTokens = 0;

    // Start from the beginning and add messages until we hit the limit
    for (const message of messages) {
      if (currentTokens + message.tokenCount <= maxTokens) {
        result.push(message);
        currentTokens += message.tokenCount;
      } else {
        break;
      }
    }

    return result;
  }

  /**
   * Build sliding window context (keep most recent messages)
   */
  private async buildSlidingWindowContext(
    messages: ConversationMessage[],
    maxTokens: number
  ): Promise<ConversationMessage[]> {
    const result: ConversationMessage[] = [];
    let currentTokens = 0;

    // Start from the end and work backwards
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (currentTokens + message.tokenCount <= maxTokens) {
        result.unshift(message);
        currentTokens += message.tokenCount;
      } else {
        break;
      }
    }

    return result;
  }

  /**
   * Build summarization context (summarize older messages)
   */
  private async buildSummarizationContext(
    thread: any,
    maxTokens: number,
    summaryConfig?: any
  ): Promise<ConversationMessage[]> {
    // This is a simplified implementation
    // In production, you would use an LLM to generate summaries
    const messages = thread.messages as ConversationMessage[];
    const summaryThreshold = Math.floor(maxTokens * 0.3); // Reserve 30% for context
    let currentTokens = 0;
    const result: ConversationMessage[] = [];

    // Add recent messages
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (currentTokens + message.tokenCount <= summaryThreshold) {
        result.unshift(message);
        currentTokens += message.tokenCount;
      } else {
        // Create a summary message for older messages
        const olderMessages = messages.slice(0, i);
        if (olderMessages.length > 0) {
          const summaryContent = `...${olderMessages.length} previous messages summarized...`;
          const summaryMessage: ConversationMessage = {
            id: `summary-${thread.id}`,
            threadId: thread.id,
            nodeId: thread.nodeId,
            parentMessageId: null,
            role: ConversationRole.SYSTEM,
            content: summaryContent,
            tokenCount: 50, // Approximate
            metadata: { type: 'summary', messageCount: olderMessages.length },
            timestamp: olderMessages[olderMessages.length - 1].timestamp,
            isSystem: true,
            isDeleted: false,
            version: 1,
          } as any;
          result.unshift(summaryMessage);
        }
        break;
      }
    }

    return result;
  }

  /**
   * Build selective context (include important messages)
   */
  private async buildSelectiveContext(
    messages: ConversationMessage[],
    maxTokens: number
  ): Promise<ConversationMessage[]> {
    // Simple implementation: prioritize system messages and recent user/assistant exchanges
    const systemMessages = messages.filter(m => m.isSystem);
    const otherMessages = messages.filter(m => !m.isSystem);
    
    let result: ConversationMessage[] = [...systemMessages];
    let currentTokens = result.reduce((sum, msg) => sum + msg.tokenCount, 0);

    // Add recent messages from the end
    for (let i = otherMessages.length - 1; i >= 0; i--) {
      const message = otherMessages[i];
      if (currentTokens + message.tokenCount <= maxTokens) {
        result.push(message);
        currentTokens += message.tokenCount;
      } else {
        break;
      }
    }

    return result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Build hybrid context (combination of strategies)
   */
  private async buildHybridContext(
    thread: any,
    maxTokens: number,
    options: ContextBuildingOptions
  ): Promise<ConversationMessage[]> {
    // Use sliding window for recent messages and summarization for older ones
    const messages = thread.messages as ConversationMessage[];
    const windowSize = Math.floor(maxTokens * 0.7); // 70% for sliding window
    
    // Get recent messages with sliding window
    const recentMessages = await this.buildSlidingWindowContext(messages, windowSize);
    
    // If we still have room, add system messages
    const systemMessages = messages.filter(m => m.isSystem);
    const remainingTokens = maxTokens - recentMessages.reduce((sum, msg) => sum + msg.tokenCount, 0);
    
    let result = [...recentMessages];
    for (const sysMsg of systemMessages) {
      if (sysMsg.tokenCount <= remainingTokens) {
        result.push(sysMsg);
      }
    }

    return result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Calculate token count (simplified implementation)
   */
  private async calculateTokenCount(text: string): Promise<number> {
    // This is a simplified token counting
    // In production, use proper tokenizers like tiktoken
    return Math.ceil(text.length / 4);
  }

  /**
   * Get node ID for a thread
   */
  private async getNodeIdForThread(threadId: string): Promise<string> {
    const thread = await this.prisma.conversationThread.findUnique({
      where: { id: threadId },
      select: { nodeId: true },
    });
    
    if (!thread) {
      throw new Error('Conversation thread not found');
    }
    
    return thread.nodeId;
  }

  /**
   * Update conversation statistics
   */
  private async updateConversationStats(
    threadId: string,
    updates: {
      messageCount?: number;
      tokenCount?: number;
      role?: ConversationRole;
      branchCount?: number;
    }
  ): Promise<void> {
    try {
      const stats = await this.prisma.conversationStats.upsert({
        where: { threadId },
        update: {
          totalMessages: updates.messageCount ? { increment: updates.messageCount } : undefined,
          totalTokens: updates.tokenCount ? { increment: updates.tokenCount } : undefined,
          userMessages: updates.role === ConversationRole.USER ? { increment: 1 } : undefined,
          assistantMessages: updates.role === ConversationRole.ASSISTANT ? { increment: 1 } : undefined,
          systemMessages: updates.role === ConversationRole.SYSTEM ? { increment: 1 } : undefined,
          toolMessages: updates.role === ConversationRole.TOOL ? { increment: 1 } : undefined,
          branchCount: updates.branchCount ? { increment: updates.branchCount } : undefined,
          lastActivityAt: new Date(),
        },
        create: {
          threadId,
          totalMessages: updates.messageCount || 0,
          totalTokens: updates.tokenCount || 0,
          userMessages: updates.role === ConversationRole.USER ? 1 : 0,
          assistantMessages: updates.role === ConversationRole.ASSISTANT ? 1 : 0,
          systemMessages: updates.role === ConversationRole.SYSTEM ? 1 : 0,
          toolMessages: updates.role === ConversationRole.TOOL ? 1 : 0,
          branchCount: updates.branchCount || 0,
          lastActivityAt: new Date(),
        },
      });
    } catch (error) {
      logger.warn('Failed to update conversation stats:', error);
    }
  }

  /**
   * Cache conversation context
   */
  private async cacheConversationContext(
    threadId: string,
    context: ConversationContext
  ): Promise<void> {
    const cacheKey = `conversation:${threadId}:context:default`;
    await this.redis.setex(cacheKey, this.CONTEXT_CACHE_TTL, JSON.stringify(context));
  }

  /**
   * Invalidate conversation context cache
   */
  private async invalidateConversationContextCache(threadId: string): Promise<void> {
    const pattern = `conversation:${threadId}:context:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Close a conversation thread
   */
  async closeConversation(threadId: string): Promise<ConversationThread> {
    try {
      const conversation = await this.prisma.conversationThread.update({
        where: { id: threadId },
        data: {
          status: ConversationStatus.CLOSED,
          closedAt: new Date(),
        },
      });

      // Create final context snapshot
      await this.createContextSnapshot(threadId, undefined, 'full');

      // Clear cache
      await this.invalidateConversationContextCache(threadId);

      logger.info(`Closed conversation thread ${threadId}`);
      return conversation;
    } catch (error) {
      logger.error('Error closing conversation:', error);
      throw new Error('Failed to close conversation');
    }
  }

  /**
   * Delete a conversation thread (soft delete)
   */
  async deleteConversation(threadId: string): Promise<void> {
    try {
      await this.prisma.conversationThread.update({
        where: { id: threadId },
        data: {
          status: ConversationStatus.ARCHIVED,
        },
      });

      // Mark all messages as deleted
      await this.prisma.conversationMessage.updateMany({
        where: { threadId },
        data: { isDeleted: true },
      });

      // Clear cache
      await this.invalidateConversationContextCache(threadId);

      logger.info(`Archived conversation thread ${threadId}`);
    } catch (error) {
      logger.error('Error deleting conversation:', error);
      throw new Error('Failed to delete conversation');
    }
  }

  /**
   * Get conversation threads for a user
   */
  async getUserConversations(
    userId: string,
    options: {
      status?: ConversationStatus;
      workflowId?: string;
      nodeId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ conversations: ConversationThread[]; total: number }> {
    try {
      const { status, workflowId, nodeId, limit = 50, offset = 0 } = options;

      const whereClause: any = { userId };
      if (status) whereClause.status = status;
      if (workflowId) whereClause.workflowId = workflowId;
      if (nodeId) whereClause.nodeId = nodeId;

      const [conversations, total] = await Promise.all([
        this.prisma.conversationThread.findMany({
          where: whereClause,
          include: {
            messages: {
              where: { isDeleted: false },
              orderBy: { timestamp: 'desc' },
              take: 1,
            },
            _count: {
              select: {
                messages: { where: { isDeleted: false } },
                branches: { where: { isActive: true } },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        this.prisma.conversationThread.count({ where: whereClause }),
      ]);

      return { conversations, total };
    } catch (error) {
      logger.error('Error getting user conversations:', error);
      throw new Error('Failed to get user conversations');
    }
  }

  /**
   * Get all branches for a conversation thread
   */
  async getConversationBranches(threadId: string): Promise<ConversationBranch[]> {
    try {
      const cacheKey = `conversation:${threadId}:branches`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const branches = await this.prisma.conversationBranch.findMany({
        where: { threadId },
        include: {
          thread: true,
          branchPoint: true,
          parentBranch: true,
          childBranches: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      await this.redis.setex(cacheKey, this.BRANCH_CACHE_TTL, JSON.stringify(branches));
      return branches;
    } catch (error) {
      logger.error('Error getting conversation branches:', error);
      throw new Error('Failed to get conversation branches');
    }
  }

  /**
   * Get branch tree structure
   */
  async getBranchTree(threadId: string): Promise<any> {
    try {
      const branches = await this.getConversationBranches(threadId);
      const messages = await this.getConversationHistory(threadId, { limit: 10000 });
      
      // Build hierarchical tree structure
      const branchMap = new Map(branches.map(b => [b.id, { ...b, children: [] }]));
      const rootBranches = [];

      branches.forEach(branch => {
        if (branch.parentBranchId) {
          const parent = branchMap.get(branch.parentBranchId);
          if (parent) {
            parent.children.push(branchMap.get(branch.id));
          }
        } else {
          rootBranches.push(branchMap.get(branch.id));
        }
      });

      // Add message context to each branch
      for (const branch of branchMap.values()) {
        const branchMessages = messages.messages.filter(
          msg => msg.branchId === branch.id || 
          (msg.timestamp >= branch.createdAt && (!branch.parentBranchId || branch.parentBranchId))
        );
        branch.messageCount = branchMessages.length;
        branch.lastActivity = branchMessages.length > 0 
          ? branchMessages[branchMessages.length - 1].timestamp 
          : branch.createdAt;
      }

      return {
        rootBranches,
        totalBranches: branches.length,
        maxDepth: Math.max(...branches.map(b => b.depth), 0),
        activeBranches: branches.filter(b => b.isActive).length,
      };
    } catch (error) {
      logger.error('Error getting branch tree:', error);
      throw new Error('Failed to get branch tree');
    }
  }

  /**
   * Compare multiple branches
   */
  async compareBranches(
    threadId: string,
    options: BranchComparisonOptions
  ): Promise<any> {
    try {
      const branches = await this.getConversationBranches(threadId);
      const selectedBranches = branches.filter(b => options.branchIds.includes(b.id));

      if (selectedBranches.length < 2) {
        throw new Error('At least 2 branches required for comparison');
      }

      const comparison = {
        id: `comparison-${Date.now()}`,
        threadId,
        branchIds: options.branchIds,
        comparisonType: options.comparisonType,
        createdAt: new Date(),
      };

      // Gather branch data
      const branchData = await Promise.all(
        selectedBranches.map(async (branch) => {
          const { messages } = await this.getConversationHistory(threadId, {
            branchId: branch.id,
            limit: 1000,
          });

          const totalTokens = messages.reduce((sum, msg) => sum + msg.tokenCount, 0);
          const userMessages = messages.filter(m => m.role === 'USER').length;
          const assistantMessages = messages.filter(m => m.role === 'ASSISTANT').length;

          return {
            branch,
            messages,
            metrics: {
              totalMessages: messages.length,
              totalTokens,
              userMessages,
              assistantMessages,
              averageTokensPerMessage: messages.length > 0 ? totalTokens / messages.length : 0,
            },
          };
        })
      );

      // Calculate differences and similarities
      const differences = [];
      const similarities = [];

      // Compare message counts
      const messageCounts = branchData.map(bd => bd.metrics.totalMessages);
      const maxMessages = Math.max(...messageCounts);
      const minMessages = Math.min(...messageCounts);
      
      if (maxMessages - minMessages > 2) {
        differences.push({
          type: 'content',
          description: `Branches have significantly different conversation lengths (${minMessages} vs ${maxMessages} messages)`,
          severity: 'medium' as const,
          details: { messageCounts },
        });
      }

      // Compare content similarity (simplified)
      for (let i = 0; i < branchData.length - 1; i++) {
        for (let j = i + 1; j < branchData.length; j++) {
          const similarity = await this.calculateContentSimilarity(
            branchData[i].messages,
            branchData[j].messages
          );

          if (similarity > 0.8) {
            similarities.push({
              type: 'content',
              description: `Branches ${branchData[i].branch.branchName} and ${branchData[j].branch.branchName} have very similar content`,
              confidence: similarity,
            });
          } else if (similarity < 0.3) {
            differences.push({
              type: 'content',
              description: `Branches ${branchData[i].branch.branchName} and ${branchData[j].branch.branchName} have very different content`,
              severity: 'high' as const,
              details: { similarity },
            });
          }
        }
      }

      // Generate recommendations if requested
      const recommendations = options.includeRecommendations 
        ? await this.generateComparisonRecommendations(branchData, options.comparisonType)
        : [];

      return {
        ...comparison,
        metrics: {
          totalMessages: branchData.map(bd => bd.metrics.totalMessages),
          tokenUsage: branchData.map(bd => bd.metrics.totalTokens),
          branchDepth: selectedBranches.map(b => b.depth),
        },
        differences,
        similarities,
        recommendations,
      };
    } catch (error) {
      logger.error('Error comparing branches:', error);
      throw new Error('Failed to compare branches');
    }
  }

  /**
   * Generate branch visualization data
   */
  async generateBranchVisualization(
    threadId: string,
    options: BranchVisualizationOptions
  ): Promise<any> {
    try {
      const cacheKey = `conversation:${threadId}:visualization:${JSON.stringify(options)}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const branches = await this.getConversationBranches(threadId);
      const { messages } = await this.getConversationHistory(threadId, { limit: 10000 });
      
      // Build graph structure
      const nodes = [];
      const edges = [];
      const nodeIdMap = new Map();
      let nodeIdCounter = 0;

      // Create branch nodes
      branches.forEach((branch, index) => {
        const nodeId = `branch-${nodeIdCounter++}`;
        nodeIdMap.set(branch.id, nodeId);

        const branchMessages = messages.filter(msg => msg.branchId === branch.id);
        const position = this.calculateNodePositionForVisualization(
          index,
          branches.length,
          options.layoutType,
          branch.depth
        );

        nodes.push({
          id: nodeId,
          type: 'branch',
          position,
          data: {
            label: branch.branchName,
            branchType: branch.branchType,
            messageCount: branchMessages.length,
            color: branch.color,
            isActive: branch.isActive,
            depth: branch.depth,
            createdAt: branch.createdAt,
          },
          style: {
            backgroundColor: branch.color,
            borderColor: branch.isActive ? '#10b981' : '#6b7280',
            borderWidth: 2,
          },
        });
      });

      // Create messages nodes for recent messages
      const recentMessages = messages
        .filter(msg => msg.branchId && branches.find(b => b.id === msg.branchId))
        .slice(-50) // Limit to recent 50 messages
        .reverse();

      recentMessages.forEach((message, index) => {
        const nodeId = `message-${nodeIdCounter++}`;
        const parentNodeId = nodeIdMap.get(message.branchId);
        
        if (parentNodeId) {
          nodes.push({
            id: nodeId,
            type: 'message',
            position: {
              x: nodes.find(n => n.id === parentNodeId)?.position.x + (index % 5) * 30 - 60,
              y: nodes.find(n => n.id === parentNodeId)?.position.y + Math.floor(index / 5) * 40 + 60,
            },
            data: {
              role: message.role,
              content: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
              timestamp: message.timestamp,
              tokenCount: message.tokenCount,
            },
          });

          edges.push({
            id: `edge-${nodeIdCounter++}`,
            source: parentNodeId,
            target: nodeId,
            type: 'conversation',
            animated: false,
            style: {
              stroke: '#9ca3af',
              strokeWidth: 1,
            },
          });
        }
      });

      // Create branch relationship edges
      branches.forEach(branch => {
        if (branch.parentBranchId) {
          const sourceNodeId = nodeIdMap.get(branch.parentBranchId);
          const targetNodeId = nodeIdMap.get(branch.id);
          
          if (sourceNodeId && targetNodeId) {
            edges.push({
              id: `branch-${sourceNodeId}-${targetNodeId}`,
              source: sourceNodeId,
              target: targetNodeId,
              type: 'branch',
              animated: true,
              style: {
                stroke: '#3b82f6',
                strokeWidth: 2,
              },
              label: 'branched from',
            });
          }
        }
      });

      const visualization = {
        id: `viz-${Date.now()}`,
        threadId,
        layout: options.layoutType,
        nodes,
        edges,
        viewState: {
          zoom: 1,
          pan: { x: 0, y: 0 },
          selectedNodeIds: [],
          highlightedNodeIds: [],
        },
        filters: options.filters || {},
        style: {
          colorScheme: options.style?.colorScheme || 'rainbow',
        },
      };

      await this.redis.setex(cacheKey, this.VISUALIZATION_CACHE_TTL, JSON.stringify(visualization));
      return visualization;
    } catch (error) {
      logger.error('Error generating branch visualization:', error);
      throw new Error('Failed to generate branch visualization');
    }
  }

  /**
   * Merge branches
   */
  async mergeBranches(
    threadId: string,
    options: BranchMergeOptions
  ): Promise<any> {
    try {
      const { sourceBranchId, targetBranchId, mergeStrategy, resolveConflicts, preserveHistory } = options;

      // Get branch information
      const sourceBranch = await this.prisma.conversationBranch.findUnique({
        where: { id: sourceBranchId },
      });
      const targetBranch = await this.prisma.conversationBranch.findUnique({
        where: { id: targetBranchId },
      });

      if (!sourceBranch || !targetBranch) {
        throw new Error('Source or target branch not found');
      }

      // Get messages from both branches
      const { messages: sourceMessages } = await this.getConversationHistory(threadId, {
        branchId: sourceBranchId,
        limit: 1000,
      });
      const { messages: targetMessages } = await this.getConversationHistory(threadId, {
        branchId: targetBranchId,
        limit: 1000,
      });

      let mergedMessages: any[] = [];

      // Apply merge strategy
      switch (mergeStrategy) {
        case 'append':
          mergedMessages = [...targetMessages, ...sourceMessages];
          break;
        case 'interleave':
          mergedMessages = await this.interleaveMessages(targetMessages, sourceMessages);
          break;
        case 'selective':
          mergedMessages = await this.selectiveMerge(targetMessages, sourceMessages, resolveConflicts);
          break;
        case 'summarize':
          mergedMessages = await this.summarizeMerge(targetMessages, sourceMessages);
          break;
        default:
          mergedMessages = targetMessages;
      }

      // Create merge point node
      await this.createConversationNode(threadId, {
        branchId: targetBranchId,
        nodeType: 'merge_point',
        position: await this.calculateNodePosition(threadId),
        data: {
          mergeType: mergeStrategy,
          sourceBranchId,
          targetBranchId,
          mergedMessageCount: mergedMessages.length,
        },
      });

      // Update target branch with merged content
      if (preserveHistory) {
        // Mark source branch as merged but keep it
        await this.prisma.conversationBranch.update({
          where: { id: sourceBranchId },
          data: {
            isActive: false,
            metadata: {
              ...sourceBranch.metadata,
              mergedInto: targetBranchId,
              mergedAt: new Date(),
              mergeStrategy,
            },
          },
        });
      } else {
        // Delete source branch
        await this.prisma.conversationBranch.delete({
          where: { id: sourceBranchId },
        });
      }

      // Update target branch
      await this.prisma.conversationBranch.update({
        where: { id: targetBranchId },
        data: {
          updatedAt: new Date(),
          metadata: {
            ...targetBranch.metadata,
            mergeHistory: [
              ...(targetBranch.metadata?.mergeHistory || []),
              {
                sourceBranchId,
                mergeStrategy,
                mergedAt: new Date(),
                messageCount: mergedMessages.length,
              },
            ],
          },
        },
      });

      // Invalidate caches
      await this.invalidateBranchCache(threadId);

      logger.info(`Merged branch ${sourceBranchId} into ${targetBranchId} using ${mergeStrategy} strategy`);
      return {
        success: true,
        targetBranchId,
        sourceBranchId,
        mergeStrategy,
        mergedMessageCount: mergedMessages.length,
        preserveHistory,
      };
    } catch (error) {
      logger.error('Error merging branches:', error);
      throw new Error('Failed to merge branches');
    }
  }

  // Helper methods for branch functionality

  private async getParentBranch(threadId: string, messageId: string): Promise<ConversationBranch | null> {
    try {
      const message = await this.prisma.conversationMessage.findUnique({
        where: { id: messageId },
      });

      if (!message || message.branchId) {
        return message?.branchId 
          ? await this.prisma.conversationBranch.findUnique({ where: { id: message.branchId } })
          : null;
      }

      // Find the most recent branch point before this message
      const recentBranch = await this.prisma.conversationBranch.findFirst({
        where: {
          threadId,
          branchPointId: {
            in: await this.getEarlierMessageIds(threadId, messageId),
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return recentBranch;
    } catch (error) {
      logger.error('Error getting parent branch:', error);
      return null;
    }
  }

  private async generateBranchColor(threadId: string, branchType: string): Promise<string> {
    try {
      const existingBranches = await this.getConversationBranches(threadId);
      const existingColors = new Set(existingBranches.map(b => b.color).filter(Boolean));

      const colorPalettes = {
        question: ['#3b82f6', '#06b6d4', '#0891b2', '#0e7490'],
        alternative: ['#f97316', '#ea580c', '#dc2626', '#b91c1c'],
        clarification: ['#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6'],
        correction: ['#ef4444', '#dc2626', '#b91c1c', '#991b1b'],
        exploration: ['#10b981', '#059669', '#047857', '#065f46'],
        summary: ['#6b7280', '#4b5563', '#374151', '#1f2937'],
      };

      const palette = colorPalettes[branchType as keyof typeof colorPalettes] || colorPalettes.question;
      
      for (const color of palette) {
        if (!existingColors.has(color)) {
          return color;
        }
      }

      // Fallback to generating a color
      return `hsl(${(existingBranches.length * 137) % 360}, 70%, 60%)`;
    } catch (error) {
      logger.error('Error generating branch color:', error);
      return '#6b7280';
    }
  }

  private async createConversationNode(threadId: string, nodeData: any): Promise<any> {
    try {
      const node = await this.prisma.conversationNode.create({
        data: {
          threadId,
          ...nodeData,
          isActive: true,
        },
      });

      return node;
    } catch (error) {
      logger.error('Error creating conversation node:', error);
      throw error;
    }
  }

  private async calculateNodePosition(threadId: string): Promise<{ x: number; y: number }> {
    try {
      const existingNodes = await this.prisma.conversationNode.findMany({
        where: { threadId },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      if (existingNodes.length === 0) {
        return { x: 100, y: 100 };
      }

      const lastNode = existingNodes[0];
      return {
        x: lastNode.position?.x + 150 || 250,
        y: lastNode.position?.y + 100 || 200,
      };
    } catch (error) {
      logger.error('Error calculating node position:', error);
      return { x: 100, y: 100 };
    }
  }

  private async calculateNodePositionForVisualization(
    index: number,
    total: number,
    layoutType: string,
    depth: number
  ): Promise<{ x: number; y: number }> {
    switch (layoutType) {
      case 'tree':
        return {
          x: (depth + 1) * 200,
          y: (index - total / 2) * 80 + 200,
        };
      case 'radial':
        const angle = (index / total) * 2 * Math.PI;
        const radius = (depth + 1) * 150;
        return {
          x: 400 + radius * Math.cos(angle),
          y: 300 + radius * Math.sin(angle),
        };
      case 'circular':
        const circularAngle = (index / total) * 2 * Math.PI;
        const circularRadius = 200;
        return {
          x: 400 + circularRadius * Math.cos(circularAngle),
          y: 300 + circularRadius * Math.sin(circularAngle),
        };
      default:
        return {
          x: (index % 4) * 200 + 100,
          y: Math.floor(index / 4) * 150 + 100,
        };
    }
  }

  private async copyContextToBranch(threadId: string, branchId: string, branchPointId: string): Promise<void> {
    try {
      const context = await this.buildContext(threadId, {
        branchId: undefined, // Get main context
        includeSystemPrompt: true,
      });

      // Store context for the new branch
      const contextCacheKey = `conversation:${threadId}:context:${branchId}`;
      await this.redis.setex(contextCacheKey, this.CONTEXT_CACHE_TTL, JSON.stringify({
        ...context,
        branchId,
      }));
    } catch (error) {
      logger.error('Error copying context to branch:', error);
    }
  }

  private async copyMessagesToBranch(threadId: string, branchId: string, branchPointId: string): Promise<void> {
    try {
      const { messages } = await this.getConversationHistory(threadId, {
        limit: 1000,
      });

      const branchPointIndex = messages.findIndex(m => m.id === branchPointId);
      if (branchPointIndex === -1) return;

      const messagesToCopy = messages.slice(0, branchPointIndex + 1);

      for (const message of messagesToCopy) {
        await this.prisma.conversationMessage.update({
          where: { id: message.id },
          data: { branchId },
        });
      }
    } catch (error) {
      logger.error('Error copying messages to branch:', error);
    }
  }

  private async getEarlierMessageIds(threadId: string, messageId: string): Promise<string[]> {
    try {
      const message = await this.prisma.conversationMessage.findUnique({
        where: { id: messageId },
      });

      if (!message) return [];

      const earlierMessages = await this.prisma.conversationMessage.findMany({
        where: {
          threadId,
          timestamp: {
            lt: message.timestamp,
          },
        },
        select: { id: true },
        orderBy: { timestamp: 'desc' },
      });

      return earlierMessages.map(m => m.id);
    } catch (error) {
      logger.error('Error getting earlier message IDs:', error);
      return [];
    }
  }

  private async calculateContentSimilarity(messages1: any[], messages2: any[]): Promise<number> {
    // Simplified similarity calculation based on text overlap
    try {
      const text1 = messages1.map(m => m.content.toLowerCase()).join(' ');
      const text2 = messages2.map(m => m.content.toLowerCase()).join(' ');
      
      const words1 = new Set(text1.split(/\s+/));
      const words2 = new Set(text2.split(/\s+/));
      
      const intersection = new Set([...words1].filter(word => words2.has(word)));
      const union = new Set([...words1, ...words2]);
      
      return union.size > 0 ? intersection.size / union.size : 0;
    } catch (error) {
      logger.error('Error calculating content similarity:', error);
      return 0;
    }
  }

  private async generateComparisonRecommendations(branchData: any[], comparisonType: string): Promise<any[]> {
    try {
      const recommendations = [];

      // Recommend merging similar branches
      for (let i = 0; i < branchData.length - 1; i++) {
        for (let j = i + 1; j < branchData.length; j++) {
          const similarity = await this.calculateContentSimilarity(
            branchData[i].messages,
            branchData[j].messages
          );

          if (similarity > 0.8) {
            recommendations.push({
              type: 'merge',
              description: `Consider merging ${branchData[i].branch.branchName} with ${branchData[j].branch.branchName} as they have very similar content`,
              targetBranchId: branchData[j].branch.id,
              reasoning: `High content similarity (${(similarity * 100).toFixed(1)}%)`,
              confidence: similarity,
            });
          }
        }
      }

      // Recommend exploring shorter branches
      const shortestBranch = branchData.reduce((prev, current) => 
        prev.metrics.totalMessages < current.metrics.totalMessages ? prev : current
      );
      
      if (shortestBranch.metrics.totalMessages < 5) {
        recommendations.push({
          type: 'explore',
          description: `Consider exploring the ${shortestBranch.branch.branchName} branch further as it has few messages`,
          targetBranchId: shortestBranch.branch.id,
          reasoning: 'Branch has low conversation depth',
          confidence: 0.7,
        });
      }

      return recommendations;
    } catch (error) {
      logger.error('Error generating comparison recommendations:', error);
      return [];
    }
  }

  private async interleaveMessages(messages1: any[], messages2: any[]): Promise<any[]> {
    // Simple interleaving based on timestamps
    const allMessages = [...messages1, ...messages2];
    return allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private async selectiveMerge(messages1: any[], messages2: any[], conflicts?: any[]): Promise<any[]> {
    // For now, just return the first branch's messages
    // In a real implementation, this would use the conflicts resolution
    return messages1;
  }

  private async summarizeMerge(messages1: any[], messages2: any[]): Promise<any[]> {
    // For now, return both branches with a summary message
    const summaryMessage = {
      id: `summary-${Date.now()}`,
      threadId: messages1[0]?.threadId,
      nodeId: messages1[0]?.nodeId,
      role: 'SYSTEM',
      content: `Summary of merged conversation paths with ${messages1.length} and ${messages2.length} messages respectively.`,
      timestamp: new Date(),
      isSystem: true,
    };
    
    return [summaryMessage, ...messages1, ...messages2];
  }

  private async invalidateBranchCache(threadId: string): Promise<void> {
    try {
      const patterns = [
        `conversation:${threadId}:branches`,
        `conversation:${threadId}:context:*`,
        `conversation:${threadId}:visualization:*`,
      ];

      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
    } catch (error) {
      logger.error('Error invalidating branch cache:', error);
    }
  }
}

export const conversationService = new ConversationService();