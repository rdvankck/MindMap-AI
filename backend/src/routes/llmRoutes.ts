import { Router } from 'express';
import { llmController } from '@/controllers/llmController';
import { validateLLMRequest, validateEmbeddingRequest, validateConversationRequest } from '@/validators/llmValidator';
import { authMiddleware } from '@/middleware/auth';
import { rateLimit } from 'express-rate-limit';
import { config } from '@/config';

const router = Router();

// Rate limiting for LLM endpoints
const llmRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply authentication and rate limiting to all routes
router.use(authMiddleware);
router.use(llmRateLimit);

/**
 * Core LLM API Endpoints
 */

// Chat completion - supports both streaming and non-streaming
router.post('/chat/completions', validateLLMRequest, llmController.chatCompletion.bind(llmController));

// Text completion (legacy)
router.post('/completions', validateLLMRequest, llmController.textCompletion.bind(llmController));

// Embeddings
router.post('/embeddings', validateEmbeddingRequest, llmController.embeddings.bind(llmController));

/**
 * Provider and Model Information
 */

// Get all available providers and their status
router.get('/providers', llmController.getProviders.bind(llmController));

// Get all available models, optionally filtered by provider
router.get('/models', llmController.getModels.bind(llmController));

// Get capabilities for a specific model
router.get('/models/:model/capabilities', llmController.getModelCapabilities.bind(llmController));

// Test a specific provider connection
router.get('/providers/:provider/test', llmController.testProvider.bind(llmController));

/**
 * Utility Endpoints
 */

// Estimate token count for text
router.post('/tokens/estimate', llmController.estimateTokens.bind(llmController));

// Estimate cost for token usage
router.post('/cost/estimate', llmController.estimateCost.bind(llmController));

// Get usage analytics
router.get('/analytics', llmController.getUsageAnalytics.bind(llmController));

// Health check for LLM service
router.get('/health', llmController.healthCheck.bind(llmController));

/**
 * Conversation Execution Endpoints
 */

// Execute a conversation (node-based)
router.post('/conversations/execute', validateConversationRequest, llmController.executeConversation.bind(llmController));

// Execute a function call in conversation
router.post('/conversations/functions', validateConversationRequest, llmController.executeFunctionCall.bind(llmController));

// Execute tool calls in conversation
router.post('/conversations/tools', validateConversationRequest, llmController.executeToolCall.bind(llmController));

// Cancel an active execution
router.delete('/executions/:executionId', llmController.cancelExecution.bind(llmController));

/**
 * Batch Operations
 */

// Batch chat completions
router.post('/batch/chat/completions', async (req, res, next) => {
  try {
    const { requests, options = {} } = req.body;
    
    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid batch request: requests must be a non-empty array',
      });
    }

    // Process batch requests in parallel
    const results = await Promise.allSettled(
      requests.map(async (request, index) => {
        try {
          const result = await llmController.chatCompletion(
            { ...req, body: request },
            res,
            next
          );
          return { index, success: true, data: result };
        } catch (error) {
          return { index, success: false, error: error.message };
        }
      })
    );

    res.json({
      success: true,
      data: {
        results,
        total: requests.length,
        successful: results.filter(r => r.status === 'fulfilled').length,
        failed: results.filter(r => r.status === 'rejected').length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Batch embeddings
router.post('/batch/embeddings', async (req, res, next) => {
  try {
    const { requests, options = {} } = req.body;
    
    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid batch request: requests must be a non-empty array',
      });
    }

    // Process batch requests in parallel
    const results = await Promise.allSettled(
      requests.map(async (request, index) => {
        try {
          const result = await llmController.embeddings(
            { ...req, body: request },
            res,
            next
          );
          return { index, success: true, data: result };
        } catch (error) {
          return { index, success: false, error: error.message };
        }
      })
    );

    res.json({
      success: true,
      data: {
        results,
        total: requests.length,
        successful: results.filter(r => r.status === 'fulfilled').length,
        failed: results.filter(r => r.status === 'rejected').length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Advanced Features
 */

// Fine-tuning endpoint placeholder
router.post('/fine-tuning/jobs', (req, res) => {
  res.json({
    success: false,
    error: 'Fine-tuning not yet implemented',
  });
});

// Get fine-tuning jobs
router.get('/fine-tuning/jobs', (req, res) => {
  res.json({
    success: false,
    error: 'Fine-tuning not yet implemented',
  });
});

// Model comparison endpoint
router.post('/models/compare', async (req, res, next) => {
  try {
    const { models, prompt, options = {} } = req.body;
    
    if (!Array.isArray(models) || models.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 models required for comparison',
      });
    }

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required for comparison',
      });
    }

    // Run the same prompt on multiple models
    const results = await Promise.all(
      models.map(async (model) => {
        try {
          const request = {
            model,
            messages: [{ role: 'user', content: prompt }],
            ...options,
          };

          const result = await llmController.chatCompletion(
            { ...req, body: request },
            res,
            next
          );

          return {
            model,
            success: true,
            response: result,
          };
        } catch (error) {
          return {
            model,
            success: false,
            error: error.message,
          };
        }
      })
    );

    res.json({
      success: true,
      data: {
        prompt,
        results,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Streaming comparison endpoint
router.post('/models/compare/stream', async (req, res) => {
  try {
    const { models, prompt, options = {} } = req.body;
    
    if (!Array.isArray(models) || models.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 models required for comparison',
      });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Initialize comparison state
    const comparisonState = {
      prompt,
      models: models.map(model => ({ model, status: 'pending', response: null, error: null })),
      startTime: Date.now(),
    };

    res.write(`data: ${JSON.stringify({ type: 'start', state: comparisonState })}\n\n`);

    // Process each model
    for (const model of models) {
      try {
        const request = {
          model,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          ...options,
        };

        let accumulatedResponse = '';
        
        res.write(`data: ${JSON.stringify({ type: 'model_start', model })}\n\n`);

        // This would need to be adapted for actual streaming
        const result = await llmController.chatCompletion(
          { ...req, body: request },
          res,
          () => {} // dummy next function
        );

        accumulatedResponse = result.choices[0]?.message?.content || '';

        const modelState = {
          model,
          status: 'completed',
          response: accumulatedResponse,
          tokenCount: result.usage?.totalTokens || 0,
          processingTime: Date.now() - comparisonState.startTime,
        };

        res.write(`data: ${JSON.stringify({ type: 'model_complete', state: modelState })}\n\n`);

      } catch (error) {
        const modelState = {
          model,
          status: 'error',
          error: error.message,
        };

        res.write(`data: ${JSON.stringify({ type: 'model_error', state: modelState })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'complete', state: comparisonState })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

export default router;