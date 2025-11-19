import { CronJob } from 'node-cron';
import { PrismaClient, PlanStatus } from '@prisma/client';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import { recomputationEngine } from './recomputationEngine';
import { smartCacheManager } from './smartCacheManager';
import { dependencyGraphEngine } from './dependencyGraphEngine';

interface BackgroundServiceConfig {
  enableCleanup: boolean;
  enableOptimization: boolean;
  enablePreWarm: boolean;
  cleanupInterval: string;
  optimizationInterval: string;
  preWarmInterval: string;
  cleanupRetentionDays: number;
}

export class RecomputationBackgroundService {
  private prisma: PrismaClient;
  private config: BackgroundServiceConfig;
  private cleanupJob: CronJob | null = null;
  private optimizationJob: CronJob | null = null;
  private preWarmJob: CronJob | null = null;
  private isRunning: boolean = false;

  constructor(config?: Partial<BackgroundServiceConfig>) {
    this.prisma = new PrismaClient();
    
    this.config = {
      enableCleanup: true,
      enableOptimization: true,
      enablePreWarm: true,
      cleanupInterval: '0 2 * * *', // 2 AM daily
      optimizationInterval: '0 3 * * 0', // 3 AM on Sundays
      preWarmInterval: '0 1 * * *', // 1 AM daily
      cleanupRetentionDays: 7,
      ...config
    };
  }

  /**
   * Start the background service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Re-computation background service is already running');
      return;
    }

    logger.info('Starting re-computation background service...');

    try {
      // Start cleanup job
      if (this.config.enableCleanup) {
        this.cleanupJob = new CronJob(this.config.cleanupInterval, () => {
          this.performCleanup().catch(error => {
            logger.error('Error in scheduled cleanup:', error);
          });
        });
        this.cleanupJob.start();
        logger.info(`Cleanup job scheduled: ${this.config.cleanupInterval}`);
      }

      // Start optimization job
      if (this.config.enableOptimization) {
        this.optimizationJob = new CronJob(this.config.optimizationInterval, () => {
          this.performOptimization().catch(error => {
            logger.error('Error in scheduled optimization:', error);
          });
        });
        this.optimizationJob.start();
        logger.info(`Optimization job scheduled: ${this.config.optimizationInterval}`);
      }

      // Start pre-warm job
      if (this.config.enablePreWarm) {
        this.preWarmJob = new CronJob(this.config.preWarmInterval, () => {
          this.performPreWarm().catch(error => {
            logger.error('Error in scheduled pre-warm:', error);
          });
        });
        this.preWarmJob.start();
        logger.info(`Pre-warm job scheduled: ${this.config.preWarmInterval}`);
      }

      // Perform initial tasks
      await this.performInitialTasks();

      this.isRunning = true;
      logger.info('Re-computation background service started successfully');
    } catch (error) {
      logger.error('Failed to start re-computation background service:', error);
      throw error;
    }
  }

  /**
   * Stop the background service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Re-computation background service is not running');
      return;
    }

    logger.info('Stopping re-computation background service...');

    try {
      if (this.cleanupJob) {
        this.cleanupJob.stop();
        this.cleanupJob = null;
      }

      if (this.optimizationJob) {
        this.optimizationJob.stop();
        this.optimizationJob = null;
      }

      if (this.preWarmJob) {
        this.preWarmJob.stop();
        this.preWarmJob = null;
      }

      this.isRunning = false;
      logger.info('Re-computation background service stopped successfully');
    } catch (error) {
      logger.error('Error stopping re-computation background service:', error);
    }
  }

  /**
   * Check if service is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get service status and statistics
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    nextCleanup?: Date;
    nextOptimization?: Date;
    nextPreWarm?: Date;
    statistics: {
      totalPlans: number;
      activePlans: number;
      completedPlans: number;
      failedPlans: number;
      cacheHitRate: number;
      cacheSize: number;
    };
  }> {
    try {
      const statistics = await this.prisma.recomputationPlan.groupBy({
        by: ['status'],
        _count: {
          id: true
        }
      });

      const stats = {
        totalPlans: statistics.reduce((sum, stat) => sum + stat._count.id, 0),
        activePlans: statistics.find(s => s.status === PlanStatus.RUNNING)?._count.id || 0,
        completedPlans: statistics.find(s => s.status === PlanStatus.COMPLETED)?._count.id || 0,
        failedPlans: statistics.find(s => s.status === PlanStatus.FAILED)?._count.id || 0,
        cacheHitRate: 0,
        cacheSize: 0
      };

      // Get cache statistics
      try {
        const cacheStats = await smartCacheManager.getStatistics();
        stats.cacheHitRate = cacheStats.hitRate;
        stats.cacheSize = cacheStats.cacheSize;
      } catch (error) {
        logger.warn('Failed to get cache statistics:', error);
      }

      return {
        isRunning: this.isRunning,
        nextCleanup: this.cleanupJob?.nextDate()?.toDate(),
        nextOptimization: this.optimizationJob?.nextDate()?.toDate(),
        nextPreWarm: this.preWarmJob?.nextDate()?.toDate(),
        statistics: stats
      };
    } catch (error) {
      logger.error('Error getting service status:', error);
      return {
        isRunning: this.isRunning,
        statistics: {
          totalPlans: 0,
          activePlans: 0,
          completedPlans: 0,
          failedPlans: 0,
          cacheHitRate: 0,
          cacheSize: 0
        }
      };
    }
  }

  /**
   * Force run cleanup manually
   */
  async runCleanup(): Promise<void> {
    logger.info('Manually triggering cleanup...');
    await this.performCleanup();
  }

  /**
   * Force run optimization manually
   */
  async runOptimization(): Promise<void> {
    logger.info('Manually triggering optimization...');
    await this.performOptimization();
  }

  /**
   * Force run pre-warm manually
   */
  async runPreWarm(): Promise<void> {
    logger.info('Manually triggering pre-warm...');
    await this.performPreWarm();
  }

  // Private methods

  private async performInitialTasks(): Promise<void> {
    try {
      logger.info('Performing initial background tasks...');

      // Check for any stuck plans
      await this.checkStuckPlans();

      // Perform a quick cache cleanup
      await this.performQuickCacheCleanup();

      // Validate dependency caches
      await this.validateDependencyCaches();

      logger.info('Initial background tasks completed');
    } catch (error) {
      logger.error('Error in initial tasks:', error);
    }
  }

  private async performCleanup(): Promise<void> {
    try {
      logger.info('Starting scheduled cleanup...');

      const cutoffDate = new Date(Date.now() - this.config.cleanupRetentionDays * 24 * 60 * 60 * 1000);
      
      // Clean up old completed/failed/cancelled plans
      const deletedPlans = await this.prisma.recomputationPlan.deleteMany({
        where: {
          status: {
            in: [PlanStatus.COMPLETED, PlanStatus.FAILED, PlanStatus.CANCELLED]
          },
          completedAt: {
            lt: cutoffDate
          }
        }
      });

      // Clean up old execution logs
      const deletedLogs = await this.prisma.executionLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          }
        }
      });

      // Clean up old dependency invalidations
      const deletedInvalidations = await this.prisma.dependencyInvalidation.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          },
          status: {
            in: ['COMPLETED', 'FAILED']
          }
        }
      });

      // Perform cache optimization
      const optimizationResult = await smartCacheManager.optimize();

      logger.info('Scheduled cleanup completed', {
        deletedPlans: deletedPlans.count,
        deletedLogs: deletedLogs.count,
        deletedInvalidations: deletedInvalidations.count,
        cacheOptimizations: optimizationResult.improvements.length,
        spaceFreed: optimizationResult.spaceFreed
      });
    } catch (error) {
      logger.error('Error in scheduled cleanup:', error);
    }
  }

  private async performOptimization(): Promise<void> {
    try {
      logger.info('Starting scheduled optimization...');

      // Analyze system performance
      const queueStats = await recomputationEngine.getQueueStatistics();
      const cacheStats = await smartCacheManager.getStatistics();

      // Perform cache optimization
      const cacheOptimization = await smartCacheManager.optimize();

      // Generate optimization suggestions
      const suggestions = await this.generateOptimizationSuggestions(queueStats, cacheStats);

      // Store optimization suggestions in database
      if (suggestions.length > 0) {
        await this.storeOptimizationSuggestions(suggestions);
      }

      logger.info('Scheduled optimization completed', {
        cacheImprovements: cacheOptimization.improvements.length,
        performanceGain: cacheOptimization.performanceGain,
        suggestionsGenerated: suggestions.length
      });
    } catch (error) {
      logger.error('Error in scheduled optimization:', error);
    }
  }

  private async performPreWarm(): Promise<void> {
    try {
      logger.info('Starting scheduled pre-warm...');

      // Intelligent cache warming
      await smartCacheManager.intelligentWarm();

      // Pre-warm popular workflows
      const popularWorkflows = await this.getPopularWorkflows();
      
      for (const workflow of popularWorkflows) {
        await this.preWarmWorkflow(workflow.id, workflow.nodeIds);
      }

      logger.info('Scheduled pre-warm completed', {
        popularWorkflows: popularWorkflows.length
      });
    } catch (error) {
      logger.error('Error in scheduled pre-warm:', error);
    }
  }

  private async checkStuckPlans(): Promise<void> {
    try {
      const stuckThreshold = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      
      const stuckPlans = await this.prisma.recomputationPlan.findMany({
        where: {
          status: PlanStatus.RUNNING,
          startedAt: {
            lt: stuckThreshold
          }
        }
      });

      if (stuckPlans.length > 0) {
        logger.warn(`Found ${stuckPlans.length} potentially stuck re-computation plans`);
        
        for (const plan of stuckPlans) {
          // Mark as failed and create a retry plan
          await this.prisma.recomputationPlan.update({
            where: { id: plan.id },
            data: {
              status: PlanStatus.FAILED,
              completedAt: new Date(),
              errorMessage: 'Plan marked as failed due to timeout'
            }
          });

          logger.warn(`Marked stuck plan ${plan.id} as failed`);
        }
      }
    } catch (error) {
      logger.error('Error checking stuck plans:', error);
    }
  }

  private async performQuickCacheCleanup(): Promise<void> {
    try {
      // Clean up expired cache entries
      await smartCacheManager.cleanupExpiredEntries();
      
      logger.debug('Quick cache cleanup completed');
    } catch (error) {
      logger.error('Error in quick cache cleanup:', error);
    }
  }

  private async validateDependencyCaches(): Promise<void> {
    try {
      // Get all workflows with cached dependency graphs
      const cachedWorkflows = await this.prisma.dependencyGraphCache.findMany({
        where: {
          expiresAt: {
            gt: new Date()
          }
        }
      });

      let validCount = 0;
      let invalidCount = 0;

      for (const cache of cachedWorkflows) {
        try {
          // Validate the cached graph
          await dependencyGraphEngine.buildDependencyGraph(cache.workflowId);
          validCount++;
        } catch (error) {
          logger.warn(`Invalid dependency cache for workflow ${cache.workflowId}:`, error);
          invalidCount++;
          
          // Remove invalid cache
          await this.prisma.dependencyGraphCache.delete({
            where: { id: cache.id }
          });
        }
      }

      logger.info(`Dependency cache validation completed: ${validCount} valid, ${invalidCount} invalid`);
    } catch (error) {
      logger.error('Error validating dependency caches:', error);
    }
  }

  private async getPopularWorkflows(): Promise<Array<{ id: string; nodeIds: string[] }>> {
    try {
      const popularWorkflows = await this.prisma.workflowExecution.groupBy({
        by: ['workflowId'],
        where: {
          completedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          },
          status: 'COMPLETED'
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

      const result = [];
      
      for (const workflow of popularWorkflows) {
        const workflowData = await this.prisma.workflow.findUnique({
          where: { id: workflow.workflowId },
          select: { nodes: true }
        });

        if (workflowData) {
          const nodes = workflowData.nodes as any[];
          result.push({
            id: workflow.workflowId,
            nodeIds: nodes.map(node => node.id)
          });
        }
      }

      return result;
    } catch (error) {
      logger.error('Error getting popular workflows:', error);
      return [];
    }
  }

  private async preWarmWorkflow(workflowId: string, nodeIds: string[]): Promise<void> {
    try {
      await smartCacheManager.preWarm(workflowId, nodeIds);
    } catch (error) {
      logger.error(`Error pre-warming workflow ${workflowId}:`, error);
    }
  }

  private async generateOptimizationSuggestions(
    queueStats: any,
    cacheStats: any
  ): Promise<Array<any>> {
    const suggestions = [];

    // Queue-based suggestions
    if (queueStats.active > 5) {
      suggestions.push({
        type: 'PERFORMANCE',
        severity: 'MEDIUM',
        title: 'High queue concurrency',
        description: 'Consider increasing queue processing capacity',
        recommendations: ['Increase maxConcurrentPlans configuration', 'Add more worker processes']
      });
    }

    if (queueStats.failed > queueStats.completed * 0.1) {
      suggestions.push({
        type: 'RELIABILITY',
        severity: 'HIGH',
        title: 'High failure rate',
        description: 'Many re-computation plans are failing',
        recommendations: ['Review error logs', 'Check node configurations', 'Increase retry attempts']
      });
    }

    // Cache-based suggestions
    if (cacheStats.hitRate < 50) {
      suggestions.push({
        type: 'CACHING',
        severity: 'MEDIUM',
        title: 'Low cache hit rate',
        description: 'Cache effectiveness is below optimal',
        recommendations: ['Increase cache TTL', 'Review cache key generation', 'Pre-warm frequently used data']
      });
    }

    if (cacheStats.expiredEntries > cacheStats.entryCount * 0.2) {
      suggestions.push({
        type: 'CACHING',
        severity: 'LOW',
        title: 'High cache expiration rate',
        description: 'Many cache entries are expiring quickly',
        recommendations: ['Adjust cache TTL settings', 'Implement smarter expiration policies']
      });
    }

    return suggestions;
  }

  private async storeOptimizationSuggestions(suggestions: Array<any>): Promise<void> {
    try {
      // Group suggestions by workflow if applicable
      const workflowSuggestions = new Map<string, Array<any>>();

      for (const suggestion of suggestions) {
        // For now, store as general suggestions (could be extended to be workflow-specific)
        await this.prisma.optimizationSuggestion.create({
          data: {
            workflowId: 'system', // System-level suggestion
            type: suggestion.type,
            severity: suggestion.severity,
            title: suggestion.title,
            description: suggestion.description,
            recommendations: suggestion.recommendations,
            estimatedImpact: {
              potentialGain: 'Medium',
              affectedAreas: ['performance', 'reliability']
            },
            metadata: {
              generatedAt: new Date(),
              source: 'background-service'
            }
          }
        });
      }

      logger.info(`Stored ${suggestions.length} optimization suggestions`);
    } catch (error) {
      logger.error('Error storing optimization suggestions:', error);
    }
  }
}

export const recomputationBackgroundService = new RecomputationBackgroundService();