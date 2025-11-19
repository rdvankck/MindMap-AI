import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server configuration
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  
  // Database configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/llm_interface',
  },
  
  // Redis configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyPrefix: 'llm:',
  },
  
  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: '30d',
  },
  
  // OpenAI configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    organization: process.env.OPENAI_ORGANIZATION,
    maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10),
    timeout: parseInt(process.env.OPENAI_TIMEOUT || '60000', 10),
  },
  
  // Ollama configuration
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    timeout: parseInt(process.env.OLLAMA_TIMEOUT || '120000', 10),
  },
  
  // File upload configuration
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: process.env.MAX_FILE_SIZE || '10MB',
    allowedTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/json',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },
  
  // WebSocket configuration
  ws: {
    heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10),
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log',
    maxSize: '20m',
    maxFiles: '14d',
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15', 10) * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  
  // Execution configuration
  execution: {
    defaultTimeout: parseInt(process.env.EXECUTION_TIMEOUT || '300000', 10), // 5 minutes
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_EXECUTIONS || '10', 10),
    cacheTimeout: parseInt(process.env.CACHE_TIMEOUT || '3600', 10), // 1 hour
  },
  
  // External services
  services: {
    sendGrid: {
      apiKey: process.env.SENDGRID_API_KEY || '',
      fromEmail: process.env.FROM_EMAIL || 'noreply@llm-interface.com',
    },
    slack: {
      botToken: process.env.SLACK_BOT_TOKEN || '',
    },
  },
  
  // Feature flags
  features: {
    enableRegistration: process.env.ENABLE_REGISTRATION !== 'false',
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
    enablePublicWorkflows: process.env.ENABLE_PUBLIC_WORKFLOWS !== 'false',
    enableTemplates: process.env.ENABLE_TEMPLATES !== 'false',
    enableFileUpload: process.env.ENABLE_FILE_UPLOAD !== 'false',
    enableChat: process.env.ENABLE_CHAT !== 'false',
    enableCollaboration: process.env.ENABLE_COLLABORATION === 'true',
    enableRecomputation: process.env.ENABLE_RECOMPUTATION !== 'false',
  },
  
  // Re-computation configuration
  recomputation: {
    maxConcurrentPlans: parseInt(process.env.MAX_CONCURRENT_RECOMPUTATION_PLANS || '5', 10),
    maxBatchSize: parseInt(process.env.RECOMPUTATION_BATCH_SIZE || '20', 10),
    defaultTimeout: parseInt(process.env.RECOMPUTATION_TIMEOUT || '600000', 10), // 10 minutes
    retryAttempts: parseInt(process.env.RECOMPUTATION_RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.RECOMPUTATION_RETRY_DELAY || '1000', 10), // 1 second
    enableAutoRetry: process.env.ENABLE_RECOMPUTATION_AUTO_RETRY !== 'false',
    enableSmartCaching: process.env.ENABLE_SMART_CACHING !== 'false',
    enableParallelExecution: process.env.ENABLE_PARALLEL_RECOMPUTATION !== 'false',
    priorityQueueSize: parseInt(process.env.RECOMPUTATION_PRIORITY_QUEUE_SIZE || '100', 10),
    progressUpdateInterval: parseInt(process.env.RECOMPUTATION_PROGRESS_INTERVAL || '1000', 10), // 1 second
    costEstimationCacheTTL: parseInt(process.env.COST_ESTIMATION_CACHE_TTL || '300', 10), // 5 minutes
  },
} as const;

export type Config = typeof config;