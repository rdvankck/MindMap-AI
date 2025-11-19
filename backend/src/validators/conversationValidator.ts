import { z } from 'zod';

// Role enum for validation
const ConversationRoleSchema = z.enum(['USER', 'ASSISTANT', 'SYSTEM', 'TOOL', 'FUNCTION']);

// Context strategy enum
const ContextStrategySchema = z.enum(['FULL', 'SLIDING_WINDOW', 'SUMMARIZATION', 'SELECTIVE', 'HYBRID']);

// Conversation status enum
const ConversationStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'CLOSED', 'ARCHIVED']);

// Create conversation request schema
export const CreateConversationSchema = z.object({
  nodeId: z.string().uuid('Invalid node ID format'),
  workflowId: z.string().uuid('Invalid workflow ID format'),
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  systemPrompt: z.string().optional(),
  contextConfig: z.object({
    provider: z.string().optional(),
    model: z.string().optional(),
    maxTokens: z.number().int().min(1).max(128000).optional(),
    contextWindow: z.number().int().min(1).max(128000).optional(),
    contextStrategy: ContextStrategySchema.optional(),
    tokenCountingMethod: z.string().optional(),
    summarizationConfig: z.object({
      model: z.string().optional(),
      maxSummaryTokens: z.number().int().min(1).optional(),
    }).optional(),
  }).optional(),
  initialContext: z.record(z.any()).optional(),
});

// Add message request schema
export const AddMessageSchema = z.object({
  role: ConversationRoleSchema,
  content: z.string().min(1, 'Message content is required').max(100000, 'Message too long'),
  metadata: z.record(z.any()).optional(),
  parentMessageId: z.string().uuid().optional(),
  isSystem: z.boolean().optional().default(false),
});

// Update conversation schema
export const UpdateConversationSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  status: ConversationStatusSchema.optional(),
  settings: z.record(z.any()).optional(),
  context: z.record(z.any()).optional(),
});

// Create branch schema
export const CreateBranchSchema = z.object({
  branchPointId: z.string().uuid('Invalid branch point ID'),
  branchName: z.string().min(1, 'Branch name is required').max(100, 'Branch name too long'),
  metadata: z.record(z.any()).optional(),
});

// Context building options schema
export const ContextOptionsSchema = z.object({
  maxTokens: z.number().int().min(1).max(128000).optional(),
  strategy: ContextStrategySchema.optional(),
  includeSystemPrompt: z.boolean().optional(),
  branchId: z.string().uuid().optional(),
  summaryConfig: z.object({
    model: z.string(),
    maxSummaryTokens: z.number().int().min(1),
  }).optional(),
});

// Query parameters for getting conversations
export const GetConversationsQuerySchema = z.object({
  status: ConversationStatusSchema.optional(),
  workflowId: z.string().uuid().optional(),
  nodeId: z.string().uuid().optional(),
  limit: z.string().transform((val) => parseInt(val)).pipe(z.number().int().min(1).max(100)).optional(),
  offset: z.string().transform((val) => parseInt(val)).pipe(z.number().int().min(0)).optional(),
  includeDeleted: z.string().transform((val) => val === 'true').optional(),
});

// Query parameters for getting conversation history
export const GetHistoryQuerySchema = z.object({
  limit: z.string().transform((val) => parseInt(val)).pipe(z.number().int().min(1).max(1000)).optional(),
  offset: z.string().transform((val) => parseInt(val)).pipe(z.number().int().min(0)).optional(),
  includeDeleted: z.string().transform((val) => val === 'true').optional(),
  branchId: z.string().uuid().optional(),
  orderBy: z.enum(['timestamp', 'role', 'tokenCount']).optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
});

// LLM Context Config schema
export const LLMContextConfigSchema = z.object({
  name: z.string().min(1).max(100),
  provider: z.string().min(1),
  model: z.string().min(1),
  maxTokens: z.number().int().min(1).max(128000),
  contextWindow: z.number().int().min(1).max(128000),
  systemPrompt: z.string().max(10000).optional(),
  contextStrategy: ContextStrategySchema,
  tokenCountingMethod: z.string().min(1),
  summarizationConfig: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});

// Conversation stats query schema
export const ConversationStatsQuerySchema = z.object({
  threadId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional(),
});

// Export type definitions
export type CreateConversationRequest = z.infer<typeof CreateConversationSchema>;
export type AddMessageRequest = z.infer<typeof AddMessageSchema>;
export type UpdateConversationRequest = z.infer<typeof UpdateConversationSchema>;
export type CreateBranchRequest = z.infer<typeof CreateBranchSchema>;
export type ContextOptions = z.infer<typeof ContextOptionsSchema>;
export type GetConversationsQuery = z.infer<typeof GetConversationsQuerySchema>;
export type GetHistoryQuery = z.infer<typeof GetHistoryQuerySchema>;
export type LLMContextConfigRequest = z.infer<typeof LLMContextConfigSchema>;
export type ConversationStatsQuery = z.infer<typeof ConversationStatsQuerySchema>;