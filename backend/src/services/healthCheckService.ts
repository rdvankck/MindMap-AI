import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { prisma } from '@/config/database';
import { redis } from '@/config/redis';
import { llmService } from '@/services/llm/LLMService';

/**
 * Health Check Service
 * 
 * Monitors the health of various system components and provides
 * comprehensive health status information.
 */

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  lastCheck: Date;
  details?: any;
  error?: string;
}

export interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: HealthCheck[];
  uptime: number;
  version: string;
  timestamp: Date;
  memory: NodeJS.MemoryUsage;
  cpu: {
    usage: NodeJS.CpuUsage;
    loadAvg: number[];
  };
}

export class HealthCheckService extends EventEmitter {
  private checks: Map<string, HealthCheck> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private startTime = Date.now();
  private isShuttingDown = false;

  constructor() {
    super();
    this.setupDefaultChecks();
    this.startHealthMonitoring();
  }

  /**
   * Get current system health status
   */
  async getHealthStatus(): Promise<SystemHealth> {
    const healthChecks = Array.from(this.checks.values());
    const overallStatus = this.calculateOverallStatus(healthChecks);

    return {
      status: overallStatus,
      checks: healthChecks,
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date(),
      memory: process.memoryUsage(),
      cpu: {
        usage: process.cpuUsage(),
        loadAvg: require('os').loadavg(),
      },
    };
  }

  /**
   * Add a custom health check
   */
  addHealthCheck(
    name: string,
    checkFunction: () => Promise<HealthCheck>,
    interval: number = 30000
  ): void {
    if (this.intervals.has(name)) {
      clearInterval(this.intervals.get(name)!);
    }

    // Run check immediately
    this.runHealthCheck(name, checkFunction);

    // Set up recurring check
    const intervalId = setInterval(() => {
      this.runHealthCheck(name, checkFunction);
    }, interval);

    this.intervals.set(name, intervalId);
  }

  /**
   * Remove a health check
   */
  removeHealthCheck(name: string): void {
    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
    }
    this.checks.delete(name);
  }

  /**
   * Run a specific health check
   */
  private async runHealthCheck(
    name: string,
    checkFunction: () => Promise<HealthCheck>
  ): Promise<void> {
    if (this.isShuttingDown) return;

    try {
      const startTime = Date.now();
      const result = await checkFunction();
      const responseTime = Date.now() - startTime;

      const healthCheck: HealthCheck = {
        ...result,
        responseTime,
        lastCheck: new Date(),
      };

      this.checks.set(name, healthCheck);
      
      // Emit event for status changes
      this.emit('healthCheck', { name, status: healthCheck.status });
      
      if (healthCheck.status !== 'healthy') {
        logger.warn(`Health check failed: ${name}`, {
          status: healthCheck.status,
          error: healthCheck.error,
          responseTime,
        });
      }
    } catch (error) {
      const healthCheck: HealthCheck = {
        name,
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      this.checks.set(name, healthCheck);
      this.emit('healthCheck', { name, status: 'unhealthy', error });
      
      logger.error(`Health check error: ${name}`, { error });
    }
  }

  /**
   * Setup default health checks
   */
  private setupDefaultChecks(): void {
    // Database health check
    this.addHealthCheck(
      'database',
      this.checkDatabase.bind(this),
      30000
    );

    // Redis health check
    this.addHealthCheck(
      'redis',
      this.checkRedis.bind(this),
      15000
    );

    // LLM service health check
    this.addHealthCheck(
      'llm_service',
      this.checkLLMService.bind(this),
      60000
    );

    // Memory usage check
    this.addHealthCheck(
      'memory',
      this.checkMemory.bind(this),
      10000
    );

    // Disk space check
    this.addHealthCheck(
      'disk_space',
      this.checkDiskSpace.bind(this),
      60000
    );

    // External API checks
    this.addHealthCheck(
      'external_apis',
      this.checkExternalAPIs.bind(this),
      120000
    );
  }

  /**
   * Database health check
   */
  private async checkDatabase(): Promise<HealthCheck> {
    try {
      const startTime = Date.now();
      
      // Simple query to test database connectivity
      await prisma.$queryRaw`SELECT 1`;
      
      const responseTime = Date.now() - startTime;
      
      // Get database connection pool stats
      const poolStats = (prisma as any)._engine?.datasources?.[0]?.instance?.pool;
      
      return {
        name: 'database',
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        details: {
          responseTime,
          poolStats: poolStats ? {
            total: poolStats.totalCount,
            active: poolStats.activeCount,
            idle: poolStats.idleCount,
          } : null,
        },
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  /**
   * Redis health check
   */
  private async checkRedis(): Promise<HealthCheck> {
    try {
      const startTime = Date.now();
      
      // Test Redis connectivity
      const result = await redis.ping();
      
      const responseTime = Date.now() - startTime;
      
      if (result !== 'PONG') {
        throw new Error('Redis ping failed');
      }

      // Get Redis info
      const info = await redis.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const usedMemory = memoryMatch ? parseInt(memoryMatch[1]) : 0;

      return {
        name: 'redis',
        status: responseTime < 500 ? 'healthy' : 'degraded',
        details: {
          responseTime,
          usedMemory,
          usedMemoryMB: Math.round(usedMemory / 1024 / 1024),
        },
      };
    } catch (error) {
      return {
        name: 'redis',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Redis connection failed',
      };
    }
  }

  /**
   * LLM service health check
   */
  private async checkLLMService(): Promise<HealthCheck> {
    try {
      const startTime = Date.now();
      
      // Check if LLM service is initialized and responsive
      const providers = await llmService.getAvailableProviders();
      const models = await llmService.getAvailableModels();
      
      const responseTime = Date.now() - startTime;
      
      if (providers.length === 0) {
        return {
          name: 'llm_service',
          status: 'unhealthy',
          error: 'No LLM providers available',
          details: { providers: [] },
        };
      }

      return {
        name: 'llm_service',
        status: responseTime < 2000 ? 'healthy' : 'degraded',
        details: {
          responseTime,
          providers: providers.length,
          models: models.length,
          providerList: providers,
        },
      };
    } catch (error) {
      return {
        name: 'llm_service',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'LLM service check failed',
      };
    }
  }

  /**
   * Memory usage check
   */
  private async checkMemory(): Promise<HealthCheck> {
    const memUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();
    const systemMemoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;

    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (heapUsagePercent > 90 || systemMemoryUsage > 90) {
      status = 'unhealthy';
    } else if (heapUsagePercent > 75 || systemMemoryUsage > 75) {
      status = 'degraded';
    }

    return {
      name: 'memory',
      status,
      details: {
        heap: {
          used: heapUsedMB,
          total: heapTotalMB,
          usagePercent: Math.round(heapUsagePercent),
        },
        system: {
          usagePercent: Math.round(systemMemoryUsage),
          total: Math.round(totalMemory / 1024 / 1024),
          free: Math.round(freeMemory / 1024 / 1024),
        },
        rss: Math.round(memUsage.rss / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      },
    };
  }

  /**
   * Disk space check
   */
  private async checkDiskSpace(): Promise<HealthCheck> {
    try {
      const fs = require('fs');
      const stats = fs.statSync('.');
      
      // This is a simplified check - in production you'd want to check
      // actual disk usage more thoroughly
      const mockDiskUsage = {
        total: 100 * 1024 * 1024 * 1024, // 100GB
        used: 50 * 1024 * 1024 * 1024,   // 50GB
        free: 50 * 1024 * 1024 * 1024,   // 50GB
      };

      const usagePercent = (mockDiskUsage.used / mockDiskUsage.total) * 100;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (usagePercent > 90) {
        status = 'unhealthy';
      } else if (usagePercent > 80) {
        status = 'degraded';
      }

      return {
        name: 'disk_space',
        status,
        details: {
          usagePercent: Math.round(usagePercent),
          totalGB: Math.round(mockDiskUsage.total / 1024 / 1024 / 1024),
          usedGB: Math.round(mockDiskUsage.used / 1024 / 1024 / 1024),
          freeGB: Math.round(mockDiskUsage.free / 1024 / 1024 / 1024),
        },
      };
    } catch (error) {
      return {
        name: 'disk_space',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Disk space check failed',
      };
    }
  }

  /**
   * External API health checks
   */
  private async checkExternalAPIs(): Promise<HealthCheck> {
    const checks = [];
    
    // Check OpenAI API if configured
    if (process.env.OPENAI_API_KEY) {
      try {
        const axios = require('axios');
        const response = await axios.get('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          timeout: 5000,
        });
        
        checks.push({
          service: 'openai',
          status: 'healthy',
          responseTime: response.config.metadata?.responseTime || 0,
        });
      } catch (error) {
        checks.push({
          service: 'openai',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'OpenAI API check failed',
        });
      }
    }

    // Check Ollama if configured
    if (process.env.OLLAMA_BASE_URL) {
      try {
        const axios = require('axios');
        const response = await axios.get(`${process.env.OLLAMA_BASE_URL}/api/tags`, {
          timeout: 5000,
        });
        
        checks.push({
          service: 'ollama',
          status: 'healthy',
          responseTime: response.config.metadata?.responseTime || 0,
          models: response.data.models?.length || 0,
        });
      } catch (error) {
        checks.push({
          service: 'ollama',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Ollama API check failed',
        });
      }
    }

    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (unhealthyCount === checks.length && checks.length > 0) {
      status = 'unhealthy';
    } else if (unhealthyCount > 0) {
      status = 'degraded';
    }

    return {
      name: 'external_apis',
      status: checks.length === 0 ? 'healthy' : status,
      details: { checks },
    };
  }

  /**
   * Calculate overall system status
   */
  private calculateOverallStatus(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' {
    if (checks.length === 0) {
      return 'healthy';
    }

    const statuses = checks.map(c => c.status);
    const unhealthyCount = statuses.filter(s => s === 'unhealthy').length;
    const degradedCount = statuses.filter(s => s === 'degraded').length;

    if (unhealthyCount > 0) {
      return 'unhealthy';
    } else if (degradedCount > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    // Log health status every 5 minutes
    setInterval(async () => {
      if (this.isShuttingDown) return;
      
      const health = await this.getHealthStatus();
      
      if (health.status !== 'healthy') {
        logger.warn('System health degraded', {
          status: health.status,
          checks: health.checks.filter(c => c.status !== 'healthy'),
        });
      }
    }, 5 * 60 * 1000);

    // Setup graceful shutdown
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
  }

  /**
   * Graceful shutdown
   */
  private gracefulShutdown(): void {
    this.isShuttingDown = true;
    
    // Clear all intervals
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    
    this.intervals.clear();
    this.checks.clear();
    
    logger.info('Health check service shut down gracefully');
  }

  /**
   * Get readiness status (for Kubernetes readiness probe)
   */
  async getReadinessStatus(): Promise<{ ready: boolean; checks: string[] }> {
    const health = await this.getHealthStatus();
    const criticalChecks = ['database', 'redis'];
    
    const failedChecks = criticalChecks.filter(checkName => {
      const check = health.checks.find(c => c.name === checkName);
      return !check || check.status === 'unhealthy';
    });

    return {
      ready: failedChecks.length === 0,
      checks: failedChecks,
    };
  }

  /**
   * Get liveness status (for Kubernetes liveness probe)
   */
  async getLivenessStatus(): Promise<{ alive: boolean }> {
    // Simple liveness check - is the process responding?
    return { alive: !this.isShuttingDown };
  }
}

// Singleton instance
export const healthCheckService = new HealthCheckService();