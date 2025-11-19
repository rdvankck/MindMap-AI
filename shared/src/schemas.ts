import { z } from 'zod';

// User Schemas
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'user']),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8),
  role: z.enum(['admin', 'user']).default('user'),
});

// Workflow Schemas
export const WorkflowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  userId: z.string().uuid(),
  isPublic: z.boolean().default(false),
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
  metadata: z.object({
    version: z.string(),
    tags: z.array(z.string()),
    category: z.string().optional(),
    thumbnail: z.string().optional(),
    author: z.string().optional(),
    lastExecutedAt: z.date().optional(),
    executionCount: z.number().default(0),
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
  nodes: z.array(z.any()).default([]),
  edges: z.array(z.any()).default([]),
  metadata: z.object({
    version: z.string().default('1.0.0'),
    tags: z.array(z.string()).default([]),
    category: z.string().optional(),
    thumbnail: z.string().optional(),
    author: z.string().optional(),
  }).default({ version: '1.0.0', tags: [] }),
});

// Node Schemas
export const NodeSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'llm', 'promptTemplate', 'condition', 'code', 'input', 'output',
    'file', 'http', 'wait', 'transform', 'merge', 'split',
    'webhook', 'database', 'cache', 'email', 'slack', 'storage'
  ]),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.object({
    label: z.string(),
    config: z.record(z.any()),
    inputs: z.record(z.any()),
    outputs: z.record(z.any()),
    status: z.enum(['idle', 'running', 'completed', 'error', 'skipped']),
    error: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  }),
  width: z.number().optional(),
  height: z.number().optional(),
  style: z.record(z.any()).optional(),
  className: z.string().optional(),
  hidden: z.boolean().optional(),
  draggable: z.boolean().optional(),
  selectable: z.boolean().optional(),
  connectable: z.boolean().optional(),
});

// LLM Config Schema
export const LLMConfigSchema = z.object({
  provider: z.enum(['openai', 'ollama', 'anthropic', 'cohere', 'custom']),
  model: z.string(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(100000).default(2000),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  stopSequences: z.array(z.string()).optional(),
  responseFormat: z.enum(['text', 'json_object']).default('text'),
  timeout: z.number().positive().optional(),
  retries: z.number().min(0).max(10).default(3),
});

// Execution Schemas
export const WorkflowExecutionSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  userId: z.string().uuid(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  inputs: z.record(z.any()),
  outputs: z.record(z.any()),
  nodeExecutions: z.array(z.any()),
  startedAt: z.date(),
  completedAt: z.date().optional(),
  error: z.string().optional(),
  metadata: z.record(z.any()),
});

export const ExecuteWorkflowSchema = z.object({
  workflowId: z.string().uuid(),
  inputs: z.record(z.any()).optional(),
  options: z.object({
    async: z.boolean().default(false),
    webhookUrl: z.string().optional(),
    timeout: z.number().positive().optional(),
  }).optional(),
});

// Chat Schemas
export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid().optional(),
  userId: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.date(),
  metadata: z.record(z.any()).optional(),
});

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  workflowId: z.string().uuid().optional(),
  context: z.record(z.any()).optional(),
});

// File Upload Schema
export const FileUploadSchema = z.object({
  id: z.string().uuid(),
  originalName: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  size: z.number().positive(),
  path: z.string(),
  uploadedBy: z.string().uuid(),
  uploadedAt: z.date(),
  metadata: z.record(z.any()).optional(),
});

// Auth Schemas
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

// Settings Schemas
export const UserSettingsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  language: z.string().default('en'),
  notifications: z.object({
    email: z.boolean().default(true),
    push: z.boolean().default(true),
    workflow: z.boolean().default(true),
    chat: z.boolean().default(true),
  }).default({
    email: true,
    push: true,
    workflow: true,
    chat: true,
  }),
  llm: z.object({
    defaultProvider: z.enum(['openai', 'ollama', 'anthropic', 'cohere', 'custom']),
    defaultModel: z.string(),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().min(1).max(100000).default(2000),
  }),
  ui: z.object({
    sidebarCollapsed: z.boolean().default(false),
    showMinimap: z.boolean().default(true),
    snapToGrid: z.boolean().default(true),
    gridSpacing: z.number().positive().default(15),
  }).default({
    sidebarCollapsed: false,
    showMinimap: true,
    snapToGrid: true,
    gridSpacing: 15,
  }),
});

// API Response Schemas
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }).optional(),
});

export const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Error Schema
export const AppErrorSchema = z.object({
  code: z.enum([
    'VALIDATION_ERROR',
    'AUTHENTICATION_ERROR',
    'AUTHORIZATION_ERROR',
    'NOT_FOUND',
    'CONFLICT',
    'RATE_LIMIT_EXCEEDED',
    'INTERNAL_SERVER_ERROR',
    'WORKFLOW_EXECUTION_ERROR',
    'NODE_EXECUTION_ERROR',
    'LLM_PROVIDER_ERROR',
    'FILE_UPLOAD_ERROR',
  ]),
  message: z.string(),
  details: z.any().optional(),
  stack: z.string().optional(),
});

// WebSocket Message Schema
export const WebSocketMessageSchema = z.object({
  type: z.string(),
  payload: z.any(),
  timestamp: z.date(),
  userId: z.string().uuid().optional(),
  sessionId: z.string().optional(),
});

// Template Schemas
export const NodeTemplateSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'llm', 'promptTemplate', 'condition', 'code', 'input', 'output',
    'file', 'http', 'wait', 'transform', 'merge', 'split',
    'webhook', 'database', 'cache', 'email', 'slack', 'storage'
  ]),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  icon: z.string(),
  inputs: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'object', 'array', 'file', 'llm-response', 'llm-messages']),
    required: z.boolean(),
    description: z.string().optional(),
  })),
  outputs: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'object', 'array', 'file', 'llm-response', 'llm-messages']),
    required: z.boolean(),
    description: z.string().optional(),
  })),
  config: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['text', 'textarea', 'number', 'boolean', 'select', 'multiselect', 'file', 'json', 'code']),
    required: z.boolean(),
    default: z.any().optional(),
    description: z.string().optional(),
    validation: z.array(z.object({
      type: z.enum(['required', 'min', 'max', 'pattern', 'custom']),
      value: z.any().optional(),
      message: z.string(),
    })).optional(),
    options: z.array(z.object({
      label: z.string(),
      value: z.any(),
    })).optional(),
  })),
  defaultConfig: z.record(z.any()),
});

// Export types
export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
export type CreateWorkflow = z.infer<typeof CreateWorkflowSchema>;
export type Node = z.infer<typeof NodeSchema>;
export type LLMConfig = z.infer<typeof LLMConfigSchema>;
export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;
export type ExecuteWorkflow = z.infer<typeof ExecuteWorkflowSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type SendMessage = z.infer<typeof SendMessageSchema>;
export type FileUpload = z.infer<typeof FileUploadSchema>;
export type LoginData = z.infer<typeof LoginSchema>;
export type RegisterData = z.infer<typeof RegisterSchema>;
export type AuthTokens = z.infer<typeof AuthTokensSchema>;
export type UserSettings = z.infer<typeof UserSettingsSchema>;
export type ApiResponse<T = any> = z.infer<typeof ApiResponseSchema> & { data?: T };
export type Pagination = z.infer<typeof PaginationSchema>;
export type AppError = z.infer<typeof AppErrorSchema>;
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
export type NodeTemplate = z.infer<typeof NodeTemplateSchema>;