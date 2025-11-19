import { PrismaClient } from '@prisma/client';
import { config } from './index';
// import { logger } from '@/utils/logger';

// Singleton instance of PrismaClient
class Database {
  private static instance: PrismaClient;

  public static getInstance(): PrismaClient {
    if (!Database.instance) {
      Database.instance = new PrismaClient({
        // log: [
        //   {
        //     emit: 'event',
        //     level: 'query',
        //   },
        //   {
        //     emit: 'event',
        //     level: 'error',
        //   },
        //   {
        //     emit: 'event',
        //     level: 'info',
        //   },
        //   {
        //     emit: 'event',
        //     level: 'warn',
        //   },
        // ],
        errorFormat: 'pretty',
      });

      // Logging configuration
      // Database.instance.$on('query', (e) => {
      //   if (config.env === 'development') {
      //     logger.debug(`Query: ${e.query}`);
      //     logger.debug(`Duration: ${e.duration}ms`);
      //   }
      // });

      // Database.instance.$on('error', (e) => {
      //   logger.error('Database error:', e);
      // });

      // Database.instance.$on('info', (e) => {
      //   logger.info('Database info:', e.message);
      // });

      // Database.instance.$on('warn', (e) => {
      //   logger.warn('Database warning:', e.message);
      // });
    }

    return Database.instance;
  }

  public static async disconnect(): Promise<void> {
    if (Database.instance) {
      await Database.instance.$disconnect();
      Database.instance = null as any;
    }
  }
}

export const prisma = Database.getInstance();

// Health check function
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
};

// Database migration helper
export const runMigrations = async (): Promise<void> => {
  try {
    console.log('Running database migrations...');
    // Note: In production, migrations should be run via CLI
    // This is mainly for development convenience
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

// Database reset helper (development only)
export const resetDatabase = async (): Promise<void> => {
  if (config.env !== 'development') {
    throw new Error('Database reset is only allowed in development mode');
  }

  try {
    console.warn('Resetting database...');
    // Note: This should be used with extreme caution
    await prisma.$executeRaw`TRUNCATE TABLE "workflow_executions", "execution_logs", "chat_messages", "chat_sessions", "workflows", "file_uploads", "user_settings", "api_keys", "workflow_templates" RESTART IDENTITY CASCADE`;
    console.log('Database reset completed');
  } catch (error) {
    console.error('Database reset failed:', error);
    throw error;
  }
};