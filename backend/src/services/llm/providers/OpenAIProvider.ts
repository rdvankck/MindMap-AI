import OpenAI from 'openai';
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
  LLMAbilities, 
  ModelType, 
  LLMError, 
  LLMErrorCode,
  OpenAIConfig,
  ChatMessageRole,
  ModelCapabilities
} from '@/types/llm';
import { logger } from '@/utils/logger';

export class OpenAIProvider implements LLMProvider {
  public readonly name = 'OpenAI';
  public readonly type = LLMProviderType.OPENAI;
  public readonly capabilities: LLMAbilities;
  public readonly models: LLMModel[];
  public isAvailable = false;
  
  private client: OpenAI;
  private config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization,
      baseURL: config.baseURL,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3,
      defaultHeaders: config.defaultHeaders,
    });

    this.capabilities = {
      chat: true,
      completion: true,
      embedding: true,
      functionCalling: true,
      streaming: true,
      vision: true,
      toolUse: true,
      imageGeneration: false,
      jsonMode: true,
      systemMessages: true,
    };

    this.models = this.initializeModels();
  }

  async initialize(): Promise<void> {
    try {
      // Test API connection
      await this.client.models.list();
      this.isAvailable = true;
      logger.info('OpenAI provider initialized successfully');
    } catch (error) {
      this.isAvailable = false;
      logger.error('Failed to initialize OpenAI provider:', error);
      throw this.handleError(error);
    }
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      const openaiRequest = this.transformChatRequest(request);
      const response = await this.client.chat.completions.create(openaiRequest);
      
      return this.transformChatResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *stream(request: ChatCompletionRequest): AsyncIterable<ChatCompletionChunk> {
    try {
      const openaiRequest = this.transformChatRequest({ ...request, stream: true });
      const stream = await this.client.chat.completions.create(openaiRequest);

      for await (const chunk of stream) {
        yield this.transformChatChunk(chunk);
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async completion(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const openaiRequest = this.transformCompletionRequest(request);
      const response = await this.client.completions.create(openaiRequest);
      
      return this.transformCompletionResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    try {
      const openaiRequest = this.transformEmbeddingRequest(request);
      const response = await this.client.embeddings.create(openaiRequest);
      
      return this.transformEmbeddingResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async countTokens(text: string, model?: string): Promise<number> {
    try {
      // Use tiktoken for accurate token counting
      // For now, use a simple approximation
      const modelToUse = model || 'gpt-3.5-turbo';
      
      if (modelToUse.includes('gpt-4')) {
        return Math.ceil(text.length / 3.5);
      } else {
        return Math.ceil(text.length / 4);
      }
    } catch (error) {
      logger.warn('Token counting failed, using fallback:', error);
      return Math.ceil(text.length / 4);
    }
  }

  async estimateCost(usage: TokenUsage, model: string): Promise<number> {
    const modelInfo = this.models.find(m => m.id === model);
    if (!modelInfo) {
      throw new Error(`Model ${model} not found`);
    }

    const inputCost = (usage.promptTokens / 1000) * modelInfo.inputCostPer1K;
    const outputCost = (usage.completionTokens / 1000) * modelInfo.outputCostPer1K;
    
    return inputCost + outputCost;
  }

  validateModel(model: string): boolean {
    return this.models.some(m => m.id === model && !m.deprecated);
  }

  getModels(): LLMModel[] {
    return this.models.filter(m => !m.deprecated);
  }

  private initializeModels(): LLMModel[] {
    return [
      // GPT-4 Turbo models
      {
        id: 'gpt-4-turbo-preview',
        name: 'GPT-4 Turbo Preview',
        provider: this.type,
        type: ModelType.CHAT,
        maxTokens: 4096,
        contextWindow: 128000,
        inputCostPer1K: 0.01,
        outputCostPer1K: 0.03,
        capabilities: ['chat', 'function_calling', 'vision', 'json_mode', 'streaming'],
      },
      {
        id: 'gpt-4-1106-preview',
        name: 'GPT-4 Turbo (1106)',
        provider: this.type,
        type: ModelType.CHAT,
        maxTokens: 4096,
        contextWindow: 128000,
        inputCostPer1K: 0.01,
        outputCostPer1K: 0.03,
        capabilities: ['chat', 'function_calling', 'vision', 'json_mode', 'streaming'],
      },
      {
        id: 'gpt-4-0125-preview',
        name: 'GPT-4 Turbo (0125)',
        provider: this.type,
        type: ModelType.CHAT,
        maxTokens: 4096,
        contextWindow: 128000,
        inputCostPer1K: 0.01,
        outputCostPer1K: 0.03,
        capabilities: ['chat', 'function_calling', 'vision', 'json_mode', 'streaming'],
      },
      
      // GPT-4 models
      {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: this.type,
        type: ModelType.CHAT,
        maxTokens: 8192,
        contextWindow: 8192,
        inputCostPer1K: 0.03,
        outputCostPer1K: 0.06,
        capabilities: ['chat', 'function_calling', 'streaming'],
      },
      {
        id: 'gpt-4-32k',
        name: 'GPT-4 32K',
        provider: this.type,
        type: ModelType.CHAT,
        maxTokens: 32768,
        contextWindow: 32768,
        inputCostPer1K: 0.06,
        outputCostPer1K: 0.12,
        capabilities: ['chat', 'function_calling', 'streaming'],
      },
      
      // GPT-3.5 Turbo models
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: this.type,
        type: ModelType.CHAT,
        maxTokens: 4096,
        contextWindow: 4096,
        inputCostPer1K: 0.0015,
        outputCostPer1K: 0.002,
        capabilities: ['chat', 'function_calling', 'streaming'],
      },
      {
        id: 'gpt-3.5-turbo-16k',
        name: 'GPT-3.5 Turbo 16K',
        provider: this.type,
        type: ModelType.CHAT,
        maxTokens: 16384,
        contextWindow: 16384,
        inputCostPer1K: 0.003,
        outputCostPer1K: 0.004,
        capabilities: ['chat', 'function_calling', 'streaming'],
      },
      
      // Vision models
      {
        id: 'gpt-4-vision-preview',
        name: 'GPT-4 Vision Preview',
        provider: this.type,
        type: ModelType.VISION,
        maxTokens: 4096,
        contextWindow: 128000,
        inputCostPer1K: 0.01,
        outputCostPer1K: 0.03,
        capabilities: ['chat', 'vision', 'function_calling', 'streaming'],
      },
      
      // Embedding models
      {
        id: 'text-embedding-ada-002',
        name: 'Text Embedding Ada 002',
        provider: this.type,
        type: ModelType.EMBEDDING,
        maxTokens: 8191,
        contextWindow: 8191,
        inputCostPer1K: 0.0001,
        outputCostPer1K: 0,
        capabilities: ['embedding'],
      },
      {
        id: 'text-embedding-3-small',
        name: 'Text Embedding 3 Small',
        provider: this.type,
        type: ModelType.EMBEDDING,
        maxTokens: 8191,
        contextWindow: 8191,
        inputCostPer1K: 0.00002,
        outputCostPer1K: 0,
        capabilities: ['embedding'],
      },
      {
        id: 'text-embedding-3-large',
        name: 'Text Embedding 3 Large',
        provider: this.type,
        type: ModelType.EMBEDDING,
        maxTokens: 8191,
        contextWindow: 8191,
        inputCostPer1K: 0.00013,
        outputCostPer1K: 0,
        capabilities: ['embedding'],
      },
      
      // Completion models (legacy)
      {
        id: 'text-davinci-003',
        name: 'Text Davinci 003',
        provider: this.type,
        type: ModelType.COMPLETION,
        maxTokens: 4096,
        contextWindow: 4096,
        inputCostPer1K: 0.02,
        outputCostPer1K: 0.02,
        capabilities: ['completion'],
        deprecated: true,
      },
      {
        id: 'text-curie-001',
        name: 'Text Curie 001',
        provider: this.type,
        type: ModelType.COMPLETION,
        maxTokens: 2048,
        contextWindow: 2048,
        inputCostPer1K: 0.002,
        outputCostPer1K: 0.002,
        capabilities: ['completion'],
      },
    ];
  }

  private transformChatRequest(request: ChatCompletionRequest): any {
    const transformed: any = {
      model: request.model,
      messages: request.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        name: msg.name,
        function_call: msg.functionCall,
        tool_calls: msg.toolCalls,
      })),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      frequency_penalty: request.frequencyPenalty,
      presence_penalty: request.presencePenalty,
      stop: request.stop,
      stream: request.stream,
      seed: request.seed,
      user: request.user,
    };

    // Handle function calling (legacy)
    if (request.functions && request.functions.length > 0) {
      transformed.functions = request.functions;
    }

    if (request.functionCall) {
      transformed.function_call = request.functionCall;
    }

    // Handle tool calling (new)
    if (request.tools && request.tools.length > 0) {
      transformed.tools = request.tools;
    }

    if (request.toolChoice) {
      transformed.tool_choice = request.toolChoice;
    }

    // Handle response format
    if (request.responseFormat) {
      transformed.response_format = request.responseFormat;
    }

    return transformed;
  }

  private transformChatResponse(response: any): ChatCompletionResponse {
    return {
      id: response.id,
      object: 'chat.completion',
      created: response.created,
      model: response.model,
      choices: response.choices.map((choice: any) => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content,
          name: choice.message.name,
          functionCall: choice.message.function_call,
          toolCalls: choice.message.tool_calls,
          metadata: {},
        },
        finishReason: choice.finish_reason,
        logprobs: choice.logprobs,
      })),
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      systemFingerprint: response.system_fingerprint,
      finishReason: response.choices[0]?.finish_reason,
      metadata: {},
    };
  }

  private transformChatChunk(chunk: any): ChatCompletionChunk {
    return {
      id: chunk.id,
      object: 'chat.completion.chunk',
      created: chunk.created,
      model: chunk.model,
      choices: chunk.choices.map((choice: any) => ({
        index: choice.index,
        delta: {
          role: choice.delta?.role,
          content: choice.delta?.content,
          functionCall: choice.delta?.function_call,
          toolCalls: choice.delta?.tool_calls,
        },
        finishReason: choice.finish_reason,
        logprobs: choice.logprobs,
      })),
      systemFingerprint: chunk.system_fingerprint,
    };
  }

  private transformCompletionRequest(request: CompletionRequest): any {
    return {
      model: request.model,
      prompt: request.prompt,
      suffix: request.suffix,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      top_p: request.topP,
      n: request.n,
      stream: request.stream,
      logprobs: request.logprobs,
      echo: request.echo,
      stop: request.stop,
      presence_penalty: request.presencePenalty,
      frequency_penalty: request.frequencyPenalty,
      best_of: request.bestOf,
      logit_bias: request.logitBias,
      user: request.user,
      seed: request.seed,
    };
  }

  private transformCompletionResponse(response: any): CompletionResponse {
    return {
      id: response.id,
      object: 'text_completion',
      created: response.created,
      model: response.model,
      choices: response.choices.map((choice: any) => ({
        text: choice.text,
        index: choice.index,
        logprobs: choice.logprobs,
        finishReason: choice.finish_reason,
      })),
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      systemFingerprint: response.system_fingerprint,
    };
  }

  private transformEmbeddingRequest(request: EmbeddingRequest): any {
    return {
      model: request.model,
      input: request.input,
      encoding_format: request.encodingFormat,
      dimensions: request.dimensions,
      user: request.user,
    };
  }

  private transformEmbeddingResponse(response: any): EmbeddingResponse {
    return {
      object: response.object,
      data: response.data.map((item: any) => ({
        object: item.object,
        embedding: item.embedding,
        index: item.index,
      })),
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  }

  private handleError(error: any): LLMError {
    if (error instanceof OpenAI.APIError) {
      const llmError = new Error(error.message) as LLMError;
      llmError.code = this.mapOpenAIErrortoLLMErrorCode(error.code);
      llmError.type = error.type as any;
      llmError.param = error.param;
      llmError.statusCode = error.status;
      llmError.provider = this.name;
      return llmError;
    }

    const llmError = new Error(error.message) as LLMError;
    llmError.code = LLMErrorCode.PROVIDER_ERROR;
    llmError.type = 'api_error';
    llmError.provider = this.name;
    return llmError;
  }

  private mapOpenAIErrortoLLMErrorCode(openaiCode?: string): LLMErrorCode {
    switch (openaiCode) {
      case 'model_not_found':
        return LLMErrorCode.MODEL_NOT_FOUND;
      case 'invalid_model':
        return LLMErrorCode.INVALID_MODEL;
      case 'context_length_exceeded':
        return LLMErrorCode.CONTEXT_LENGTH_EXCEEDED;
      case 'rate_limit_exceeded':
        return LLMErrorCode.RATE_LIMITED;
      case 'insufficient_quota':
        return LLMErrorCode.INSUFFICIENT_QUOTA;
      case 'invalid_request_error':
        return LLMErrorCode.INVALID_REQUEST;
      case 'authentication_error':
        return LLMErrorCode.AUTHENTICATION_ERROR;
      case 'permission_error':
        return LLMErrorCode.PERMISSION_ERROR;
      default:
        return LLMErrorCode.PROVIDER_ERROR;
    }
  }
}