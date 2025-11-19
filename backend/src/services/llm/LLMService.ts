import { EventEmitter } from 'events';
import { 
  LLMProvider, 
  LLMProviderType, 
  ChatCompletionRequest, 
  ChatCompletionResponse, 
  ChatCompletionChunk, 
  CompletionRequest, 
  CompletionResponse, 
  EmbeddingRequest, 
  EmbeddingResponse, 
  TokenUsage, 
  CostEstimate, 
  LLMModel, 
  LLMServiceConfig, 
  LLMExecutionContext, 
  LLMRequestOptions, 
  LLMResponseMetadata,
  LLMError,
  LLMErrorCode,
  ProviderStatus,
  UsageAnalytics,
  ModelCapabilities,
  RateLimitInfo
} from '@/types/llm';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { logger } from '@/utils/logger';
import { Redis } from 'ioredis';
import { redis } from '@/config/redis';
import { config } from '@/config';

interface QueuedRequest {
  id: string;
  request: any;
  type: 'chat' | 'completion' | 'embedding';
  options: LLMRequestOptions;
  context: LLMExecutionContext;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
  timeout?: NodeJS.Timeout;
}

interface CacheEntry {
  data: any;
  metadata: LLMResponseMetadata;
  expiresAt: number;
}

export class LLMService extends EventEmitter {
  private providers: Map<LLMProviderType, LLMProvider> = new Map();
  private config: LLMServiceConfig;
  private redis: Redis;
  private requestQueue: QueuedRequest[] = [];
  private activeRequests: Map<string, QueuedRequest> = new Map();
  private isProcessing = false;
  private requestCounter = 0;
  private usageData: Map<string, any> = new Map();

  constructor(config?: Partial<LLMServiceConfig>) {
    super();
    
    this.config = {
      defaultProvider: LLMProviderType.OPENAI,
      defaultModel: 'gpt-3.5-turbo',
      maxConcurrentRequests: 10,
      requestTimeout: 120000,
      retryAttempts: 3,
      retryDelay: 1000,
      enableCaching: true,
      cacheTTL: 3600,
      enableRateLimiting: true,
      enableCostTracking: true,
      providers: {
        openai: {
          apiKey: config.openai?.apiKey || process.env.OPENAI_API_KEY || '',
          organization: config.openai?.organization || process.env.OPENAI_ORGANIZATION,
          timeout: config.openai?.timeout || 60000,
          maxRetries: config.openai?.maxRetries || 3,
        },
        ollama: {
          baseUrl: config.ollama?.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
          timeout: config.ollama?.timeout || 120000,
        },
      },
      ...config,
    };

    this.redis = redis;
    this.initializeProviders();
    this.startQueueProcessor();
    this.startHealthChecks();
  }

  async initialize(): Promise<void> {
    try {
      const initPromises = Array.from(this.providers.values()).map(provider => 
        provider.initialize().catch(error => {
          logger.warn(`Failed to initialize ${provider.name} provider:`, error);
        })
      );

      await Promise.allSettled(initPromises);
      
      logger.info(`LLM Service initialized with ${this.providers.size} providers`);
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize LLM Service:', error);
      throw error;
    }
  }

  async chat(
    request: ChatCompletionRequest, 
    options: LLMRequestOptions = {},
    context: Partial<LLMExecutionContext> = {}
  ): Promise<ChatCompletionResponse & { metadata: LLMResponseMetadata }> {
    const executionContext = this.createExecutionContext(context);
    
    try {
      // Check cache first
      if (options.cache !== false && this.config.enableCaching) {
        const cached = await this.getFromCache('chat', request, options);
        if (cached) {
          this.recordUsage(executionContext, cached.metadata, true);
          return { ...cached.data, metadata: cached.metadata };
        }
      }

      // Add to queue
      const response = await this.queueRequest('chat', request, options, executionContext);
      
      // Cache the response
      if (options.cache !== false && this.config.enableCaching) {
        await this.setCache('chat', request, response, options);
      }

      this.recordUsage(executionContext, response.metadata, false);
      this.emit('chat_completed', { request, response, context: executionContext });
      
      return response;
    } catch (error) {
      logger.error('Chat request failed:', error);
      this.emit('chat_error', { request, error, context: executionContext });
      throw error;
    }
  }

  async *chatStream(
    request: ChatCompletionRequest, 
    options: LLMRequestOptions = {},
    context: Partial<LLMExecutionContext> = {}
  ): AsyncIterable<ChatCompletionChunk & { metadata: Partial<LLMResponseMetadata> }> {
    const executionContext = this.createExecutionContext(context);
    const startTime = Date.now();
    
    try {
      const provider = this.getProvider(request.model);
      
      this.emit('stream_started', { request, context: executionContext });
      
      for await (const chunk of provider.stream(request)) {
        const partialMetadata: Partial<LLMResponseMetadata> = {
          requestId: executionContext.requestId,
          provider: provider.type,
          model: request.model,
          processingTime: Date.now() - startTime,
          cached: false,
          metadata: { stream: true },
        };
        
        yield { ...chunk, metadata: partialMetadata };
      }
      
      this.emit('stream_completed', { request, context: executionContext });
    } catch (error) {
      logger.error('Chat stream failed:', error);
      this.emit('stream_error', { request, error, context: executionContext });
      throw error;
    }
  }

  async completion(
    request: CompletionRequest, 
    options: LLMRequestOptions = {},
    context: Partial<LLMExecutionContext> = {}
  ): Promise<CompletionResponse & { metadata: LLMResponseMetadata }> {
    const executionContext = this.createExecutionContext(context);
    
    try {
      // Check cache first
      if (options.cache !== false && this.config.enableCaching) {
        const cached = await this.getFromCache('completion', request, options);
        if (cached) {
          this.recordUsage(executionContext, cached.metadata, true);
          return { ...cached.data, metadata: cached.metadata };
        }
      }

      const response = await this.queueRequest('completion', request, options, executionContext);
      
      // Cache the response
      if (options.cache !== false && this.config.enableCaching) {
        await this.setCache('completion', request, response, options);
      }

      this.recordUsage(executionContext, response.metadata, false);
      this.emit('completion_completed', { request, response, context: executionContext });
      
      return response;
    } catch (error) {
      logger.error('Completion request failed:', error);
      this.emit('completion_error', { request, error, context: executionContext });
      throw error;
    }
  }

  async embed(
    request: EmbeddingRequest, 
    options: LLMRequestOptions = {},
    context: Partial<LLMExecutionContext> = {}
  ): Promise<EmbeddingResponse & { metadata: LLMResponseMetadata }> {
    const executionContext = this.createExecutionContext(context);
    
    try {
      const response = await this.queueRequest('embedding', request, options, executionContext);
      this.recordUsage(executionContext, response.metadata, false);
      this.emit('embedding_completed', { request, response, context: executionContext });
      
      return response;
    } catch (error) {
      logger.error('Embedding request failed:', error);
      this.emit('embedding_error', { request, error, context: executionContext });
      throw error;
    }
  }

  async getAvailableProviders(): Promise<ProviderStatus[]> {
    const statuses: ProviderStatus[] = [];
    
    for (const [type, provider] of this.providers) {
      try {
        const startTime = Date.now();
        await provider.getModels(); // Simple health check
        const responseTime = Date.now() - startTime;
        
        statuses.push({
          provider: type,
          isAvailable: provider.isAvailable,
          lastChecked: new Date(),
          responseTime,
          errorCount: 0,
          models: provider.getModels().map(model => ({
            id: model.id,
            isAvailable: true,
            usageCount: 0,
            errorCount: 0,
          })),
        });
      } catch (error) {
        statuses.push({
          provider: type,
          isAvailable: false,
          lastChecked: new Date(),
          responseTime: 0,
          errorCount: 1,
          statusMessage: error instanceof Error ? error.message : 'Unknown error',
          models: [],
        });
      }
    }
    
    return statuses;
  }

  async getAvailableModels(provider?: LLMProviderType): Promise<LLMModel[]> {
    if (provider) {
      const providerInstance = this.providers.get(provider);
      return providerInstance?.getModels() || [];
    }
    
    const allModels: LLMModel[] = [];
    for (const providerInstance of this.providers.values()) {
      if (providerInstance.isAvailable) {
        allModels.push(...providerInstance.getModels());
      }
    }
    
    return allModels;
  }

  async estimateTokens(text: string, model?: string): Promise<number> {
    if (!model) {
      model = this.config.defaultModel;
    }
    
    const provider = this.getProvider(model);
    return provider.countTokens(text, model);
  }

  async estimateCost(usage: TokenUsage, model: string): Promise<CostEstimate> {
    const provider = this.getProvider(model);
    const totalCost = await provider.estimateCost(usage, model);
    
    // Estimate input/output cost breakdown
    const modelInfo = provider.getModels().find(m => m.id === model);
    const inputCost = modelInfo ? (usage.promptTokens / 1000) * modelInfo.inputCostPer1K : 0;
    const outputCost = modelInfo ? (usage.completionTokens / 1000) * modelInfo.outputCostPer1K : 0;
    
    return {
      inputCost,
      outputCost,
      totalCost,
      currency: 'USD',
      model,
    };
  }

  async getUsageAnalytics(timeframe: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<UsageAnalytics> {
    const key = `llm:analytics:${timeframe}`;
    const cached = await this.redis.get(key);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Calculate from usage data
    const now = new Date();
    const timeframeStart = this.getTimeframeStart(now, timeframe);
    
    let totalRequests = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let errorCount = 0;
    let totalResponseTime = 0;
    let responseCount = 0;
    
    const providerBreakdown = new Map<LLMProviderType, any>();
    const modelBreakdown = new Map<string, any>();
    
    // This would typically query a database or use more sophisticated analytics
    // For now, return basic analytics
    
    const analytics: UsageAnalytics = {
      timeframe,
      totalRequests,
      totalTokens,
      totalCost,
      providerBreakdown: Array.from(providerBreakdown.values()),
      modelBreakdown: Array.from(modelBreakdown.values()),
      errorRate: totalRequests > 0 ? errorCount / totalRequests : 0,
      averageResponseTime: responseCount > 0 ? totalResponseTime / responseCount : 0,
    };
    
    // Cache for 5 minutes
    await this.redis.setex(key, 300, JSON.stringify(analytics));
    
    return analytics;
  }

  async getModelCapabilities(model: string): Promise<ModelCapabilities> {
    const provider = this.getProvider(model);
    const modelInfo = provider.getModels().find(m => m.id === model);
    
    if (!modelInfo) {
      throw new LLMError(
        `Model ${model} not found`,
        LLMErrorCode.MODEL_NOT_FOUND,
        'not_found_error'
      );
    }
    
    return {
      supportsStreaming: modelInfo.capabilities.includes('streaming'),
      supportsFunctions: modelInfo.capabilities.includes('function_calling'),
      supportsTools: modelInfo.capabilities.includes('tool_use'),
      supportsVision: modelInfo.capabilities.includes('vision'),
      supportsJSON: modelInfo.capabilities.includes('json_mode'),
      maxContextWindow: modelInfo.contextWindow,
      maxOutputTokens: modelInfo.maxTokens,
      inputTokenCost: modelInfo.inputCostPer1K,
      outputTokenCost: modelInfo.outputCostPer1K,
    };
  }

  private initializeProviders(): void {
    // Initialize OpenAI provider
    if (this.config.providers.openai?.apiKey) {
      const openaiProvider = new OpenAIProvider(this.config.providers.openai);
      this.providers.set(LLMProviderType.OPENAI, openaiProvider);
    }
    
    // Initialize Ollama provider
    if (this.config.providers.ollama?.baseUrl) {
      const ollamaProvider = new OllamaProvider(this.config.providers.ollama);
      this.providers.set(LLMProviderType.OLLAMA, ollamaProvider);
    }
  }

  private createExecutionContext(partial: Partial<LLMExecutionContext>): LLMExecutionContext {
    return {
      requestId: `req-${++this.requestCounter}-${Date.now()}`,
      userId: partial.userId || 'anonymous',
      nodeId: partial.nodeId,
      workflowId: partial.workflowId,
      conversationId: partial.conversationId,
      timestamp: new Date(),
      metadata: partial.metadata || {},
    };
  }

  private getProvider(model?: string): LLMProvider {
    if (!model) {
      model = this.config.defaultModel;
    }
    
    // Try to find provider by model
    for (const provider of this.providers.values()) {
      if (provider.validateModel(model)) {
        return provider;
      }
    }
    
    // Fallback to default provider
    const defaultProvider = this.providers.get(this.config.defaultProvider);
    if (!defaultProvider) {
      throw new LLMError(
        'No LLM providers available',
        LLMErrorCode.PROVIDER_ERROR,
        'api_error'
      );
    }
    
    return defaultProvider;
  }

  private async queueRequest(
    type: 'chat' | 'completion' | 'embedding',
    request: any,
    options: LLMRequestOptions,
    context: LLMExecutionContext
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id: context.requestId,
        request,
        type,
        options,
        context,
        resolve,
        reject,
        timestamp: Date.now(),
      };
      
      // Set timeout
      if (options.timeout || this.config.requestTimeout) {
        queuedRequest.timeout = setTimeout(() => {
          this.removeFromQueue(queuedRequest.id);
          reject(new LLMError(
            'Request timeout',
            LLMErrorCode.PROVIDER_ERROR,
            'api_error'
          ));
        }, options.timeout || this.config.requestTimeout);
      }
      
      this.requestQueue.push(queuedRequest);
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.activeRequests.size >= this.config.maxConcurrentRequests) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.requestQueue.length > 0 && this.activeRequests.size < this.config.maxConcurrentRequests) {
      const queuedRequest = this.requestQueue.shift();
      if (!queuedRequest) break;
      
      this.activeRequests.set(queuedRequest.id, queuedRequest);
      
      // Process request asynchronously
      this.processRequest(queuedRequest)
        .finally(() => {
          this.activeRequests.delete(queuedRequest.id);
          if (queuedRequest.timeout) {
            clearTimeout(queuedRequest.timeout);
          }
        });
    }
    
    this.isProcessing = false;
  }

  private async processRequest(queuedRequest: QueuedRequest): Promise<void> {
    const { request, type, options, context, resolve, reject } = queuedRequest;
    const startTime = Date.now();
    
    try {
      const provider = this.getProvider(request.model);
      
      let response: any;
      let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      
      switch (type) {
        case 'chat':
          response = await provider.chat(request);
          usage = response.usage;
          break;
        case 'completion':
          response = await provider.completion(request);
          usage = response.usage;
          break;
        case 'embedding':
          response = await provider.embed(request);
          usage = {
            promptTokens: response.usage.promptTokens,
            completionTokens: 0,
            totalTokens: response.usage.totalTokens,
          };
          break;
        default:
          throw new LLMError(
            `Unknown request type: ${type}`,
            LLMErrorCode.INVALID_REQUEST,
            'invalid_request_error'
          );
      }
      
      const processingTime = Date.now() - startTime;
      const cost = this.config.enableCostTracking 
        ? await provider.estimateCost(usage, request.model)
        : { inputCost: 0, outputCost: 0, totalCost: 0, currency: 'USD', model: request.model };
      
      const metadata: LLMResponseMetadata = {
        requestId: context.requestId,
        provider: provider.type,
        model: request.model,
        processingTime,
        tokenCount: usage,
        cost,
        cached: false,
        metadata: { ...context.metadata, type },
      };
      
      resolve({ ...response, metadata });
    } catch (error) {
      if (options.retries && options.retries > 0) {
        // Retry logic
        const retryDelay = this.config.retryDelay * (this.config.retryAttempts - options.retries + 1);
        setTimeout(() => {
          this.queueRequest(type, request, { ...options, retries: options.retries - 1 }, context)
            .then(resolve)
            .catch(reject);
        }, retryDelay);
        return;
      }
      
      reject(error);
    }
  }

  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, 100);
  }

  private startHealthChecks(): void {
    setInterval(async () => {
      const statuses = await this.getAvailableProviders();
      this.emit('health_check', statuses);
    }, 60000); // Check every minute
  }

  private async getFromCache(
    type: string,
    request: any,
    options: LLMRequestOptions
  ): Promise<CacheEntry | null> {
    try {
      const cacheKey = this.generateCacheKey(type, request);
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        const entry: CacheEntry = JSON.parse(cached);
        
        if (entry.expiresAt > Date.now()) {
          return entry;
        } else {
          await this.redis.del(cacheKey);
        }
      }
      
      return null;
    } catch (error) {
      logger.warn('Cache read failed:', error);
      return null;
    }
  }

  private async setCache(
    type: string,
    request: any,
    response: any,
    options: LLMRequestOptions
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(type, request);
      const entry: CacheEntry = {
        data: response,
        metadata: response.metadata,
        expiresAt: Date.now() + (this.config.cacheTTL * 1000),
      };
      
      await this.redis.setex(cacheKey, this.config.cacheTTL, JSON.stringify(entry));
    } catch (error) {
      logger.warn('Cache write failed:', error);
    }
  }

  private generateCacheKey(type: string, request: any): string {
    const hash = require('crypto')
      .createHash('sha256')
      .update(JSON.stringify(request))
      .digest('hex');
    
    return `llm:cache:${type}:${hash}`;
  }

  private removeFromQueue(requestId: string): void {
    const index = this.requestQueue.findIndex(req => req.id === requestId);
    if (index !== -1) {
      this.requestQueue.splice(index, 1);
    }
  }

  private recordUsage(context: LLMExecutionContext, metadata: LLMResponseMetadata, cached: boolean): void {
    const key = `usage:${context.userId}:${new Date().toISOString().slice(0, 7)}`;
    const usage = {
      requests: 1,
      tokens: metadata.tokenCount.totalTokens,
      cost: metadata.cost.totalCost,
      cached: cached ? 1 : 0,
      provider: metadata.provider,
      model: metadata.model,
      timestamp: Date.now(),
    };
    
    // This would typically be stored in a database for analytics
    // For now, we'll just log it
    logger.debug('Usage recorded:', usage);
  }

  private getTimeframeStart(now: Date, timeframe: string): Date {
    const start = new Date(now);
    
    switch (timeframe) {
      case 'hour':
        start.setMinutes(0, 0, 0);
        break;
      case 'day':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
    }
    
    return start;
  }
}

export const llmService = new LLMService({
  ...config,
  providers: {
    openai: config.openai,
    ollama: config.ollama,
  },
});