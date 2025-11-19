import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { llmService } from '@/services/llm/LLMService';
import { conversationExecutor } from '@/services/llm/ConversationExecutor';
import { LLMProviderType, ChatMessageRole } from '@/types/llm';
import { config } from '@/config';

// Mock dependencies
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/config/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
  },
}));

describe('LLM Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('LLM Service', () => {
    describe('Provider Initialization', () => {
      it('should initialize LLM service with default configuration', () => {
        expect(llmService).toBeDefined();
      });

      it('should get available providers', async () => {
        const providers = await llmService.getAvailableProviders();
        expect(Array.isArray(providers)).toBe(true);
      });

      it('should get available models', async () => {
        const models = await llmService.getAvailableModels();
        expect(Array.isArray(models)).toBe(true);
      });
    });

    describe('Token Estimation', () => {
      it('should estimate tokens for text', async () => {
        const text = 'This is a test message for token estimation.';
        const tokenCount = await llmService.estimateTokens(text);
        
        expect(typeof tokenCount).toBe('number');
        expect(tokenCount).toBeGreaterThan(0);
      });

      it('should estimate cost for token usage', async () => {
        const usage = {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        };
        const model = 'gpt-3.5-turbo';
        
        const cost = await llmService.estimateCost(usage, model);
        
        expect(cost).toHaveProperty('inputCost');
        expect(cost).toHaveProperty('outputCost');
        expect(cost).toHaveProperty('totalCost');
        expect(cost).toHaveProperty('currency');
        expect(cost).toHaveProperty('model');
        expect(cost.currency).toBe('USD');
        expect(cost.model).toBe(model);
      });
    });

    describe('Usage Analytics', () => {
      it('should get usage analytics', async () => {
        const analytics = await llmService.getUsageAnalytics('day');
        
        expect(analytics).toHaveProperty('timeframe', 'day');
        expect(analytics).toHaveProperty('totalRequests');
        expect(analytics).toHaveProperty('totalTokens');
        expect(analytics).toHaveProperty('totalCost');
        expect(analytics).toHaveProperty('providerBreakdown');
        expect(analytics).toHaveProperty('modelBreakdown');
        expect(analytics).toHaveProperty('errorRate');
        expect(analytics).toHaveProperty('averageResponseTime');
      });
    });

    describe('Model Capabilities', () => {
      it('should get model capabilities', async () => {
        const model = 'gpt-3.5-turbo';
        const capabilities = await llmService.getModelCapabilities(model);
        
        expect(capabilities).toHaveProperty('supportsStreaming');
        expect(capabilities).toHaveProperty('supportsFunctions');
        expect(capabilities).toHaveProperty('supportsTools');
        expect(capabilities).toHaveProperty('supportsVision');
        expect(capabilities).toHaveProperty('supportsJSON');
        expect(capabilities).toHaveProperty('maxContextWindow');
        expect(capabilities).toHaveProperty('maxOutputTokens');
        expect(capabilities).toHaveProperty('inputTokenCost');
        expect(capabilities).toHaveProperty('outputTokenCost');
      });
    });
  });

  describe('Conversation Executor', () => {
    const mockNodeId = 'test-node-id';
    const mockWorkflowId = 'test-workflow-id';
    const mockThreadId = 'test-thread-id';
    const mockUserId = 'test-user-id';
    const mockMessage = 'Hello, how are you?';

    describe('Basic Conversation Execution', () => {
      it('should execute a conversation', async () => {
        // Mock the conversation service methods
        const mockConversationService = require('@/services/conversationService');
        mockConversationService.conversationService = {
          addMessage: jest.fn().mockResolvedValue({
            id: 'mock-user-message-id',
            role: 'USER',
            content: mockMessage,
            tokenCount: 10,
          }),
          buildContext: jest.fn().mockResolvedValue({
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant.',
                tokenCount: 15,
              },
            ],
            systemPrompt: 'You are a helpful assistant.',
            totalTokens: 15,
            contextWindow: 4096,
            strategy: 'SLIDING_WINDOW',
            nodeId: mockNodeId,
            workflowId: mockWorkflowId,
            threadId: mockThreadId,
          }),
          invalidateConversationContextCache: jest.fn(),
          updateConversationStats: jest.fn(),
        };

        // Mock LLM service chat method
        const mockLLMResponse = {
          choices: [
            {
              message: {
                role: ChatMessageRole.ASSISTANT,
                content: 'I am doing well, thank you for asking!',
              },
              finishReason: 'stop',
              index: 0,
            },
          ],
          usage: {
            promptTokens: 25,
            completionTokens: 15,
            totalTokens: 40,
          },
          metadata: {
            requestId: 'test-request-id',
            provider: LLMProviderType.OPENAI,
            model: 'gpt-3.5-turbo',
            processingTime: 1500,
            tokenCount: {
              promptTokens: 25,
              completionTokens: 15,
              totalTokens: 40,
            },
            cost: {
              inputCost: 0.0000375,
              outputCost: 0.00003,
              totalCost: 0.0000675,
              currency: 'USD',
              model: 'gpt-3.5-turbo',
            },
            cached: false,
          },
        };

        jest.spyOn(llmService, 'chat').mockResolvedValue(mockLLMResponse as any);

        const options = {
          model: 'gpt-3.5-turbo',
          temperature: 0.7,
          maxTokens: 150,
        };

        const result = await conversationExecutor.executeConversation(
          mockNodeId,
          mockWorkflowId,
          mockThreadId,
          mockUserId,
          mockMessage,
          options
        );

        expect(result).toHaveProperty('response');
        expect(result).toHaveProperty('metadata');
        expect(result).toHaveProperty('context');
        expect(result).toHaveProperty('message');
        expect(result.response.choices[0].message.content).toBe('I am doing well, thank you for asking!');
        expect(result.metadata.executionId).toBeDefined();
        expect(result.metadata.nodeId).toBe(mockNodeId);
        expect(result.metadata.workflowId).toBe(mockWorkflowId);
        expect(result.metadata.threadId).toBe(mockThreadId);
        expect(result.metadata.userId).toBe(mockUserId);
      });

      it('should handle streaming conversation execution', async () => {
        const mockStreamChunks = [
          {
            content: 'I',
            metadata: { model: 'gpt-3.5-turbo' },
            done: false,
          },
          {
            content: ' am',
            metadata: { model: 'gpt-3.5-turbo' },
            done: false,
          },
          {
            content: ' well',
            metadata: { model: 'gpt-3.5-turbo' },
            done: false,
          },
          {
            content: '',
            metadata: { 
              model: 'gpt-3.5-turbo',
              executionId: 'stream-test-id',
              processingTime: 1200,
            },
            done: true,
          },
        ];

        // Mock conversation service
        const mockConversationService = require('@/services/conversationService');
        mockConversationService.conversationService = {
          addMessage: jest.fn().mockResolvedValue({
            id: 'mock-user-message-id',
            role: 'USER',
            content: mockMessage,
            tokenCount: 10,
          }),
          buildContext: jest.fn().mockResolvedValue({
            messages: [],
            systemPrompt: 'You are a helpful assistant.',
            totalTokens: 15,
            contextWindow: 4096,
            strategy: 'SLIDING_WINDOW',
            nodeId: mockNodeId,
            workflowId: mockWorkflowId,
            threadId: mockThreadId,
          }),
          invalidateConversationContextCache: jest.fn(),
          updateConversationStats: jest.fn(),
        };

        // Mock LLM service chat stream
        const mockStreamGenerator = async function* () {
          for (const chunk of mockStreamChunks) {
            yield chunk;
          }
        };

        jest.spyOn(llmService, 'chatStream').mockImplementation(mockStreamGenerator);

        const options = {
          model: 'gpt-3.5-turbo',
          stream: true,
        };

        const chunks = [];
        for await (const chunk of conversationExecutor.executeConversationStream(
          mockNodeId,
          mockWorkflowId,
          mockThreadId,
          mockUserId,
          mockMessage,
          options
        )) {
          chunks.push(chunk);
        }

        expect(chunks).toHaveLength(4);
        expect(chunks[0].content).toBe('I');
        expect(chunks[1].content).toBe(' am');
        expect(chunks[2].content).toBe(' well');
        expect(chunks[3].done).toBe(true);
      });
    });

    describe('Function Calling', () => {
      it('should execute function call', async () => {
        const functions = [
          {
            name: 'get_weather',
            description: 'Get the current weather for a location',
            parameters: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'The city and state, e.g. San Francisco, CA',
                },
              },
              required: ['location'],
            },
          },
        ];

        const mockConversationService = require('@/services/conversationService');
        mockConversationService.conversationService = {
          addMessage: jest.fn().mockResolvedValue({
            id: 'mock-user-message-id',
            role: 'USER',
            content: 'What is the weather in New York?',
            tokenCount: 10,
          }),
          buildContext: jest.fn().mockResolvedValue({
            messages: [],
            systemPrompt: 'You are a helpful assistant.',
            totalTokens: 15,
            contextWindow: 4096,
            strategy: 'SLIDING_WINDOW',
            nodeId: mockNodeId,
            workflowId: mockWorkflowId,
            threadId: mockThreadId,
          }),
        };

        const mockFunctionCallResponse = {
          choices: [
            {
              message: {
                role: ChatMessageRole.ASSISTANT,
                content: null,
                functionCall: {
                  name: 'get_weather',
                  arguments: '{"location": "New York, NY"}',
                },
              },
              finishReason: 'function_call',
            },
          ],
          usage: {
            promptTokens: 30,
            completionTokens: 20,
            totalTokens: 50,
          },
          metadata: {
            requestId: 'function-test-id',
            provider: LLMProviderType.OPENAI,
            model: 'gpt-3.5-turbo',
          },
        };

        jest.spyOn(llmService, 'chat').mockResolvedValue(mockFunctionCallResponse as any);

        const result = await conversationExecutor.executeFunctionCall(
          mockNodeId,
          mockWorkflowId,
          mockThreadId,
          mockUserId,
          'What is the weather in New York?',
          functions
        );

        expect(result).toHaveProperty('functionCall');
        expect(result.functionCall.name).toBe('get_weather');
        expect(result.functionCall.arguments).toBe('{"location": "New York, NY"}');
      });
    });

    describe('Tool Calling', () => {
      it('should execute tool call', async () => {
        const tools = [
          {
            type: 'function',
            function: {
              name: 'search_database',
              description: 'Search a database for information',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'The search query',
                  },
                },
                required: ['query'],
              },
            },
          },
        ];

        const mockConversationService = require('@/services/conversationService');
        mockConversationService.conversationService = {
          addMessage: jest.fn().mockResolvedValue({
            id: 'mock-user-message-id',
            role: 'USER',
            content: 'Search for information about machine learning',
            tokenCount: 12,
          }),
          buildContext: jest.fn().mockResolvedValue({
            messages: [],
            systemPrompt: 'You are a helpful assistant.',
            totalTokens: 15,
            contextWindow: 4096,
            strategy: 'SLIDING_WINDOW',
            nodeId: mockNodeId,
            workflowId: mockWorkflowId,
            threadId: mockThreadId,
          }),
        };

        const mockToolCallResponse = {
          choices: [
            {
              message: {
                role: ChatMessageRole.ASSISTANT,
                content: null,
                toolCalls: [
                  {
                    id: 'call_123',
                    type: 'function',
                    function: {
                      name: 'search_database',
                      arguments: '{"query": "machine learning"}',
                    },
                  },
                ],
              },
              finishReason: 'tool_calls',
            },
          ],
          usage: {
            promptTokens: 35,
            completionTokens: 25,
            totalTokens: 60,
          },
          metadata: {
            requestId: 'tool-test-id',
            provider: LLMProviderType.OPENAI,
            model: 'gpt-3.5-turbo',
          },
        };

        jest.spyOn(llmService, 'chat').mockResolvedValue(mockToolCallResponse as any);

        const result = await conversationExecutor.executeToolCall(
          mockNodeId,
          mockWorkflowId,
          mockThreadId,
          mockUserId,
          'Search for information about machine learning',
          tools
        );

        expect(result).toHaveProperty('toolCalls');
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].function.name).toBe('search_database');
        expect(result.toolCalls[0].function.arguments).toBe('{"query": "machine learning"}');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM service errors gracefully', async () => {
      jest.spyOn(llmService, 'chat').mockRejectedValue(new Error('API Error'));

      const mockConversationService = require('@/services/conversationService');
      mockConversationService.conversationService = {
        addMessage: jest.fn().mockResolvedValue({
          id: 'mock-user-message-id',
          role: 'USER',
          content: 'Test message',
          tokenCount: 5,
        }),
        buildContext: jest.fn().mockResolvedValue({
          messages: [],
          systemPrompt: 'You are a helpful assistant.',
          totalTokens: 15,
          contextWindow: 4096,
          strategy: 'SLIDING_WINDOW',
          nodeId: 'test-node',
          workflowId: 'test-workflow',
          threadId: 'test-thread',
        }),
      };

      await expect(
        conversationExecutor.executeConversation(
          'test-node',
          'test-workflow',
          'test-thread',
          'test-user',
          'Test message'
        )
      ).rejects.toThrow('API Error');
    });

    it('should handle invalid model requests', async () => {
      await expect(
        llmService.getModelCapabilities('invalid-model-name')
      ).rejects.toThrow('Model invalid-model-name not found');
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests', async () => {
      const mockConversationService = require('@/services/conversationService');
      mockConversationService.conversationService = {
        addMessage: jest.fn().mockResolvedValue({
          id: 'mock-message-id',
          role: 'USER',
          content: 'Test message',
          tokenCount: 5,
        }),
        buildContext: jest.fn().mockResolvedValue({
          messages: [],
          systemPrompt: 'You are a helpful assistant.',
          totalTokens: 15,
          contextWindow: 4096,
          strategy: 'SLIDING_WINDOW',
          nodeId: 'test-node',
          workflowId: 'test-workflow',
          threadId: 'test-thread',
        }),
        invalidateConversationContextCache: jest.fn(),
        updateConversationStats: jest.fn(),
      };

      const mockLLMResponse = {
        choices: [
          {
            message: {
              role: ChatMessageRole.ASSISTANT,
              content: 'Test response',
            },
            finishReason: 'stop',
            index: 0,
          },
        ],
        usage: {
          promptTokens: 20,
          completionTokens: 10,
          totalTokens: 30,
        },
        metadata: {
          requestId: 'concurrent-test-id',
          provider: LLMProviderType.OPENAI,
          model: 'gpt-3.5-turbo',
          processingTime: 1000,
          tokenCount: {
            promptTokens: 20,
            completionTokens: 10,
            totalTokens: 30,
          },
          cost: {
            inputCost: 0.00003,
            outputCost: 0.00002,
            totalCost: 0.00005,
            currency: 'USD',
            model: 'gpt-3.5-turbo',
          },
          cached: false,
        },
      };

      jest.spyOn(llmService, 'chat').mockResolvedValue(mockLLMResponse as any);

      // Create 5 concurrent requests
      const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
        conversationExecutor.executeConversation(
          `test-node-${i}`,
          `test-workflow-${i}`,
          `test-thread-${i}`,
          `test-user-${i}`,
          `Test message ${i}`
        )
      );

      const startTime = Date.now();
      const results = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      expect(results).toHaveLength(5);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});