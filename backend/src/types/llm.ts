/**
 * LLM Provider Types and Interfaces
 * Comprehensive type definitions for LLM integration system
 */

// Base LLM provider interface
export interface LLMProvider {
  name: string;
  type: LLMProviderType;
  capabilities: LLMAbilities;
  models: LLMModel[];
  isAvailable: boolean;
  
  // Core methods
  initialize(): Promise<void>;
  chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  stream(request: ChatCompletionRequest): Promise<AsyncIterable<ChatCompletionChunk>>;
  completion(request: CompletionRequest): Promise<CompletionResponse>;
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  
  // Utility methods
  countTokens(text: string, model?: string): Promise<number>;
  estimateCost(usage: TokenUsage, model: string): Promise<number>;
  validateModel(model: string): boolean;
  getModels(): LLMModel[];
}

// LLM Provider types
export enum LLMProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OLLAMA = 'ollama',
  AZURE_OPENAI = 'azure_openai',
  GOOGLE = 'google',
  HUGGINGFACE = 'huggingface',
  CUSTOM = 'custom'
}

// LLM capabilities
export interface LLMAbilities {
  chat: boolean;
  completion: boolean;
  embedding: boolean;
  functionCalling: boolean;
  streaming: boolean;
  vision: boolean;
  toolUse: boolean;
  imageGeneration: boolean;
  jsonMode: boolean;
  systemMessages: boolean;
}

// LLM Model information
export interface LLMModel {
  id: string;
  name: string;
  provider: LLMProviderType;
  type: ModelType;
  maxTokens: number;
  contextWindow: number;
  inputCostPer1K: number;
  outputCostPer1K: number;
  capabilities: string[];
  deprecated?: boolean;
  releasedAt?: Date;
}

export enum ModelType {
  CHAT = 'chat',
  COMPLETION = 'completion',
  EMBEDDING = 'embedding',
  VISION = 'vision',
  CODE = 'code',
  CUSTOM = 'custom'
}

// Chat completion request
export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string | string[];
  stream?: boolean;
  functions?: FunctionDefinition[];
  functionCall?: 'auto' | 'none' | { name: string };
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  responseFormat?: { type: 'text' | 'json_object' };
  seed?: number;
  user?: string;
  metadata?: Record<string, any>;
}

// Chat message
export interface ChatMessage {
  role: ChatMessageRole;
  content: string | null;
  name?: string;
  functionCall?: FunctionCall;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  metadata?: Record<string, any>;
}

export enum ChatMessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
  FUNCTION = 'function',
  TOOL = 'tool'
}

// Function calling
export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters: Record<string, any>;
  strict?: boolean;
}

export interface FunctionCall {
  name: string;
  arguments: string;
}

// Tool calling
export interface ToolDefinition {
  type: 'function';
  function: FunctionDefinition;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: FunctionCall;
}

// Chat completion response
export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: TokenUsage;
  systemFingerprint?: string;
  finishReason?: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter';
  metadata?: Record<string, any>;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finishReason: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter';
  logprobs?: any;
}

// Streaming response chunk
export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
  systemFingerprint?: string;
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: Partial<ChatMessage>;
  finishReason?: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter';
  logprobs?: any;
}

// Text completion request/response
export interface CompletionRequest {
  model: string;
  prompt: string | string[];
  suffix?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  n?: number;
  stream?: boolean;
  logprobs?: number;
  echo?: boolean;
  stop?: string | string[];
  presencePenalty?: number;
  frequencyPenalty?: number;
  bestOf?: number;
  logitBias?: Record<string, number>;
  user?: string;
  seed?: number;
}

export interface CompletionResponse {
  id: string;
  object: 'text_completion';
  created: number;
  model: string;
  choices: CompletionChoice[];
  usage: TokenUsage;
  systemFingerprint?: string;
}

export interface CompletionChoice {
  text: string;
  index: number;
  logprobs?: any;
  finishReason: 'stop' | 'length' | 'content_filter';
}

// Embedding request/response
export interface EmbeddingRequest {
  model: string;
  input: string | string[];
  encodingFormat?: 'float' | 'base64';
  dimensions?: number;
  user?: string;
}

export interface EmbeddingResponse {
  object: 'list';
  data: Embedding[];
  model: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

export interface Embedding {
  object: 'embedding';
  embedding: number[];
  index: number;
}

// Token usage tracking
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// Cost tracking
export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
  model: string;
}

// Rate limiting
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

// Error types
export interface LLMError extends Error {
  code: LLMErrorCode;
  type: 'invalid_request_error' | 'authentication_error' | 'permission_error' | 'not_found_error' | 'rate_limit_error' | 'api_error' | 'overloaded_error';
  param?: string;
  statusCode?: number;
  provider?: string;
}

export enum LLMErrorCode {
  INVALID_MODEL = 'invalid_model',
  INVALID_REQUEST = 'invalid_request',
  CONTEXT_LENGTH_EXCEEDED = 'context_length_exceeded',
  RATE_LIMITED = 'rate_limited',
  INSUFFICIENT_QUOTA = 'insufficient_quota',
  MODEL_NOT_FOUND = 'model_not_found',
  PROVIDER_ERROR = 'provider_error',
  NETWORK_ERROR = 'network_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  PERMISSION_ERROR = 'permission_error',
  VALIDATION_ERROR = 'validation_error'
}

// Provider configuration
export interface OpenAIConfig {
  apiKey: string;
  organization?: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  defaultHeaders?: Record<string, string>;
}

export interface OllamaConfig {
  baseURL: string;
  timeout?: number;
  modelPath?: string;
  numCtx?: number;
  temperature?: number;
  topP?: number;
  repeatPenalty?: number;
  seed?: number;
}

export interface AnthropicConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  defaultModel?: string;
}

export interface AzureOpenAIConfig {
  apiKey: string;
  endpoint: string;
  apiVersion: string;
  deploymentName?: string;
  timeout?: number;
  maxRetries?: number;
}

// LLM Service configuration
export interface LLMServiceConfig {
  defaultProvider: LLMProviderType;
  defaultModel: string;
  maxConcurrentRequests: number;
  requestTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableCaching: boolean;
  cacheTTL: number;
  enableRateLimiting: boolean;
  enableCostTracking: boolean;
  providers: {
    openai?: OpenAIConfig;
    ollama?: OllamaConfig;
    anthropic?: AnthropicConfig;
    azureOpenAI?: AzureOpenAIConfig;
  };
}

// Execution context
export interface LLMExecutionContext {
  requestId: string;
  userId: string;
  nodeId?: string;
  workflowId?: string;
  conversationId?: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

// Request options
export interface LLMRequestOptions {
  stream?: boolean;
  priority?: 'low' | 'normal' | 'high';
  timeout?: number;
  retries?: number;
  cache?: boolean;
  metadata?: Record<string, any>;
}

// Response metadata
export interface LLMResponseMetadata {
  requestId: string;
  provider: LLMProviderType;
  model: string;
  processingTime: number;
  tokenCount: TokenUsage;
  cost: CostEstimate;
  cached: boolean;
  rateLimit?: RateLimitInfo;
  warnings?: string[];
  metadata: Record<string, any>;
}

// Model capabilities
export interface ModelCapabilities {
  supportsStreaming: boolean;
  supportsFunctions: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsJSON: boolean;
  maxContextWindow: number;
  maxOutputTokens: number;
  inputTokenCost: number;
  outputTokenCost: number;
}

// Provider status
export interface ProviderStatus {
  provider: LLMProviderType;
  isAvailable: boolean;
  lastChecked: Date;
  responseTime: number;
  errorCount: number;
  statusMessage?: string;
  models: ModelStatus[];
}

export interface ModelStatus {
  id: string;
  isAvailable: boolean;
  responseTime?: number;
  lastUsed?: Date;
  usageCount: number;
  errorCount: number;
}

// Usage analytics
export interface UsageAnalytics {
  timeframe: 'hour' | 'day' | 'week' | 'month';
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  providerBreakdown: ProviderUsage[];
  modelBreakdown: ModelUsage[];
  errorRate: number;
  averageResponseTime: number;
}

export interface ProviderUsage {
  provider: LLMProviderType;
  requests: number;
  tokens: number;
  cost: number;
  percentage: number;
}

export interface ModelUsage {
  model: string;
  provider: LLMProviderType;
  requests: number;
  tokens: number;
  cost: number;
  averageResponseTime: number;
  errorRate: number;
}