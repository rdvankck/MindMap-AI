import { EventEmitter } from 'events';
import { 
  ChatCompletionRequest, 
  ChatCompletionResponse, 
  ChatMessageRole, 
  LLMRequestOptions,
  LLMExecutionContext,
  TokenUsage,
  LLMResponseMetadata
} from '@/types/llm';
import { llmService } from './LLMService';
import { conversationService, ConversationContext, MessageOptions } from '../conversationService';
import { ConversationThread, ConversationMessage, ConversationRole, ContextStrategy } from '@prisma/client';
import { logger } from '@/utils/logger';
import { config } from '@/config';

export interface ConversationExecutionOptions {
  stream?: boolean;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  contextStrategy?: ContextStrategy;
  contextWindow?: number;
  enableTools?: boolean;
  enableFunctions?: boolean;
  tools?: any[];
  functions?: any[];
  responseFormat?: { type: 'text' | 'json_object' };
  metadata?: Record<string, any>;
}

export interface ConversationExecutionResult {
  response: ChatCompletionResponse;
  metadata: ConversationExecutionMetadata;
  context: ConversationContext;
  message: ConversationMessage;
}

export interface ConversationExecutionMetadata {
  executionId: string;
  nodeId: string;
  workflowId: string;
  threadId: string;
  userId: string;
  processingTime: number;
  tokenUsage: TokenUsage;
  cost: number;
  contextStrategy: ContextStrategy;
  contextSize: number;
  cacheHit: boolean;
  model: string;
  provider: string;
  metadata: Record<string, any>;
}

export interface StreamChunk {
  content: string;
  metadata: Partial<ConversationExecutionMetadata>;
  done: boolean;
}

export class ConversationExecutor extends EventEmitter {
  private executionCounter = 0;
  private activeExecutions = new Map<string, any>();

  constructor() {
    super();
    this.setupEventListeners();
  }

  async executeConversation(
    nodeId: string,
    workflowId: string,
    threadId: string,
    userId: string,
    userMessage: string,
    options: ConversationExecutionOptions = {}
  ): Promise<ConversationExecutionResult> {
    const executionId = `exec-${++this.executionCounter}-${Date.now()}`;
    const startTime = Date.now();

    try {
      logger.info(`Starting conversation execution ${executionId} for node ${nodeId}`);

      // Add user message to conversation
      const userMsg = await conversationService.addMessage(threadId, {
        role: ConversationRole.USER,
        content: userMessage,
        metadata: options.metadata,
      });

      // Build conversation context
      const context = await this.buildConversationContext(
        threadId,
        userMsg.id,
        options
      );

      // Prepare LLM request
      const llmRequest = await this.prepareLLMRequest(
        context,
        userMessage,
        options
      );

      // Prepare execution context
      const execContext: LLMExecutionContext = {
        requestId: executionId,
        userId,
        nodeId,
        workflowId,
        conversationId: threadId,
        timestamp: new Date(),
        metadata: {
          executionType: 'conversation',
          options,
        },
      };

      // Execute LLM request
      const llmResponse = await llmService.chat(llmRequest, {
        priority: options.metadata?.priority || 'normal',
        timeout: options.metadata?.timeout,
        cache: true,
      }, execContext);

      // Extract assistant response
      const assistantMessage = llmResponse.choices[0]?.message;
      if (!assistantMessage?.content) {
        throw new Error('No response content received from LLM');
      }

      // Add assistant message to conversation
      const assistantMsg = await conversationService.addMessage(threadId, {
        role: ConversationRole.ASSISTANT,
        content: assistantMessage.content,
        metadata: {
          ...assistantMessage.functionCall,
          ...assistantMessage.toolCalls,
          model: llmResponse.metadata.model,
          provider: llmResponse.metadata.provider,
          executionId,
          tokenUsage: llmResponse.metadata.tokenCount,
          cost: llmResponse.metadata.cost.totalCost,
        },
      }, false);

      // Create execution metadata
      const metadata: ConversationExecutionMetadata = {
        executionId,
        nodeId,
        workflowId,
        threadId,
        userId,
        processingTime: Date.now() - startTime,
        tokenUsage: llmResponse.metadata.tokenCount,
        cost: llmResponse.metadata.cost.totalCost,
        contextStrategy: context.strategy,
        contextSize: context.totalTokens,
        cacheHit: llmResponse.metadata.cached,
        model: llmResponse.metadata.model,
        provider: llmResponse.metadata.provider,
        metadata: {
          ...options.metadata,
          userMessageId: userMsg.id,
          assistantMessageId: assistantMsg.id,
          contextMessages: context.messages.length,
          finishReason: llmResponse.choices[0]?.finishReason,
        },
      };

      // Update conversation context for next turn
      await this.updateConversationContext(threadId, context, assistantMsg);

      const result: ConversationExecutionResult = {
        response: llmResponse,
        metadata,
        context,
        message: assistantMsg,
      };

      // Emit events
      this.emit('execution_completed', result);
      logger.info(`Conversation execution ${executionId} completed successfully`);

      return result;
    } catch (error) {
      logger.error(`Conversation execution ${executionId} failed:`, error);
      
      // Emit error event
      this.emit('execution_error', {
        executionId,
        nodeId,
        workflowId,
        threadId,
        userId,
        error,
      });

      throw error;
    }
  }

  async *executeConversationStream(
    nodeId: string,
    workflowId: string,
    threadId: string,
    userId: string,
    userMessage: string,
    options: ConversationExecutionOptions = {}
  ): AsyncIterable<StreamChunk> {
    const executionId = `exec-${++this.executionCounter}-${Date.now()}`;
    const startTime = Date.now();
    let fullContent = '';
    let accumulatedMetadata: any = {};

    try {
      logger.info(`Starting streaming conversation execution ${executionId} for node ${nodeId}`);

      // Add user message to conversation
      const userMsg = await conversationService.addMessage(threadId, {
        role: ConversationRole.USER,
        content: userMessage,
        metadata: options.metadata,
      });

      // Build conversation context
      const context = await this.buildConversationContext(
        threadId,
        userMsg.id,
        options
      );

      // Prepare LLM request
      const llmRequest = await this.prepareLLMRequest(
        context,
        userMessage,
        { ...options, stream: true }
      );

      // Prepare execution context
      const execContext: LLMExecutionContext = {
        requestId: executionId,
        userId,
        nodeId,
        workflowId,
        conversationId: threadId,
        timestamp: new Date(),
        metadata: {
          executionType: 'conversation_stream',
          options,
        },
      };

      // Execute streaming LLM request
      for await (const chunk of llmService.chatStream(llmRequest, {
        priority: options.metadata?.priority || 'normal',
        timeout: options.metadata?.timeout,
        cache: false, // Don't cache streaming requests
      }, execContext)) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullContent += content;

        accumulatedMetadata = {
          ...accumulatedMetadata,
          ...chunk.metadata,
          executionId,
          nodeId,
          workflowId,
          threadId,
          userId,
          content,
        };

        yield {
          content,
          metadata: accumulatedMetadata,
          done: false,
        };
      }

      // Add final assistant message to conversation
      const assistantMsg = await conversationService.addMessage(threadId, {
        role: ConversationRole.ASSISTANT,
        content: fullContent,
        metadata: {
          model: accumulatedMetadata.model,
          provider: accumulatedMetadata.provider,
          executionId,
          streamed: true,
          userMessageId: userMsg.id,
        },
      }, false);

      // Create final metadata
      const finalMetadata: ConversationExecutionMetadata = {
        executionId,
        nodeId,
        workflowId,
        threadId,
        userId,
        processingTime: Date.now() - startTime,
        tokenUsage: accumulatedMetadata.tokenCount || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        cost: accumulatedMetadata.cost?.totalCost || 0,
        contextStrategy: context.strategy,
        contextSize: context.totalTokens,
        cacheHit: false,
        model: accumulatedMetadata.model || options.model || 'unknown',
        provider: accumulatedMetadata.provider || 'unknown',
        metadata: {
          ...options.metadata,
          userMessageId: userMsg.id,
          assistantMessageId: assistantMsg.id,
          contextMessages: context.messages.length,
          streamed: true,
        },
      };

      // Update conversation context
      await this.updateConversationContext(threadId, context, assistantMsg);

      // Emit completion event
      this.emit('stream_execution_completed', {
        executionId,
        metadata: finalMetadata,
        content: fullContent,
        message: assistantMsg,
      });

      yield {
        content: '',
        metadata: finalMetadata,
        done: true,
      };

    } catch (error) {
      logger.error(`Streaming conversation execution ${executionId} failed:`, error);
      
      this.emit('stream_execution_error', {
        executionId,
        nodeId,
        workflowId,
        threadId,
        userId,
        error,
      });

      yield {
        content: '',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        done: true,
      };
    }
  }

  async executeFunctionCall(
    nodeId: string,
    workflowId: string,
    threadId: string,
    userId: string,
    userMessage: string,
    functions: any[],
    options: ConversationExecutionOptions = {}
  ): Promise<any> {
    const executionId = `func-${++this.executionCounter}-${Date.now()}`;

    try {
      logger.info(`Starting function call execution ${executionId} for node ${nodeId}`);

      // Add user message
      const userMsg = await conversationService.addMessage(threadId, {
        role: ConversationRole.USER,
        content: userMessage,
        metadata: options.metadata,
      });

      // Build context
      const context = await this.buildConversationContext(threadId, userMsg.id, options);

      // Prepare request with functions
      const llmRequest = await this.prepareLLMRequest(context, userMessage, {
        ...options,
        functions,
        functionCall: 'auto',
      });

      // Execute LLM request
      const execContext: LLMExecutionContext = {
        requestId: executionId,
        userId,
        nodeId,
        workflowId,
        conversationId: threadId,
        timestamp: new Date(),
        metadata: {
          executionType: 'function_call',
          options,
        },
      };

      const response = await llmService.chat(llmRequest, {}, execContext);
      const message = response.choices[0]?.message;

      if (message?.functionCall) {
        // Add function call message
        await conversationService.addMessage(threadId, {
          role: ConversationRole.FUNCTION,
          content: '',
          metadata: {
            functionName: message.functionCall.name,
            functionArguments: message.functionCall.arguments,
            executionId,
          },
        });

        return {
          functionCall: message.functionCall,
          response,
          context,
        };
      }

      // No function call made, return normal response
      return {
        response,
        context,
      };
    } catch (error) {
      logger.error(`Function call execution ${executionId} failed:`, error);
      throw error;
    }
  }

  async executeToolCall(
    nodeId: string,
    workflowId: string,
    threadId: string,
    userId: string,
    userMessage: string,
    tools: any[],
    options: ConversationExecutionOptions = {}
  ): Promise<any> {
    const executionId = `tool-${++this.executionCounter}-${Date.now()}`;

    try {
      logger.info(`Starting tool call execution ${executionId} for node ${nodeId}`);

      // Add user message
      const userMsg = await conversationService.addMessage(threadId, {
        role: ConversationRole.USER,
        content: userMessage,
        metadata: options.metadata,
      });

      // Build context
      const context = await this.buildConversationContext(threadId, userMsg.id, options);

      // Prepare request with tools
      const llmRequest = await this.prepareLLMRequest(context, userMessage, {
        ...options,
        tools,
        toolChoice: 'auto',
      });

      // Execute LLM request
      const execContext: LLMExecutionContext = {
        requestId: executionId,
        userId,
        nodeId,
        workflowId,
        conversationId: threadId,
        timestamp: new Date(),
        metadata: {
          executionType: 'tool_call',
          options,
        },
      };

      const response = await llmService.chat(llmRequest, {}, execContext);
      const message = response.choices[0]?.message;

      if (message?.toolCalls && message.toolCalls.length > 0) {
        // Add tool calls message
        await conversationService.addMessage(threadId, {
          role: ConversationRole.TOOL,
          content: '',
          metadata: {
            toolCalls: message.toolCalls,
            executionId,
          },
        });

        return {
          toolCalls: message.toolCalls,
          response,
          context,
        };
      }

      // No tool calls made, return normal response
      return {
        response,
        context,
      };
    } catch (error) {
      logger.error(`Tool call execution ${executionId} failed:`, error);
      throw error;
    }
  }

  private async buildConversationContext(
    threadId: string,
    messageId: string,
    options: ConversationExecutionOptions
  ): Promise<ConversationContext> {
    return await conversationService.buildContext(threadId, {
      maxTokens: options.contextWindow || 8192,
      strategy: options.contextStrategy || ContextStrategy.SLIDING_WINDOW,
      includeSystemPrompt: true,
      branchId: options.metadata?.branchId,
    });
  }

  private async prepareLLMRequest(
    context: ConversationContext,
    userMessage: string,
    options: ConversationExecutionOptions
  ): Promise<ChatCompletionRequest> {
    const messages: any[] = [];

    // Add system prompt
    if (context.systemPrompt || options.systemPrompt) {
      messages.push({
        role: ChatMessageRole.SYSTEM,
        content: options.systemPrompt || context.systemPrompt,
      });
    }

    // Add conversation history
    context.messages.forEach((msg) => {
      messages.push({
        role: this.mapConversationRoleToChatRole(msg.role),
        content: msg.content,
        name: msg.metadata?.name,
      });
    });

    // Prepare request
    const request: ChatCompletionRequest = {
      model: options.model || config.ollama?.baseUrl ? 'llama2' : 'gpt-3.5-turbo',
      messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      stream: options.stream || false,
      tools: options.tools,
      functions: options.functions,
      functionCall: options.functions ? 'auto' : undefined,
      toolChoice: options.tools ? 'auto' : undefined,
      responseFormat: options.responseFormat,
      metadata: options.metadata,
    };

    return request;
  }

  private mapConversationRoleToChatRole(role: ConversationRole): ChatMessageRole {
    switch (role) {
      case ConversationRole.USER:
        return ChatMessageRole.USER;
      case ConversationRole.ASSISTANT:
        return ChatMessageRole.ASSISTANT;
      case ConversationRole.SYSTEM:
        return ChatMessageRole.SYSTEM;
      case ConversationRole.TOOL:
        return ChatMessageRole.TOOL;
      case ConversationRole.FUNCTION:
        return ChatMessageRole.FUNCTION;
      default:
        return ChatMessageRole.USER;
    }
  }

  private async updateConversationContext(
    threadId: string,
    context: ConversationContext,
    newMessage: ConversationMessage
  ): Promise<void> {
    // Invalidate context cache to force rebuild on next request
    await conversationService['invalidateConversationContextCache'](threadId);
    
    // Update conversation stats
    await conversationService['updateConversationStats'](threadId, {
      messageCount: 1,
      tokenCount: newMessage.tokenCount,
      role: newMessage.role,
    });
  }

  private setupEventListeners(): void {
    // Listen to LLM service events
    llmService.on('chat_completed', (data) => {
      this.emit('llm_chat_completed', data);
    });

    llmService.on('chat_error', (data) => {
      this.emit('llm_chat_error', data);
    });

    llmService.on('stream_completed', (data) => {
      this.emit('llm_stream_completed', data);
    });

    llmService.on('stream_error', (data) => {
      this.emit('llm_stream_error', data);
    });
  }

  async getExecutionMetrics(executionId: string): Promise<any> {
    // This would typically query a database for execution metrics
    return {
      executionId,
      status: 'completed',
      timestamp: new Date(),
    };
  }

  async cancelExecution(executionId: string): Promise<void> {
    // Implementation for canceling active executions
    logger.info(`Canceling execution ${executionId}`);
    this.activeExecutions.delete(executionId);
    this.emit('execution_cancelled', { executionId });
  }
}

export const conversationExecutor = new ConversationExecutor();