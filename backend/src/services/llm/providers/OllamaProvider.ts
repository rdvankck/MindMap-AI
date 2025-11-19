import axios, { AxiosInstance } from 'axios';
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
  OllamaConfig,
  ChatMessageRole
} from '@/types/llm';
import { logger } from '@/utils/logger';

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaChatRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
    images?: string[];
  }>;
  format?: string;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    num_ctx?: number;
    repeat_penalty?: number;
    seed?: number;
    stop?: string[];
  };
  stream?: boolean;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    };
  }>;
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
  tool_calls?: any[];
}

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  suffix?: string;
  system?: string;
  context?: number[];
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    num_ctx?: number;
    repeat_penalty?: number;
    seed?: number;
    stop?: string[];
  };
  stream?: boolean;
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaEmbeddingRequest {
  model: string;
  prompt: string;
  options?: {
    num_ctx?: number;
  };
}

interface OllamaEmbeddingResponse {
  embeddings: number[];
}

export class OllamaProvider implements LLMProvider {
  public readonly name = 'Ollama';
  public readonly type = LLMProviderType.OLLAMA;
  public readonly capabilities: LLMAbilities;
  public models: LLMModel[] = [];
  public isAvailable = false;
  
  private client: AxiosInstance;
  private config: OllamaConfig;
  private modelCache: Map<string, LLMModel> = new Map();

  constructor(config: OllamaConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 120000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.capabilities = {
      chat: true,
      completion: true,
      embedding: false, // Ollama doesn't have dedicated embedding endpoints
      functionCalling: false, // Limited support
      streaming: true,
      vision: true, // Some models support vision
      toolUse: false,
      imageGeneration: false,
      jsonMode: false,
      systemMessages: true,
    };
  }

  async initialize(): Promise<void> {
    try {
      // Test connection and fetch available models
      await this.fetchAvailableModels();
      this.isAvailable = true;
      logger.info(`Ollama provider initialized with ${this.models.length} models`);
    } catch (error) {
      this.isAvailable = false;
      logger.error('Failed to initialize Ollama provider:', error);
      throw this.handleError(error);
    }
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      const ollamaRequest = this.transformChatRequest(request);
      const response = await this.client.post<OllamaChatResponse>('/api/chat', ollamaRequest);
      
      return this.transformChatResponse(response.data, request);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *stream(request: ChatCompletionRequest): AsyncIterable<ChatCompletionChunk> {
    try {
      const ollamaRequest = this.transformChatRequest({ ...request, stream: true });
      
      const response = await this.client.post('/api/chat', ollamaRequest, {
        responseType: 'stream',
      });

      let buffer = '';
      
      for await (const chunk of response.data) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              yield this.transformChatChunk(data, request);
              
              if (data.done) {
                return;
              }
            } catch (parseError) {
              logger.warn('Failed to parse streaming chunk:', parseError);
            }
          }
        }
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async completion(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const ollamaRequest = this.transformCompletionRequest(request);
      const response = await this.client.post<OllamaGenerateResponse>('/api/generate', ollamaRequest);
      
      return this.transformCompletionResponse(response.data, request);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    try {
      // Ollama doesn't have a dedicated embedding endpoint
      // We can use some models that support embeddings, but it's not standardized
      throw new LLMError(
        'Ollama does not support embeddings through a standard API endpoint',
        LLMErrorCode.INVALID_REQUEST,
        'invalid_request_error',
        this.name
      );
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async countTokens(text: string, model?: string): Promise<number> {
    try {
      // Ollama doesn't provide token counting
      // Use approximation based on model family
      const modelName = model || 'llama2';
      const modelInfo = this.models.find(m => m.id.includes(modelName));
      
      if (modelInfo?.name.toLowerCase().includes('llama')) {
        return Math.ceil(text.length / 3.5);
      } else if (modelInfo?.name.toLowerCase().includes('mistral')) {
        return Math.ceil(text.length / 4);
      } else {
        return Math.ceil(text.length / 4);
      }
    } catch (error) {
      logger.warn('Token counting failed, using fallback:', error);
      return Math.ceil(text.length / 4);
    }
  }

  async estimateCost(usage: TokenUsage, model: string): Promise<number> {
    // Ollama is locally hosted, so no direct cost
    // We could estimate based on compute resources if needed
    return 0;
  }

  validateModel(model: string): boolean {
    return this.models.some(m => m.id === model || m.id.includes(model));
  }

  getModels(): LLMModel[] {
    return this.models;
  }

  async refreshModels(): Promise<void> {
    try {
      await this.fetchAvailableModels();
      logger.info('Ollama models refreshed successfully');
    } catch (error) {
      logger.error('Failed to refresh Ollama models:', error);
      throw this.handleError(error);
    }
  }

  private async fetchAvailableModels(): Promise<void> {
    try {
      const response = await this.client.get<OllamaModel[]>('/api/tags');
      const ollamaModels = response.data.models || [];
      
      this.models = ollamaModels.map(ollamaModel => this.convertOllamaModel(ollamaModel));
      
      // Add some common models that might not be pulled yet
      const commonModels = [
        { name: 'llama2', displayName: 'Llama 2' },
        { name: 'llama2:13b', displayName: 'Llama 2 13B' },
        { name: 'llama2:70b', displayName: 'Llama 2 70B' },
        { name: 'mistral', displayName: 'Mistral' },
        { name: 'mistral:7b', displayName: 'Mistral 7B' },
        { name: 'mixtral', displayName: 'Mixtral' },
        { name: 'codellama', displayName: 'Code Llama' },
        { name: 'codellama:7b', displayName: 'Code Llama 7B' },
        { name: 'codellama:13b', displayName: 'Code Llama 13B' },
        { name: 'qwen', displayName: 'Qwen' },
        { name: 'gemma', displayName: 'Gemma' },
      ];

      for (const commonModel of commonModels) {
        if (!this.models.some(m => m.id.includes(commonModel.name))) {
          this.models.push(this.createPlaceholderModel(commonModel.name, commonModel.displayName));
        }
      }
    } catch (error) {
      logger.error('Failed to fetch Ollama models:', error);
      // Still provide some default models
      this.models = this.getDefaultModels();
    }
  }

  private convertOllamaModel(ollamaModel: OllamaModel): LLMModel {
    const name = ollamaModel.name.split(':')[0];
    const size = ollamaModel.details.parameter_size || '';
    
    // Estimate model capabilities based on name and details
    const capabilities = this.getModelCapabilities(ollamaModel.name);
    const maxTokens = this.estimateMaxTokens(ollamaModel.name);
    
    return {
      id: ollamaModel.name,
      name: ollamaModel.name,
      provider: this.type,
      type: capabilities.includes('vision') ? ModelType.VISION : ModelType.CHAT,
      maxTokens,
      contextWindow: maxTokens,
      inputCostPer1K: 0, // Local model, no direct cost
      outputCostPer1K: 0,
      capabilities,
      releasedAt: new Date(ollamaModel.modified_at),
    };
  }

  private createPlaceholderModel(name: string, displayName: string): LLMModel {
    const capabilities = this.getModelCapabilities(name);
    const maxTokens = this.estimateMaxTokens(name);
    
    return {
      id: name,
      name: displayName,
      provider: this.type,
      type: capabilities.includes('vision') ? ModelType.VISION : ModelType.CHAT,
      maxTokens,
      contextWindow: maxTokens,
      inputCostPer1K: 0,
      outputCostPer1K: 0,
      capabilities,
    };
  }

  private getDefaultModels(): LLMModel[] {
    return [
      {
        id: 'llama2',
        name: 'Llama 2',
        provider: this.type,
        type: ModelType.CHAT,
        maxTokens: 4096,
        contextWindow: 4096,
        inputCostPer1K: 0,
        outputCostPer1K: 0,
        capabilities: ['chat', 'streaming'],
      },
      {
        id: 'mistral',
        name: 'Mistral',
        provider: this.type,
        type: ModelType.CHAT,
        maxTokens: 8192,
        contextWindow: 8192,
        inputCostPer1K: 0,
        outputCostPer1K: 0,
        capabilities: ['chat', 'streaming'],
      },
      {
        id: 'codellama',
        name: 'Code Llama',
        provider: this.type,
        type: ModelType.CODE,
        maxTokens: 16384,
        contextWindow: 16384,
        inputCostPer1K: 0,
        outputCostPer1K: 0,
        capabilities: ['chat', 'code', 'streaming'],
      },
    ];
  }

  private getModelCapabilities(modelName: string): string[] {
    const capabilities = ['chat', 'streaming'];
    
    if (modelName.toLowerCase().includes('vision') || modelName.toLowerCase().includes('llava')) {
      capabilities.push('vision');
    }
    
    if (modelName.toLowerCase().includes('code') || modelName.toLowerCase().includes('codellama')) {
      capabilities.push('code');
    }
    
    if (modelName.toLowerCase().includes('function') || modelName.toLowerCase().includes('tool')) {
      capabilities.push('function_calling');
    }
    
    return capabilities;
  }

  private estimateMaxTokens(modelName: string): number {
    if (modelName.toLowerCase().includes('70b') || modelName.toLowerCase().includes('mixtral')) {
      return 32768;
    } else if (modelName.toLowerCase().includes('13b') || modelName.toLowerCase().includes('34b')) {
      return 16384;
    } else if (modelName.toLowerCase().includes('8b') || modelName.toLowerCase().includes('7b')) {
      return 8192;
    } else {
      return 4096;
    }
  }

  private transformChatRequest(request: ChatCompletionRequest): OllamaChatRequest {
    const messages = request.messages.map(msg => {
      const transformed: any = {
        role: msg.role,
        content: msg.content || '',
      };
      
      // Handle vision content (images in content array)
      if (Array.isArray(msg.content)) {
        const textParts = msg.content.filter(part => part.type === 'text');
        const imageParts = msg.content.filter(part => part.type === 'image');
        
        transformed.content = textParts.map(part => part.text).join('\n');
        
        if (imageParts.length > 0) {
          transformed.images = imageParts.map(part => part.image_url?.url).filter(Boolean);
        }
      }
      
      return transformed;
    });

    const options: any = {
      temperature: request.temperature,
      top_p: request.topP,
      num_predict: request.maxTokens,
      num_ctx: this.config.numCtx || 4096,
      repeat_penalty: this.config.repeatPenalty || 1.1,
      seed: this.config.seed || request.seed,
      stop: request.stop,
    };

    return {
      model: request.model,
      messages,
      format: request.responseFormat?.type === 'json_object' ? 'json' : undefined,
      options,
      stream: request.stream,
    };
  }

  private transformChatResponse(response: OllamaChatResponse, request: ChatCompletionRequest): ChatCompletionResponse {
    const promptTokens = response.prompt_eval_count || 0;
    const completionTokens = response.eval_count || 0;
    
    return {
      id: `ollama-${Date.now()}`,
      object: 'chat.completion',
      created: new Date(response.created_at).getTime(),
      model: request.model,
      choices: [{
        index: 0,
        message: {
          role: ChatMessageRole.ASSISTANT,
          content: response.message.content,
          metadata: {},
        },
        finishReason: response.done ? 'stop' : 'length',
      }],
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      metadata: {
        total_duration: response.total_duration,
        load_duration: response.load_duration,
        prompt_eval_duration: response.prompt_eval_duration,
        eval_duration: response.eval_duration,
      },
    };
  }

  private transformChatChunk(chunk: any, request: ChatCompletionRequest): ChatCompletionChunk {
    return {
      id: `ollama-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: new Date(chunk.created_at).getTime(),
      model: request.model,
      choices: [{
        index: 0,
        delta: {
          role: chunk.message?.role || ChatMessageRole.ASSISTANT,
          content: chunk.message?.content || '',
        },
        finishReason: chunk.done ? 'stop' : undefined,
      }],
    };
  }

  private transformCompletionRequest(request: CompletionRequest): OllamaGenerateRequest {
    const prompt = Array.isArray(request.prompt) ? request.prompt.join('\n') : request.prompt;
    
    const options: any = {
      temperature: request.temperature,
      top_p: request.topP,
      num_predict: request.maxTokens,
      num_ctx: this.config.numCtx || 4096,
      repeat_penalty: this.config.repeatPenalty || 1.1,
      seed: this.config.seed || request.seed,
      stop: request.stop,
    };

    return {
      model: request.model,
      prompt,
      suffix: request.suffix,
      options,
      stream: request.stream,
    };
  }

  private transformCompletionResponse(response: OllamaGenerateResponse, request: CompletionRequest): CompletionResponse {
    const promptTokens = response.prompt_eval_count || 0;
    const completionTokens = response.eval_count || 0;
    
    return {
      id: `ollama-${Date.now()}`,
      object: 'text_completion',
      created: new Date(response.created_at).getTime(),
      model: request.model,
      choices: [{
        text: response.response,
        index: 0,
        finishReason: response.done ? 'stop' : 'length',
      }],
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      metadata: {
        context: response.context,
        total_duration: response.total_duration,
        load_duration: response.load_duration,
        prompt_eval_duration: response.prompt_eval_duration,
        eval_duration: response.eval_duration,
      },
    };
  }

  private handleError(error: any): LLMError {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const message = error.response?.data?.error || error.message;
      
      const llmError = new Error(message) as LLMError;
      llmError.code = this.mapAxiosErrorToLLMErrorCode(statusCode);
      llmError.type = this.getAxiosErrorType(statusCode);
      llmError.statusCode = statusCode;
      llmError.provider = this.name;
      return llmError;
    }

    const llmError = new Error(error.message) as LLMError;
    llmError.code = LLMErrorCode.PROVIDER_ERROR;
    llmError.type = 'api_error';
    llmError.provider = this.name;
    return llmError;
  }

  private mapAxiosErrorToLLMErrorCode(statusCode?: number): LLMErrorCode {
    switch (statusCode) {
      case 404:
        return LLMErrorCode.MODEL_NOT_FOUND;
      case 400:
        return LLMErrorCode.INVALID_REQUEST;
      case 429:
        return LLMErrorCode.RATE_LIMITED;
      case 500:
      case 502:
      case 503:
        return LLMErrorCode.PROVIDER_ERROR;
      default:
        return LLMErrorCode.PROVIDER_ERROR;
    }
  }

  private getAxiosErrorType(statusCode?: number): any {
    switch (statusCode) {
      case 400:
        return 'invalid_request_error';
      case 401:
        return 'authentication_error';
      case 403:
        return 'permission_error';
      case 404:
        return 'not_found_error';
      case 429:
        return 'rate_limit_error';
      case 500:
      case 502:
      case 503:
        return 'api_error';
      default:
        return 'api_error';
    }
  }
}