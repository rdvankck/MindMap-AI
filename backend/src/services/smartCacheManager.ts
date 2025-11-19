import { PrismaClient, ExecutionCache, NodeDependencyCache, WorkflowExecution } from '@prisma/client';
import { Redis } from 'ioredis';
import crypto from 'crypto';
import { logger } from '@/utils/logger';
import { redis } from '@/config/redis';
import { config } from '@/config';

export interface CacheKey {
  workflowId: string;
  nodeId: string;
  inputs: Record<string, any>;
  config: Record<string, any>;
  version: string;
}

export interface CacheEntry {
  key: string;
  value: any;
  metadata: {
    createdAt: Date;
    lastAccessed: Date;
    accessCount: number;
    size: number;
    tags: string[];
  };
  ttl: number;
}

export interface CacheStatistics {
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  cacheSize: number;
  memoryUsage: number;
  entryCount: number;
  expiredEntries: number;
  evictedEntries: number;
}

export interface OptimizationResult {
  before: CacheStatistics;
  after: CacheStatistics;
  improvements: string[];
  recommendations: string[];
  spaceFreed: number;
  performanceGain: number;
}

export class SmartCacheManager {
  private prisma: PrismaClient;
  private redis: Redis;
  private cacheStats: Map<string, { hits: number; misses: number }> = new Map();
  private readonly DEFAULT_CACHE_TTL = 3600; // 1 hour
  private readonly MAX_CACHE_SIZE = 10000;
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutes
  private readonly MEMORY_THRESHOLD = 0.8; // 80% of max memory

  constructor() {
    this.prisma = new PrismaClient();
    this.redis = redis;
    this.startCleanupInterval();
  }

  /**
   * Generate cache key based on node configuration and inputs
   */
  generateCacheKey(keyData: CacheKey): string {
    const keyString = JSON.stringify({
      workflowId: keyData.workflowId,
      nodeId: keyData.nodeId,
      inputs: this.normalizeInputs(keyData.inputs),
      config: keyData.config,
      version: keyData.version
    });
    
    return `smart-cache:${crypto.createHash('sha256').update(keyString).digest('hex')}`;
  }

  /**
   * Get cached result for a node execution
   */
  async get(keyData: CacheKey): Promise<any | null> {
    try {
      const cacheKey = this.generateCacheKey(keyData);
      
      // Try Redis first (hot cache)
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const entry = JSON.parse(cached) as CacheEntry;
        
        // Update access metadata
        entry.metadata.lastAccessed = new Date();
        entry.metadata.accessCount++;
        
        // Update Redis with new metadata
        await this.redis.setex(cacheKey, entry.ttl, JSON.stringify(entry));
        
        // Update statistics
        this.updateCacheStats(cacheKey, 'hit');
        
        logger.debug(`Cache hit for key: ${cacheKey}`);
        return entry.value;
      }

      // Try database (warm cache)
      const dbCache = await this.prisma.executionCache.findFirst({
        where: {
          workflowId: keyData.workflowId,
          cacheKey: cacheKey,
          expiresAt: {
            gt: new Date()
          }
        }
      });

      if (dbCache) {
        // Promote to Redis for faster access
        const entry: CacheEntry = {
          key: cacheKey,
          value: dbCache.outputs,
          metadata: {
            createdAt: dbCache.createdAt,
            lastAccessed: new Date(),
            accessCount: 1,
            size: JSON.stringify(dbCache.outputs).length,
            tags: ['promoted']
          },
          ttl: Math.floor((dbCache.expiresAt.getTime() - Date.now()) / 1000)
        };

        await this.redis.setex(cacheKey, entry.ttl, JSON.stringify(entry));
        
        // Update last accessed in database
        await this.prisma.executionCache.update({
          where: { id: dbCache.id },
          data: { accessedAt: new Date() }
        });

        this.updateCacheStats(cacheKey, 'hit');
        logger.debug(`Database cache hit for key: ${cacheKey}`);
        return dbCache.outputs;
      }

      this.updateCacheStats(cacheKey, 'miss');
      logger.debug(`Cache miss for key: ${cacheKey}`);
      return null;
    } catch (error) {
      logger.error('Error getting from cache:', error);
      this.updateCacheStats('unknown', 'miss');
      return null;
    }
  }

  /**
   * Store result in cache
   */
  async set(keyData: CacheKey, value: any, options: {
    ttl?: number;
    tags?: string[];
    priority?: 'low' | 'medium' | 'high';
  } = {}): Promise<boolean> {
    try {
      const cacheKey = this.generateCacheKey(keyData);
      const ttl = options.ttl || this.DEFAULT_CACHE_TTL;
      const tags = options.tags || [];
      
      const entry: CacheEntry = {
        key: cacheKey,
        value,
        metadata: {
          createdAt: new Date(),
          lastAccessed: new Date(),
          accessCount: 0,
          size: JSON.stringify(value).length,
          tags: ['manual', ...tags]
        },
        ttl
      };

      // Store in Redis with TTL
      await this.redis.setex(cacheKey, ttl, JSON.stringify(entry));

      // Also store in database for persistence
      const expiresAt = new Date(Date.now() + ttl * 1000);
      await this.prisma.executionCache.upsert({
        where: { cacheKey },
        update: {
          outputs: value,
          metadata: entry.metadata,
          expiresAt,
          accessedAt: new Date()
        },
        create: {
          cacheKey,
          workflowId: keyData.workflowId,
          nodeConfig: keyData.config,
          inputs: keyData.inputs,
          outputs: value,
          metadata: entry.metadata,
          expiresAt
        }
      });

      // Add to priority-based cache management if high priority
      if (options.priority === 'high') {
        await this.addToPriorityQueue(cacheKey, options.priority);
      }

      logger.debug(`Cached result for key: ${cacheKey}, size: ${entry.metadata.size} bytes`);
      return true;
    } catch (error) {
      logger.error('Error setting cache:', error);
      return false;
    }
  }

  /**
   * Invalidate cache entries for a specific node or workflow
   */
  async invalidate(pattern: {
    workflowId?: string;
    nodeId?: string;
    tags?: string[];
    keyPattern?: string;
  }): Promise<number> {
    try {
      let invalidatedCount = 0;
      const patterns: string[] = [];

      // Build Redis patterns
      if (pattern.workflowId && pattern.nodeId) {
        // Specific node in workflow
        patterns.push(`*${pattern.workflowId}*${pattern.nodeId}*`);
      } else if (pattern.workflowId) {
        // All nodes in workflow
        patterns.push(`*${pattern.workflowId}*`);
      } else if (pattern.keyPattern) {
        patterns.push(pattern.keyPattern);
      }

      // Invalidate from Redis
      for (const redisPattern of patterns) {
        const keys = await this.redis.keys(redisPattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          invalidatedCount += keys.length;
        }
      }

      // Invalidate from database
      const whereClause: any = {};
      if (pattern.workflowId) {
        whereClause.workflowId = pattern.workflowId;
      }

      const dbDeleted = await this.prisma.executionCache.deleteMany({ where: whereClause });
      invalidatedCount += dbDeleted.count;

      // Clear associated statistics
      for (const patternKey of patterns) {
        this.cacheStats.delete(patternKey);
      }

      logger.info(`Invalidated ${invalidatedCount} cache entries for pattern:`, pattern);
      return invalidatedCount;
    } catch (error) {
      logger.error('Error invalidating cache:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStatistics(): Promise<CacheStatistics> {
    try {
      // Get Redis info
      const redisInfo = await this.redis.info('memory');
      const redisMemory = this.parseRedisMemoryInfo(redisInfo);

      // Get database cache counts
      const dbCacheCount = await this.prisma.executionCache.count();
      const expiredDbCount = await this.prisma.executionCache.count({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      // Calculate hit/miss rates
      let totalHits = 0;
      let totalMisses = 0;

      for (const stats of this.cacheStats.values()) {
        totalHits += stats.hits;
        totalMisses += stats.misses;
      }

      const totalRequests = totalHits + totalMisses;
      const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
      const missRate = totalRequests > 0 ? (totalMisses / totalRequests) * 100 : 0;

      return {
        hitRate: Math.round(hitRate * 100) / 100,
        missRate: Math.round(missRate * 100) / 100,
        totalHits,
        totalMisses,
        cacheSize: dbCacheCount,
        memoryUsage: redisMemory.used_memory,
        entryCount: dbCacheCount,
        expiredEntries: expiredDbCount,
        evictedEntries: 0 // Would need to track evictions separately
      };
    } catch (error) {
      logger.error('Error getting cache statistics:', error);
      return {
        hitRate: 0,
        missRate: 0,
        totalHits: 0,
        totalMisses: 0,
        cacheSize: 0,
        memoryUsage: 0,
        entryCount: 0,
        expiredEntries: 0,
        evictedEntries: 0
      };
    }
  }

  /**
   * Optimize cache performance
   */
  async optimize(): Promise<OptimizationResult> {
    try {
      const beforeStats = await this.getStatistics();
      
      logger.info('Starting cache optimization...');
      
      const improvements: string[] = [];
      const recommendations: string[] = [];
      let spaceFreed = 0;

      // 1. Clean up expired entries
      const expiredDeleted = await this.cleanupExpiredEntries();
      if (expiredDeleted > 0) {
        improvements.push(`Removed ${expiredDeleted} expired cache entries`);
        spaceFreed += expiredDeleted;
      }

      // 2. Evict least recently used (LRU) entries if memory threshold exceeded
      if (beforeStats.memoryUsage > this.MEMORY_THRESHOLD * beforeStats.cacheSize) {
        const evictedCount = await this.evictLRUEntries(100); // Evict bottom 100
        if (evictedCount > 0) {
          improvements.push(`Evicted ${evictedCount} least recently used entries`);
        }
      }

      // 3. Promote frequently accessed entries to faster storage
      const promotedCount = await this.promoteHotEntries(50); // Promote top 50
      if (promotedCount > 0) {
        improvements.push(`Promoted ${promotedCount} frequently accessed entries`);
      }

      // 4. Compress large cache entries
      const compressedCount = await this.compressLargeEntries();
      if (compressedCount > 0) {
        improvements.push(`Compressed ${compressedCount} large cache entries`);
      }

      // 5. Generate recommendations
      if (beforeStats.hitRate < 50) {
        recommendations.push('Consider increasing cache TTL for frequently accessed data');
        recommendations.push('Review cache key generation for better hit rates');
      }

      if (beforeStats.memoryUsage > 0.9 * beforeStats.cacheSize) {
        recommendations.push('Consider increasing memory allocation for cache');
        recommendations.push('Implement more aggressive eviction policies');
      }

      if (beforeStats.expiredEntries > beforeStats.entryCount * 0.1) {
        recommendations.push('Reduce cache TTL to prevent stale data buildup');
      }

      const afterStats = await this.getStatistics();
      const performanceGain = afterStats.hitRate - beforeStats.hitRate;

      logger.info('Cache optimization completed', {
        improvements: improvements.length,
        recommendations: recommendations.length,
        spaceFreed,
        performanceGain
      });

      return {
        before: beforeStats,
        after: afterStats,
        improvements,
        recommendations,
        spaceFreed,
        performanceGain: Math.round(performanceGain * 100) / 100
      };
    } catch (error) {
      logger.error('Error during cache optimization:', error);
      throw new Error('Cache optimization failed');
    }
  }

  /**
   * Pre-warm cache with commonly used data
   */
  async preWarm(workflowId: string, nodeIds: string[]): Promise<void> {
    try {
      logger.info(`Pre-warming cache for workflow ${workflowId}, nodes: ${nodeIds.length}`);

      // Get recent successful executions for these nodes
      const recentExecutions = await this.prisma.workflowExecution.findMany({
        where: {
          workflowId,
          status: 'COMPLETED'
        },
        orderBy: { completedAt: 'desc' },
        take: 100,
        select: {
          nodeExecutions: true,
          inputs: true
        }
      });

      // Cache successful execution results
      for (const execution of recentExecutions) {
        const nodeExecs = execution.nodeExecutions as any[];
        
        for (const nodeExec of nodeExecs) {
          if (nodeIds.includes(nodeExec.nodeId) && nodeExec.status === 'COMPLETED') {
            await this.set({
              workflowId,
              nodeId: nodeExec.nodeId,
              inputs: nodeExec.inputs || {},
              config: nodeExec.config || {},
              version: '1.0'
            }, nodeExec.outputs, {
              ttl: 7200, // 2 hours
              tags: ['pre-warmed'],
              priority: 'medium'
            });
          }
        }
      }

      logger.info(`Cache pre-warming completed for workflow ${workflowId}`);
    } catch (error) {
      logger.error('Error during cache pre-warming:', error);
    }
  }

  /**
   * Cache warming based on usage patterns
   */
  async intelligentWarm(): Promise<void> {
    try {
      logger.info('Starting intelligent cache warming...');

      // Find most frequently accessed workflows
      const popularWorkflows = await this.prisma.workflowExecution.groupBy({
        by: ['workflowId'],
        where: {
          completedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        },
        _count: {
          id: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        },
        take: 10
      });

      for (const workflow of popularWorkflows) {
        // Get workflow nodes
        const workflowData = await this.prisma.workflow.findUnique({
          where: { id: workflow.workflowId },
          select: { nodes: true }
        });

        if (workflowData) {
          const nodes = workflowData.nodes as any[];
          const nodeIds = nodes.map(node => node.id);
          
          await this.preWarm(workflow.workflowId, nodeIds);
        }
      }

      logger.info('Intelligent cache warming completed');
    } catch (error) {
      logger.error('Error during intelligent cache warming:', error);
    }
  }

  // Private helper methods

  private normalizeInputs(inputs: Record<string, any>): Record<string, any> {
    // Sort object keys and normalize values for consistent hashing
    const normalized: Record<string, any> = {};
    
    const sortedKeys = Object.keys(inputs).sort();
    for (const key of sortedKeys) {
      const value = inputs[key];
      
      if (value === null || value === undefined) {
        normalized[key] = null;
      } else if (typeof value === 'object') {
        normalized[key] = JSON.parse(JSON.stringify(value));
      } else {
        normalized[key] = value;
      }
    }
    
    return normalized;
  }

  private updateCacheStats(key: string, type: 'hit' | 'miss'): void {
    if (!this.cacheStats.has(key)) {
      this.cacheStats.set(key, { hits: 0, misses: 0 });
    }
    
    const stats = this.cacheStats.get(key)!;
    if (type === 'hit') {
      stats.hits++;
    } else {
      stats.misses++;
    }
  }

  private parseRedisMemoryInfo(info: string): { used_memory: number } {
    const lines = info.split('\r\n');
    for (const line of lines) {
      if (line.startsWith('used_memory:')) {
        const value = line.split(':')[1];
        return { used_memory: parseInt(value, 10) };
      }
    }
    return { used_memory: 0 };
  }

  private async addToPriorityQueue(key: string, priority: 'low' | 'medium' | 'high'): Promise<void> {
    try {
      const score = priority === 'high' ? 100 : priority === 'medium' ? 50 : 10;
      await this.redis.zadd('cache-priority-queue', score, key);
    } catch (error) {
      logger.error('Error adding to priority queue:', error);
    }
  }

  private async cleanupExpiredEntries(): Promise<number> {
    try {
      const result = await this.prisma.executionCache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });
      
      return result.count;
    } catch (error) {
      logger.error('Error cleaning up expired entries:', error);
      return 0;
    }
  }

  private async evictLRUEntries(count: number): Promise<number> {
    try {
      // Get least recently used entries from Redis
      const keys = await this.redis.keys('smart-cache:*');
      
      // Get access times for each key
      const keyStats: Array<{ key: string; lastAccessed: number }> = [];
      
      for (const key of keys) {
        const cached = await this.redis.get(key);
        if (cached) {
          const entry = JSON.parse(cached) as CacheEntry;
          keyStats.push({
            key,
            lastAccessed: new Date(entry.metadata.lastAccessed).getTime()
          });
        }
      }

      // Sort by last accessed (oldest first)
      keyStats.sort((a, b) => a.lastAccessed - b.lastAccessed);

      // Evict oldest entries
      const toEvict = keyStats.slice(0, count);
      if (toEvict.length > 0) {
        const evictKeys = toEvict.map(stat => stat.key);
        await this.redis.del(...evictKeys);
        
        // Also remove from database
        await this.prisma.executionCache.deleteMany({
          where: {
            cacheKey: {
              in: evictKeys
            }
          }
        });
      }

      return toEvict.length;
    } catch (error) {
      logger.error('Error evicting LRU entries:', error);
      return 0;
    }
  }

  private async promoteHotEntries(count: number): Promise<number> {
    try {
      // Get most frequently accessed entries from database
      const hotEntries = await this.prisma.executionCache.findMany({
        orderBy: { accessedAt: 'desc' },
        take: count,
        select: { cacheKey: true, outputs: true, workflowId: true }
      });

      let promoted = 0;

      for (const entry of hotEntries) {
        // Check if not already in Redis
        const exists = await this.redis.exists(entry.cacheKey);
        if (!exists) {
          const cacheEntry: CacheEntry = {
            key: entry.cacheKey,
            value: entry.outputs,
            metadata: {
              createdAt: new Date(),
              lastAccessed: new Date(),
              accessCount: 1,
              size: JSON.stringify(entry.outputs).length,
              tags: ['promoted-hot']
            },
            ttl: this.DEFAULT_CACHE_TTL
          };

          await this.redis.setex(entry.cacheKey, cacheEntry.ttl, JSON.stringify(cacheEntry));
          promoted++;
        }
      }

      return promoted;
    } catch (error) {
      logger.error('Error promoting hot entries:', error);
      return 0;
    }
  }

  private async compressLargeEntries(): Promise<number> {
    try {
      // Get large cache entries (>10KB)
      const largeEntries = await this.prisma.executionCache.findMany({
        where: {
          metadata: {
            path: ['size'],
            gte: 10240 // 10KB
          }
        },
        take: 100
      });

      let compressed = 0;

      for (const entry of largeEntries) {
        try {
          // Compress the outputs
          const compressed = JSON.stringify(entry.outputs);
          const compressedBuffer = Buffer.from(compressed, 'utf8');
          
          // Update with compressed data
          await this.prisma.executionCache.update({
            where: { id: entry.id },
            data: {
              outputs: {
                _compressed: true,
                data: compressedBuffer.toString('base64'),
                originalSize: (entry.outputs as any).toString().length
              }
            }
          });
          
          compressed++;
        } catch (compressError) {
          logger.warn(`Failed to compress entry ${entry.id}:`, compressError);
        }
      }

      return compressed;
    } catch (error) {
      logger.error('Error compressing large entries:', error);
      return 0;
    }
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.CLEANUP_INTERVAL);
  }
}

export const smartCacheManager = new SmartCacheManager();