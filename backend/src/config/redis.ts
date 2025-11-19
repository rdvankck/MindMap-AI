import Redis from 'ioredis';
import { config } from './index';
// import { logger } from '@/utils/logger';

class RedisClient {
  private static instance: Redis;

  public static getInstance(): Redis {
    if (!RedisClient.instance) {
      RedisClient.instance = new Redis(config.redis.url, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keyPrefix: config.redis.keyPrefix,
        // Configuration options
        connectTimeout: 10000,
        commandTimeout: 5000,
        // Reconnection strategy
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      RedisClient.instance.on('connect', () => {
        console.info('Redis connected successfully');
      });

      RedisClient.instance.on('ready', () => {
        console.info('Redis ready for commands');
      });

      RedisClient.instance.on('error', (err) => {
        console.error('Redis connection error:', err);
      });

      RedisClient.instance.on('close', () => {
        console.warn('Redis connection closed');
      });

      RedisClient.instance.on('reconnecting', () => {
        console.info('Redis reconnecting...');
      });
    }

    return RedisClient.instance;
  }

  public static async disconnect(): Promise<void> {
    if (RedisClient.instance) {
      await RedisClient.instance.quit();
      RedisClient.instance = null as any;
    }
  }
}

export const redis = RedisClient.getInstance();

export const connectRedis = async (): Promise<void> => {
  try {
    await redis.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    throw error;
  }
};

// Redis utility functions
export const cache = {
  // Set cache with TTL
  set: async (key: string, value: any, ttlSeconds?: number): Promise<void> => {
    try {
      const serializedValue = JSON.stringify(value);
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, serializedValue);
      } else {
        await redis.set(key, serializedValue);
      }
    } catch (error) {
      console.error('Cache set error:', error);
      throw error;
    }
  },

  // Get cache value
  get: async <T = any>(key: string): Promise<T | null> => {
    try {
      const value = await redis.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  // Delete cache key
  del: async (key: string): Promise<void> => {
    try {
      await redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
      throw error;
    }
  },

  // Check if key exists
  exists: async (key: string): Promise<boolean> => {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  },

  // Set cache only if key doesn't exist
  setnx: async (key: string, value: any, ttlSeconds?: number): Promise<boolean> => {
    try {
      const serializedValue = JSON.stringify(value);
      const result = await redis.setnx(key, serializedValue);
      if (result && ttlSeconds) {
        await redis.expire(key, ttlSeconds);
      }
      return result === 1;
    } catch (error) {
      console.error('Cache setnx error:', error);
      return false;
    }
  },

  // Increment counter
  incr: async (key: string): Promise<number> => {
    try {
      return await redis.incr(key);
    } catch (error) {
      console.error('Cache increment error:', error);
      throw error;
    }
  },

  // Increment counter by amount
  incrby: async (key: string, amount: number): Promise<number> => {
    try {
      return await redis.incrby(key, amount);
    } catch (error) {
      console.error('Cache incrementby error:', error);
      throw error;
    }
  },

  // Add to set
  sadd: async (key: string, ...members: string[]): Promise<number> => {
    try {
      return await redis.sadd(key, ...members);
    } catch (error) {
      console.error('Cache sadd error:', error);
      throw error;
    }
  },

  // Remove from set
  srem: async (key: string, ...members: string[]): Promise<number> => {
    try {
      return await redis.srem(key, ...members);
    } catch (error) {
      console.error('Cache srem error:', error);
      throw error;
    }
  },

  // Get all set members
  smembers: async (key: string): Promise<string[]> => {
    try {
      return await redis.smembers(key);
    } catch (error) {
      console.error('Cache smembers error:', error);
      return [];
    }
  },

  // Check if member exists in set
  sismember: async (key: string, member: string): Promise<boolean> => {
    try {
      const result = await redis.sismember(key, member);
      return result === 1;
    } catch (error) {
      console.error('Cache sismember error:', error);
      return false;
    }
  },

  // Push to list
  lpush: async (key: string, ...elements: string[]): Promise<number> => {
    try {
      return await redis.lpush(key, ...elements);
    } catch (error) {
      console.error('Cache lpush error:', error);
      throw error;
    }
  },

  // Pop from list
  rpop: async (key: string): Promise<string | null> => {
    try {
      return await redis.rpop(key);
    } catch (error) {
      console.error('Cache rpop error:', error);
      return null;
    }
  },

  // Get list length
  llen: async (key: string): Promise<number> => {
    try {
      return await redis.llen(key);
    } catch (error) {
      console.error('Cache llen error:', error);
      return 0;
    }
  },

  // Get list range
  lrange: async (key: string, start: number, stop: number): Promise<string[]> => {
    try {
      return await redis.lrange(key, start, stop);
    } catch (error) {
      console.error('Cache lrange error:', error);
      return [];
    }
  },
};

// Health check for Redis
export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
};