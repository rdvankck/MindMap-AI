import { Request, Response, NextFunction } from 'express';
import { 
  ChatCompletionRequest, 
  CompletionRequest, 
  EmbeddingRequest, 
  LLMRequestOptions, 
  LLMProviderType,
  ModelCapabilities
} from '@/types/llm';
import { llmService } from '@/services/llm/LLMService';
import { conversationExecutor } from '@/services/llm/ConversationExecutor';
import { logger } from '@/utils/logger';
import { config } from '@/config';

/**
 * LLM Controller - Handles all LLM-related API endpoints
 */

export class LLMController {
  /**
   * Chat completion endpoint
   */
  async chatCompletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request: ChatCompletionRequest = req.body;
      const options: LLMRequestOptions = {
        stream: req.body.stream || false,
        priority: req.query.priority as 'low' | 'normal' | 'high' || 'normal',
        timeout: req.body.timeout,
        cache: req.body.cache !== false,
        metadata: {
          userId: req.user?.id,
          source: 'api',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        },
      };

      if (options.stream) {
        // Handle streaming response
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

        const stream = llmService.chatStream(request, options, {
          userId: req.user?.id || 'anonymous',
          metadata: options.metadata,
        });

        try {
          for await (const chunk of stream) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
          res.write('data: [DONE]\n\n');
          res.end();
        } catch (streamError) {
          logger.error('Streaming error:', streamError);
          res.write(`data: ${JSON.stringify({ error: streamError.message })}\n\n`);
          res.end();
        }
      } else {
        // Handle non-streaming response
        const response = await llmService.chat(request, options, {
          userId: req.user?.id || 'anonymous',
          metadata: options.metadata,
        });

        res.json({
          success: true,
          data: response,
        });
      }
    } catch (error) {
      logger.error('Chat completion error:', error);
      next(error);
    }
  }

  /**
   * Text completion endpoint
   */
  async textCompletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request: CompletionRequest = req.body;
      const options: LLMRequestOptions = {
        stream: req.body.stream || false,
        priority: req.query.priority as 'low' | 'normal' | 'high' || 'normal',
        timeout: req.body.timeout,
        cache: req.body.cache !== false,
        metadata: {
          userId: req.user?.id,
          source: 'api',
          ip: req.ip,
        },
      };

      if (options.stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const response = await llmService.completion(request, options, {
          userId: req.user?.id || 'anonymous',
        });

        res.json({
          success: true,
          data: response,
        });
      } else {
        const response = await llmService.completion(request, options, {
          userId: req.user?.id || 'anonymous',
        });

        res.json({
          success: true,
          data: response,
        });
      }
    } catch (error) {
      logger.error('Text completion error:', error);
      next(error);
    }
  }

  /**
   * Embedding endpoint
   */
  async embeddings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request: EmbeddingRequest = req.body;
      const options: LLMRequestOptions = {
        priority: req.query.priority as 'low' | 'normal' | 'high' || 'normal',
        cache: req.body.cache !== false,
        metadata: {
          userId: req.user?.id,
          source: 'api',
          ip: req.ip,
        },
      };

      const response = await llmService.embed(request, options, {
        userId: req.user?.id || 'anonymous',
      });

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      logger.error('Embedding error:', error);
      next(error);
    }
  }

  /**
   * Get available providers
   */
  async getProviders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const providers = await llmService.getAvailableProviders();
      
      res.json({
        success: true,
        data: providers,
      });
    } catch (error) {
      logger.error('Get providers error:', error);
      next(error);
    }
  }

  /**
   * Get available models
   */
  async getModels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const provider = req.query.provider as LLMProviderType;
      const models = await llmService.getAvailableModels(provider);
      
      res.json({
        success: true,
        data: models,
      });
    } catch (error) {
      logger.error('Get models error:', error);
      next(error);
    }
  }

  /**
   * Get model capabilities
   */
  async getModelCapabilities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { model } = req.params;
      const capabilities = await llmService.getModelCapabilities(model);
      
      res.json({
        success: true,
        data: capabilities,
      });
    } catch (error) {
      logger.error('Get model capabilities error:', error);
      next(error);
    }
  }

  /**
   * Estimate tokens
   */
  async estimateTokens(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { text, model } = req.body;
      const tokenCount = await llmService.estimateTokens(text, model);
      
      res.json({
        success: true,
        data: {
          text,
          model: model || 'default',
          tokenCount,
        },
      });
    } catch (error) {
      logger.error('Token estimation error:', error);
      next(error);
    }
  }

  /**
   * Estimate cost
   */
  async estimateCost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { usage, model } = req.body;
      const cost = await llmService.estimateCost(usage, model);
      
      res.json({
        success: true,
        data: cost,
      });
    } catch (error) {
      logger.error('Cost estimation error:', error);
      next(error);
    }
  }

  /**
   * Get usage analytics
   */
  async getUsageAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const timeframe = req.query.timeframe as 'hour' | 'day' | 'week' | 'month' || 'day';
      const analytics = await llmService.getUsageAnalytics(timeframe);
      
      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      logger.error('Usage analytics error:', error);
      next(error);
    }
  }

  /**
   * Execute conversation
   */
  async executeConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        nodeId,
        workflowId,
        threadId,
        message,
        options = {},
      } = req.body;

      if (!nodeId || !workflowId || !threadId || !message) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: nodeId, workflowId, threadId, message',
        });
        return;
      }

      if (options.stream) {
        // Handle streaming conversation
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const stream = conversationExecutor.executeConversationStream(
          nodeId,
          workflowId,
          threadId,
          req.user?.id || 'anonymous',
          message,
          {
            ...options,
            metadata: {
              ...options.metadata,
              userId: req.user?.id,
              source: 'api',
            },
          }
        );

        try {
          for await (const chunk of stream) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            
            if (chunk.done) {
              break;
            }
          }
          res.write('data: [DONE]\n\n');
          res.end();
        } catch (streamError) {
          logger.error('Conversation streaming error:', streamError);
          res.write(`data: ${JSON.stringify({ error: streamError.message })}\n\n`);
          res.end();
        }
      } else {
        // Handle non-streaming conversation
        const result = await conversationExecutor.executeConversation(
          nodeId,
          workflowId,
          threadId,
          req.user?.id || 'anonymous',
          message,
          {
            ...options,
            metadata: {
              ...options.metadata,
              userId: req.user?.id,
              source: 'api',
            },
          }
        );

        res.json({
          success: true,
          data: result,
        });
      }
    } catch (error) {
      logger.error('Execute conversation error:', error);
      next(error);
    }
  }

  /**
   * Execute function call
   */
  async executeFunctionCall(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        nodeId,
        workflowId,
        threadId,
        message,
        functions,
        options = {},
      } = req.body;

      if (!nodeId || !workflowId || !threadId || !message || !functions) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: nodeId, workflowId, threadId, message, functions',
        });
        return;
      }

      const result = await conversationExecutor.executeFunctionCall(
        nodeId,
        workflowId,
        threadId,
        req.user?.id || 'anonymous',
        message,
        functions,
        {
          ...options,
          metadata: {
            ...options.metadata,
            userId: req.user?.id,
            source: 'api',
          },
        }
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Execute function call error:', error);
      next(error);
    }
  }

  /**
   * Execute tool call
   */
  async executeToolCall(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        nodeId,
        workflowId,
        threadId,
        message,
        tools,
        options = {},
      } = req.body;

      if (!nodeId || !workflowId || !threadId || !message || !tools) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: nodeId, workflowId, threadId, message, tools',
        });
        return;
      }

      const result = await conversationExecutor.executeToolCall(
        nodeId,
        workflowId,
        threadId,
        req.user?.id || 'anonymous',
        message,
        tools,
        {
          ...options,
          metadata: {
            ...options.metadata,
            userId: req.user?.id,
            source: 'api',
          },
        }
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Execute tool call error:', error);
      next(error);
    }
  }

  /**
   * Cancel execution
   */
  async cancelExecution(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { executionId } = req.params;
      
      await conversationExecutor.cancelExecution(executionId);

      res.json({
        success: true,
        message: 'Execution cancelled successfully',
      });
    } catch (error) {
      logger.error('Cancel execution error:', error);
      next(error);
    }
  }

  /**
   * Health check for LLM service
   */
  async healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const providers = await llmService.getAvailableProviders();
      const isHealthy = providers.some(p => p.isAvailable);

      res.json({
        success: true,
        data: {
          status: isHealthy ? 'healthy' : 'unhealthy',
          providers,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Health check error:', error);
      next(error);
    }
  }

  /**
   * Test provider connection
   */
  async testProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider } = req.params;
      const providerType = provider as LLMProviderType;

      // This would test the specific provider
      const providers = await llmService.getAvailableProviders();
      const providerStatus = providers.find(p => p.provider === providerType);

      if (!providerStatus) {
        res.status(404).json({
          success: false,
          error: `Provider ${provider} not found`,
        });
        return;
      }

      res.json({
        success: true,
        data: providerStatus,
      });
    } catch (error) {
      logger.error('Test provider error:', error);
      next(error);
    }
  }
}

export const llmController = new LLMController();