import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';

/**
 * LLM Request Validators
 * Comprehensive validation for all LLM-related requests
 */

// Handle validation errors
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value,
      })),
    });
    return;
  }
  next();
};

/**
 * Chat Completion Request Validation
 */
export const validateLLMRequest = [
  // Model validation
  body('model')
    .optional()
    .isString()
    .withMessage('Model must be a string')
    .isLength({ min: 1, max: 100 })
    .withMessage('Model must be between 1 and 100 characters'),

  // Messages validation
  body('messages')
    .isArray({ min: 1 })
    .withMessage('Messages must be an array with at least one message'),

  body('messages.*.role')
    .isIn(['system', 'user', 'assistant', 'function', 'tool'])
    .withMessage('Message role must be one of: system, user, assistant, function, tool'),

  body('messages.*.content')
    .custom((value) => {
      if (value !== null && typeof value !== 'string') {
        throw new Error('Message content must be a string or null');
      }
      if (typeof value === 'string' && value.length > 100000) {
        throw new Error('Message content must be less than 100,000 characters');
      }
      return true;
    }),

  // Temperature validation
  body('temperature')
    .optional()
    .isFloat({ min: 0, max: 2 })
    .withMessage('Temperature must be between 0 and 2'),

  // Max tokens validation
  body('maxTokens')
    .optional()
    .isInt({ min: 1, max: 32768 })
    .withMessage('Max tokens must be between 1 and 32768'),

  // Top P validation
  body('topP')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Top P must be between 0 and 1'),

  // Frequency penalty validation
  body('frequencyPenalty')
    .optional()
    .isFloat({ min: -2, max: 2 })
    .withMessage('Frequency penalty must be between -2 and 2'),

  // Presence penalty validation
  body('presencePenalty')
    .optional()
    .isFloat({ min: -2, max: 2 })
    .withMessage('Presence penalty must be between -2 and 2'),

  // Stop sequences validation
  body('stop')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        if (value.length > 100) {
          throw new Error('Stop sequence must be less than 100 characters');
        }
      } else if (Array.isArray(value)) {
        if (value.length > 4) {
          throw new Error('Maximum 4 stop sequences allowed');
        }
        for (const stop of value) {
          if (typeof stop !== 'string' || stop.length > 100) {
            throw new Error('Each stop sequence must be a string less than 100 characters');
          }
        }
      } else {
        throw new Error('Stop must be a string or array of strings');
      }
      return true;
    }),

  // Stream validation
  body('stream')
    .optional()
    .isBoolean()
    .withMessage('Stream must be a boolean'),

  // Functions validation (legacy)
  body('functions')
    .optional()
    .isArray()
    .withMessage('Functions must be an array'),

  body('functions.*.name')
    .if(body('functions').exists())
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Function name must be between 1 and 100 characters'),

  body('functions.*.description')
    .if(body('functions').exists())
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Function description must be less than 500 characters'),

  body('functions.*.parameters')
    .if(body('functions').exists())
    .isObject()
    .withMessage('Function parameters must be an object'),

  // Function call validation (legacy)
  body('functionCall')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        if (!['auto', 'none'].includes(value)) {
          throw new Error('Function call must be "auto" or "none" when string');
        }
      } else if (typeof value === 'object' && value !== null) {
        if (!value.name || typeof value.name !== 'string') {
          throw new Error('Function call object must have a name property');
        }
      } else if (value !== undefined) {
        throw new Error('Function call must be a string, object, or undefined');
      }
      return true;
    }),

  // Tools validation (new)
  body('tools')
    .optional()
    .isArray()
    .withMessage('Tools must be an array'),

  body('tools.*.type')
    .if(body('tools').exists())
    .equals('function')
    .withMessage('Tool type must be "function"'),

  body('tools.*.function')
    .if(body('tools').exists())
    .isObject()
    .withMessage('Tool function must be an object'),

  body('tools.*.function.name')
    .if(body('tools').exists())
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Tool function name must be between 1 and 100 characters'),

  body('tools.*.function.description')
    .if(body('tools').exists())
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Tool function description must be less than 500 characters'),

  body('tools.*.function.parameters')
    .if(body('tools').exists())
    .isObject()
    .withMessage('Tool function parameters must be an object'),

  // Tool choice validation
  body('toolChoice')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        if (!['auto', 'none'].includes(value)) {
          throw new Error('Tool choice must be "auto" or "none" when string');
        }
      } else if (typeof value === 'object' && value !== null) {
        if (value.type !== 'function' || !value.function || !value.function.name) {
          throw new Error('Tool choice object must have type "function" and function.name');
        }
      } else if (value !== undefined) {
        throw new Error('Tool choice must be a string, object, or undefined');
      }
      return true;
    }),

  // Response format validation
  body('responseFormat')
    .optional()
    .isObject()
    .withMessage('Response format must be an object'),

  body('responseFormat.type')
    .if(body('responseFormat').exists())
    .isIn(['text', 'json_object'])
    .withMessage('Response format type must be "text" or "json_object"'),

  // Seed validation
  body('seed')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Seed must be a non-negative integer'),

  // User validation
  body('user')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('User must be a string less than 100 characters'),

  // Timeout validation
  body('timeout')
    .optional()
    .isInt({ min: 1000, max: 600000 })
    .withMessage('Timeout must be between 1000ms and 600000ms'),

  // Cache validation
  body('cache')
    .optional()
    .isBoolean()
    .withMessage('Cache must be a boolean'),

  // Priority validation
  query('priority')
    .optional()
    .isIn(['low', 'normal', 'high'])
    .withMessage('Priority must be one of: low, normal, high'),

  handleValidationErrors,
];

/**
 * Embedding Request Validation
 */
export const validateEmbeddingRequest = [
  // Model validation
  body('model')
    .isString()
    .withMessage('Model must be a string')
    .isLength({ min: 1, max: 100 })
    .withMessage('Model must be between 1 and 100 characters'),

  // Input validation
  body('input')
    .custom((value) => {
      if (typeof value === 'string') {
        if (value.length === 0 || value.length > 8192) {
          throw new Error('Input string must be between 1 and 8192 characters');
        }
      } else if (Array.isArray(value)) {
        if (value.length === 0 || value.length > 2048) {
          throw new Error('Input array must have between 1 and 2048 items');
        }
        for (let i = 0; i < value.length; i++) {
          if (typeof value[i] !== 'string' || value[i].length === 0 || value[i].length > 8192) {
            throw new Error(`Input array item ${i} must be a string between 1 and 8192 characters`);
          }
        }
      } else {
        throw new Error('Input must be a string or array of strings');
      }
      return true;
    }),

  // Encoding format validation
  body('encodingFormat')
    .optional()
    .isIn(['float', 'base64'])
    .withMessage('Encoding format must be "float" or "base64"'),

  // Dimensions validation
  body('dimensions')
    .optional()
    .isInt({ min: 1, max: 3072 })
    .withMessage('Dimensions must be between 1 and 3072'),

  // User validation
  body('user')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('User must be a string less than 100 characters'),

  handleValidationErrors,
];

/**
 * Conversation Execution Request Validation
 */
export const validateConversationRequest = [
  // Node ID validation
  body('nodeId')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Node ID must be between 1 and 100 characters'),

  // Workflow ID validation
  body('workflowId')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Workflow ID must be between 1 and 100 characters'),

  // Thread ID validation
  body('threadId')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Thread ID must be between 1 and 100 characters'),

  // Message validation
  body('message')
    .isString()
    .isLength({ min: 1, max: 50000 })
    .withMessage('Message must be between 1 and 50,000 characters'),

  // Model validation
  body('options.model')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Model must be between 1 and 100 characters'),

  // Temperature validation
  body('options.temperature')
    .optional()
    .isFloat({ min: 0, max: 2 })
    .withMessage('Temperature must be between 0 and 2'),

  // Max tokens validation
  body('options.maxTokens')
    .optional()
    .isInt({ min: 1, max: 32768 })
    .withMessage('Max tokens must be between 1 and 32768'),

  // System prompt validation
  body('options.systemPrompt')
    .optional()
    .isString()
    .isLength({ max: 10000 })
    .withMessage('System prompt must be less than 10,000 characters'),

  // Context strategy validation
  body('options.contextStrategy')
    .optional()
    .isIn(['FULL', 'SLIDING_WINDOW', 'SUMMARIZATION', 'SELECTIVE', 'HYBRID'])
    .withMessage('Context strategy must be one of: FULL, SLIDING_WINDOW, SUMMARIZATION, SELECTIVE, HYBRID'),

  // Context window validation
  body('options.contextWindow')
    .optional()
    .isInt({ min: 512, max: 128000 })
    .withMessage('Context window must be between 512 and 128,000 tokens'),

  // Stream validation
  body('options.stream')
    .optional()
    .isBoolean()
    .withMessage('Stream must be a boolean'),

  // Tools validation
  body('options.tools')
    .optional()
    .isArray()
    .withMessage('Tools must be an array'),

  // Functions validation
  body('options.functions')
    .optional()
    .isArray()
    .withMessage('Functions must be an array'),

  // Response format validation
  body('options.responseFormat')
    .optional()
    .isObject()
    .withMessage('Response format must be an object'),

  body('options.responseFormat.type')
    .if(body('options.responseFormat').exists())
    .isIn(['text', 'json_object'])
    .withMessage('Response format type must be "text" or "json_object"'),

  handleValidationErrors,
];

/**
 * Model Parameters Validation
 */
export const validateModelParameters = [
  body('model')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Model must be between 1 and 100 characters'),

  body('temperature')
    .optional()
    .isFloat({ min: 0, max: 2 })
    .withMessage('Temperature must be between 0 and 2'),

  body('maxTokens')
    .optional()
    .isInt({ min: 1, max: 32768 })
    .withMessage('Max tokens must be between 1 and 32768'),

  body('topP')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Top P must be between 0 and 1'),

  body('frequencyPenalty')
    .optional()
    .isFloat({ min: -2, max: 2 })
    .withMessage('Frequency penalty must be between -2 and 2'),

  body('presencePenalty')
    .optional()
    .isFloat({ min: -2, max: 2 })
    .withMessage('Presence penalty must be between -2 and 2'),

  handleValidationErrors,
];

/**
 * Token Estimation Request Validation
 */
export const validateTokenEstimation = [
  body('text')
    .isString()
    .isLength({ min: 1, max: 1000000 })
    .withMessage('Text must be between 1 and 1,000,000 characters'),

  body('model')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Model must be between 1 and 100 characters'),

  handleValidationErrors,
];

/**
 * Cost Estimation Request Validation
 */
export const validateCostEstimation = [
  body('usage.promptTokens')
    .isInt({ min: 0 })
    .withMessage('Prompt tokens must be a non-negative integer'),

  body('usage.completionTokens')
    .isInt({ min: 0 })
    .withMessage('Completion tokens must be a non-negative integer'),

  body('usage.totalTokens')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Total tokens must be a non-negative integer'),

  body('model')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Model must be between 1 and 100 characters'),

  // Custom validation to ensure consistency
  body().custom((value, { req }) => {
    const { promptTokens, completionTokens } = req.body.usage;
    const totalTokens = promptTokens + completionTokens;
    
    if (req.body.usage.totalTokens && req.body.usage.totalTokens !== totalTokens) {
      throw new Error('Total tokens must equal prompt tokens + completion tokens');
    }
    
    return true;
  }),

  handleValidationErrors,
];

/**
 * Model Name Parameter Validation
 */
export const validateModelName = [
  param('model')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Model name must be between 1 and 100 characters'),

  handleValidationErrors,
];

/**
 * Provider Name Parameter Validation
 */
export const validateProviderName = [
  param('provider')
    .isIn(['openai', 'ollama', 'anthropic', 'azure_openai', 'google', 'huggingface', 'custom'])
    .withMessage('Provider must be one of: openai, ollama, anthropic, azure_openai, google, huggingface, custom'),

  handleValidationErrors,
];

/**
 * Execution ID Parameter Validation
 */
export const validateExecutionId = [
  param('executionId')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Execution ID must be between 1 and 100 characters'),

  handleValidationErrors,
];

/**
 * Batch Request Validation
 */
export const validateBatchRequest = [
  body('requests')
    .isArray({ min: 1, max: 20 })
    .withMessage('Requests must be an array with 1 to 20 items'),

  body('requests.*')
    .custom((value, { req }) => {
      // Each request should be a valid LLM request
      // This is a simplified validation - in practice, you might want to run the full LLM validator on each item
      if (!value.model || !value.messages || !Array.isArray(value.messages)) {
        throw new Error('Each request must have a model and messages array');
      }
      return true;
    }),

  body('options.parallel')
    .optional()
    .isBoolean()
    .withMessage('Parallel option must be a boolean'),

  handleValidationErrors,
];