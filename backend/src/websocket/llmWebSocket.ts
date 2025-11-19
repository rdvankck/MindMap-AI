import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { llmService } from '@/services/llm/LLMService';
import { conversationExecutor } from '@/services/llm/ConversationExecutor';
import { logger } from '@/utils/logger';
import { 
  ChatCompletionRequest, 
  ConversationExecutionOptions,
  LLMRequestOptions 
} from '@/types/llm';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

interface LLMWebSocketData {
  requestId: string;
  type: 'chat' | 'conversation' | 'function' | 'tool';
  status: 'pending' | 'processing' | 'completed' | 'error';
  startTime: number;
  data?: any;
  error?: string;
}

export class LLMWebSocketHandler {
  private io: SocketIOServer;
  private activeRequests = new Map<string, LLMWebSocketData>();

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, config.jwt.secret) as any;
        socket.userId = decoded.userId;
        socket.userEmail = decoded.email;
        
        next();
      } catch (error) {
        logger.warn('WebSocket authentication failed:', error);
        next(new Error('Invalid authentication token'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`LLM WebSocket client connected: ${socket.userId} (${socket.id})`);

      // Join user-specific room
      socket.join(`user:${socket.userId}`);

      // Setup event handlers
      this.setupChatHandlers(socket);
      this.setupConversationHandlers(socket);
      this.setupUtilityHandlers(socket);

      // Disconnection handler
      socket.on('disconnect', (reason) => {
        logger.info(`LLM WebSocket client disconnected: ${socket.userId} (${socket.id}) - ${reason}`);
        this.cleanupUserRequests(socket.userId!);
      });
    });
  }

  private setupChatHandlers(socket: AuthenticatedSocket): void {
    // Chat completion
    socket.on('chat:completion', async (data: {
      requestId: string;
      request: ChatCompletionRequest;
      options?: LLMRequestOptions;
    }) => {
      try {
        const { requestId, request, options = {} } = data;
        
        if (!requestId || !request) {
          socket.emit('error', { requestId, error: 'Missing requestId or request data' });
          return;
        }

        // Track the request
        this.activeRequests.set(requestId, {
          requestId,
          type: 'chat',
          status: 'pending',
          startTime: Date.now(),
        });

        socket.emit('chat:started', { requestId });

        // Execute the request
        const response = await llmService.chat(request, {
          ...options,
          metadata: {
            ...options.metadata,
            userId: socket.userId,
            socketId: socket.id,
          },
        }, {
          userId: socket.userId!,
          requestId,
        });

        // Send response
        socket.emit('chat:completed', {
          requestId,
          response,
          metadata: response.metadata,
        });

        // Update request status
        const requestInfo = this.activeRequests.get(requestId);
        if (requestInfo) {
          requestInfo.status = 'completed';
          requestInfo.data = response;
        }
      } catch (error) {
        logger.error('Chat completion error:', error);
        
        const requestInfo = this.activeRequests.get(data.requestId);
        if (requestInfo) {
          requestInfo.status = 'error';
          requestInfo.error = error instanceof Error ? error.message : 'Unknown error';
        }

        socket.emit('chat:error', {
          requestId: data.requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Streaming chat completion
    socket.on('chat:stream', async (data: {
      requestId: string;
      request: ChatCompletionRequest;
      options?: LLMRequestOptions;
    }) => {
      try {
        const { requestId, request, options = {} } = data;
        
        if (!requestId || !request) {
          socket.emit('error', { requestId, error: 'Missing requestId or request data' });
          return;
        }

        // Track the request
        this.activeRequests.set(requestId, {
          requestId,
          type: 'chat',
          status: 'pending',
          startTime: Date.now(),
        });

        socket.emit('chat:stream:started', { requestId });

        let accumulatedContent = '';
        let chunkCount = 0;

        // Execute streaming request
        for await (const chunk of llmService.chatStream(request, {
          ...options,
          metadata: {
            ...options.metadata,
            userId: socket.userId,
            socketId: socket.id,
          },
        }, {
          userId: socket.userId!,
          requestId,
        })) {
          const content = chunk.choices[0]?.delta?.content || '';
          accumulatedContent += content;
          chunkCount++;

          socket.emit('chat:stream:chunk', {
            requestId,
            chunk: {
              content,
              index: chunk.choices[0]?.index || 0,
              finishReason: chunk.choices[0]?.finishReason,
            },
            metadata: chunk.metadata,
            accumulated: {
              content: accumulatedContent,
              chunks: chunkCount,
            },
          });

          // Check if stream is complete
          if (chunk.choices[0]?.finishReason) {
            break;
          }
        }

        socket.emit('chat:stream:completed', {
          requestId,
          finalContent: accumulatedContent,
          totalChunks: chunkCount,
        });

        // Update request status
        const requestInfo = this.activeRequests.get(requestId);
        if (requestInfo) {
          requestInfo.status = 'completed';
          requestInfo.data = { content: accumulatedContent, chunks: chunkCount };
        }
      } catch (error) {
        logger.error('Chat streaming error:', error);
        
        const requestInfo = this.activeRequests.get(data.requestId);
        if (requestInfo) {
          requestInfo.status = 'error';
          requestInfo.error = error instanceof Error ? error.message : 'Unknown error';
        }

        socket.emit('chat:stream:error', {
          requestId: data.requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  private setupConversationHandlers(socket: AuthenticatedSocket): void {
    // Execute conversation
    socket.on('conversation:execute', async (data: {
      requestId: string;
      nodeId: string;
      workflowId: string;
      threadId: string;
      message: string;
      options?: ConversationExecutionOptions;
    }) => {
      try {
        const { requestId, nodeId, workflowId, threadId, message, options = {} } = data;
        
        if (!requestId || !nodeId || !workflowId || !threadId || !message) {
          socket.emit('error', { requestId, error: 'Missing required parameters' });
          return;
        }

        // Track the request
        this.activeRequests.set(requestId, {
          requestId,
          type: 'conversation',
          status: 'pending',
          startTime: Date.now(),
        });

        socket.emit('conversation:started', { requestId });

        // Execute the conversation
        const result = await conversationExecutor.executeConversation(
          nodeId,
          workflowId,
          threadId,
          socket.userId!,
          message,
          {
            ...options,
            metadata: {
              ...options.metadata,
              userId: socket.userId,
              socketId: socket.id,
            },
          }
        );

        socket.emit('conversation:completed', {
          requestId,
          result: {
            response: result.response.choices[0]?.message?.content,
            metadata: result.metadata,
            context: {
              strategy: result.context.strategy,
              totalTokens: result.context.totalTokens,
              messageCount: result.context.messages.length,
            },
          },
        });

        // Update request status
        const requestInfo = this.activeRequests.get(requestId);
        if (requestInfo) {
          requestInfo.status = 'completed';
          requestInfo.data = result;
        }
      } catch (error) {
        logger.error('Conversation execution error:', error);
        
        const requestInfo = this.activeRequests.get(data.requestId);
        if (requestInfo) {
          requestInfo.status = 'error';
          requestInfo.error = error instanceof Error ? error.message : 'Unknown error';
        }

        socket.emit('conversation:error', {
          requestId: data.requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Streaming conversation
    socket.on('conversation:stream', async (data: {
      requestId: string;
      nodeId: string;
      workflowId: string;
      threadId: string;
      message: string;
      options?: ConversationExecutionOptions;
    }) => {
      try {
        const { requestId, nodeId, workflowId, threadId, message, options = {} } = data;
        
        if (!requestId || !nodeId || !workflowId || !threadId || !message) {
          socket.emit('error', { requestId, error: 'Missing required parameters' });
          return;
        }

        // Track the request
        this.activeRequests.set(requestId, {
          requestId,
          type: 'conversation',
          status: 'pending',
          startTime: Date.now(),
        });

        socket.emit('conversation:stream:started', { requestId });

        let accumulatedContent = '';
        let chunkCount = 0;

        // Execute streaming conversation
        for await (const chunk of conversationExecutor.executeConversationStream(
          nodeId,
          workflowId,
          threadId,
          socket.userId!,
          message,
          {
            ...options,
            metadata: {
              ...options.metadata,
              userId: socket.userId,
              socketId: socket.id,
            },
          }
        )) {
          if (!chunk.done) {
            accumulatedContent += chunk.content;
            chunkCount++;

            socket.emit('conversation:stream:chunk', {
              requestId,
              chunk: {
                content: chunk.content,
                metadata: chunk.metadata,
              },
              accumulated: {
                content: accumulatedContent,
                chunks: chunkCount,
              },
            });
          } else {
            // Stream completed
            socket.emit('conversation:stream:completed', {
              requestId,
              finalContent: accumulatedContent,
              totalChunks: chunkCount,
              finalMetadata: chunk.metadata,
            });

            // Update request status
            const requestInfo = this.activeRequests.get(requestId);
            if (requestInfo) {
              requestInfo.status = 'completed';
              requestInfo.data = { content: accumulatedContent, chunks: chunkCount };
            }
            break;
          }
        }
      } catch (error) {
        logger.error('Conversation streaming error:', error);
        
        const requestInfo = this.activeRequests.get(data.requestId);
        if (requestInfo) {
          requestInfo.status = 'error';
          requestInfo.error = error instanceof Error ? error.message : 'Unknown error';
        }

        socket.emit('conversation:stream:error', {
          requestId: data.requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  private setupUtilityHandlers(socket: AuthenticatedSocket): void {
    // Cancel request
    socket.on('request:cancel', (data: { requestId: string }) => {
      const { requestId } = data;
      const requestInfo = this.activeRequests.get(requestId);
      
      if (requestInfo && requestInfo.status !== 'completed') {
        requestInfo.status = 'error';
        requestInfo.error = 'Cancelled by user';
        
        socket.emit('request:cancelled', { requestId });
        logger.info(`Request ${requestId} cancelled by user ${socket.userId}`);
      }
    });

    // Get request status
    socket.on('request:status', (data: { requestId: string }) => {
      const { requestId } = data;
      const requestInfo = this.activeRequests.get(requestId);
      
      if (requestInfo) {
        socket.emit('request:status', {
          requestId,
          status: requestInfo.status,
          startTime: requestInfo.startTime,
          duration: Date.now() - requestInfo.startTime,
          error: requestInfo.error,
        });
      } else {
        socket.emit('request:status', {
          requestId,
          status: 'not_found',
        });
      }
    });

    // Get providers status
    socket.on('providers:status', async () => {
      try {
        const providers = await llmService.getAvailableProviders();
        socket.emit('providers:status', providers);
      } catch (error) {
        socket.emit('error', {
          error: 'Failed to get providers status',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Get available models
    socket.on('models:list', async (data: { provider?: string }) => {
      try {
        const models = await llmService.getAvailableModels(data.provider as any);
        socket.emit('models:list', { models });
      } catch (error) {
        socket.emit('error', {
          error: 'Failed to get models',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Estimate tokens
    socket.on('tokens:estimate', async (data: { text: string; model?: string }) => {
      try {
        const tokenCount = await llmService.estimateTokens(data.text, data.model);
        socket.emit('tokens:estimate', {
          text: data.text,
          model: data.model,
          tokenCount,
        });
      } catch (error) {
        socket.emit('error', {
          error: 'Failed to estimate tokens',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Heartbeat
    socket.on('heartbeat', () => {
      socket.emit('heartbeat:response', {
        timestamp: Date.now(),
        activeRequests: this.activeRequests.size,
      });
    });
  }

  private cleanupUserRequests(userId: string): void {
    // Mark all active requests for this user as cancelled
    for (const [requestId, requestInfo] of this.activeRequests.entries()) {
      if (requestInfo.status !== 'completed' && requestInfo.status !== 'error') {
        requestInfo.status = 'error';
        requestInfo.error = 'User disconnected';
      }
    }
  }

  // Public methods for broadcasting events
  public broadcastToUser(userId: string, event: string, data: any): void {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  public broadcastToAll(event: string, data: any): void {
    this.io.emit(event, data);
  }

  // Get statistics
  public getStats(): {
    connectedClients: number;
    activeRequests: number;
    requestStats: { [key: string]: number };
  } {
    const connectedClients = this.io.engine.clientsCount;
    const activeRequests = this.activeRequests.size;
    
    const requestStats: { [key: string]: number } = {};
    for (const request of this.activeRequests.values()) {
      requestStats[request.type] = (requestStats[request.type] || 0) + 1;
    }

    return {
      connectedClients,
      activeRequests,
      requestStats,
    };
  }
}

export let llmWebSocketHandler: LLMWebSocketHandler;

export const initializeLLMWebSocket = (io: SocketIOServer): LLMWebSocketHandler => {
  llmWebSocketHandler = new LLMWebSocketHandler(io);
  return llmWebSocketHandler;
};