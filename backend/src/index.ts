import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import rateLimit from 'express-rate-limit';

import { config } from '@/config';
// import { logger } from '@/utils/logger';
import { connectRedis } from '@/config/redis';
import { errorHandler } from '@/middleware/errorHandler';
import { notFoundHandler } from '@/middleware/notFoundHandler';
import { authMiddleware } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';
import { setupRoutes } from '@/routes';
import { setupWebSocket } from '@/websocket';
import { setupDependencyWebSocket } from '@/websocket/dependencyWebSocket';
import { setupRecomputationWebSocket } from '@/websocket/recomputationWebSocket';
import { initializeLLMWebSocket } from '@/websocket/llmWebSocket';
import { llmService } from '@/services/llm/LLMService';
import { conversationExecutor } from '@/services/llm/ConversationExecutor';
import { dependencyBackgroundService } from '@/services/dependencyBackgroundService';
import { recomputationEngine } from '@/services/recomputationEngine';
import { smartCacheManager } from '@/services/smartCacheManager';
import { recomputationBackgroundService } from '@/services/recomputationBackgroundService';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.rateLimit.max, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}));

app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(compression());
app.use(morgan('combined'));
app.use(limiter);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API routes
app.use('/api', setupRoutes());

// Socket.IO setup - temporarily disabled
// setupWebSocket(io);
// setupDependencyWebSocket(io);
// setupRecomputationWebSocket(io);
// const llmWebSocketHandler = initializeLLMWebSocket(io);
console.log('WebSocket setup temporarily disabled');

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(async () => {
    console.log('HTTP server closed.');
    
    try {
      // Close database connections
      const { prisma } = await import('@/config/database');
      await prisma.$disconnect();
      console.log('Database connection closed.');
      
      // Close Redis connection
      const redis = await import('@/config/redis');
      await redis.disconnect();
      console.log('Redis connection closed.');
      
      // Stop dependency background service
      await dependencyBackgroundService.stop();
      console.log('Dependency background service stopped.');
      
      // Note: LLM service cleanup would go here if needed
      
      // Shutdown re-computation engine
      if (config.features.enableRecomputation) {
        await recomputationEngine.shutdown();
        await recomputationBackgroundService.stop();
        console.log('Re-computation services stopped');
      }
      
      console.log('Graceful shutdown completed.');
      process.exit(0);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Connect to Redis (optional)
    try {
      await connectRedis();
      console.log('Redis connected successfully');
    } catch (error) {
      console.warn('Redis not available, continuing without Redis:', error);
    }
    
    // Test database connection
    const { prisma } = await import('@/config/database');
    await prisma.$connect();
    console.log('Database connected successfully');
    
    // Initialize LLM service
    await llmService.initialize();
    console.log('LLM service initialized');
    
    // Start dependency background service
    await dependencyBackgroundService.start();
    console.log('Dependency background service started');
    
    // Start re-computation services
    if (config.features.enableRecomputation) {
      await recomputationBackgroundService.start();
      await smartCacheManager.intelligentWarm();
      console.log('Re-computation services started');
    }
    
    // Start listening
    server.listen(config.port, () => {
      console.log(`Server running on port ${config.port} in ${config.env} mode`);
      console.log(`WebSocket server ready`);
      console.log(`Dependency tracking enabled`);
      console.log(`Health check available at http://localhost:${config.port}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Only start server if not in test mode
if (config.env !== 'test') {
  startServer();
}

export { app, server, io };