import { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient, PlanPriority, PlanStatus } from '@prisma/client';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import { recomputationEngine } from '@/services/recomputationEngine';
import { dependencyGraphEngine } from '@/services/dependencyGraphEngine';

const prisma = new PrismaClient();

// Validation schemas
const createRecomputationSchema = z.object({
  workflowId: z.string().uuid(),
  invalidationEventId: z.string().uuid().optional(),
  nodeId: z.string().uuid().optional(),
  changeType: z.enum(['CONTENT', 'CONFIG', 'CONNECTION', 'DELETION']).optional(),
  reason: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  enableParallelExecution: z.boolean().optional(),
  maxBatchSize: z.number().int().min(1).max(100).optional(),
  metadata: z.record(z.any()).optional()
});

const getPlansSchema = z.object({
  workflowId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

const batchRecomputeSchema = z.object({
  workflowId: z.string().uuid(),
  nodeIds: z.array(z.string().uuid()).min(1).max(50),
  reason: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  enableParallelExecution: z.boolean().optional()
});

export class RecomputationController {
  /**
   * Create and start a re-computation plan
   */
  async createRecomputation(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const validatedData = createRecomputationSchema.parse(req.body);
      
      // Verify user has access to the workflow
      const workflow = await prisma.workflow.findFirst({
        where: {
          id: validatedData.workflowId,
          OR: [
            { userId },
            { isPublic: true }
          ]
        }
      });

      if (!workflow) {
        res.status(404).json({ error: 'Workflow not found or access denied' });
        return;
      }

      let invalidationEventId = validatedData.invalidationEventId;

      // Create invalidation event if not provided
      if (!invalidationEventId && validatedData.nodeId) {
        const invalidationEvent = await dependencyGraphEngine.invalidateDependents(
          validatedData.workflowId,
          validatedData.nodeId,
          validatedData.changeType?.toLowerCase() as any || 'content',
          validatedData.reason || 'Manual re-computation trigger'
        );

        // Save to database
        const dbInvalidation = await prisma.dependencyInvalidation.create({
          data: {
            workflowId: invalidationEvent.workflowId,
            nodeId: invalidationEvent.nodeId,
            changeType: invalidationEvent.changeType as any,
            reason: invalidationEvent.reason,
            affectedNodes: invalidationEvent.affectedNodes,
            cascadeNodes: invalidationEvent.cascadeNodes,
            metadata: invalidationEvent.metadata
          }
        });

        invalidationEventId = dbInvalidation.id;
      }

      if (!invalidationEventId) {
        res.status(400).json({ error: 'Either invalidationEventId or nodeId must be provided' });
        return;
      }

      // Create re-computation plan
      const plan = await recomputationEngine.createRecomputation(
        validatedData.workflowId,
        invalidationEventId,
        {
          priority: validatedData.priority as PlanPriority,
          enableParallelExecution: validatedData.enableParallelExecution,
          maxBatchSize: validatedData.maxBatchSize,
          userId,
          metadata: validatedData.metadata
        }
      );

      logger.info(`Re-computation plan created: ${plan.id} for workflow ${validatedData.workflowId}`);

      res.status(201).json({
        success: true,
        data: {
          plan: {
            id: plan.id,
            workflowId: plan.workflowId,
            rootCauseNodeId: plan.rootCauseNodeId,
            status: plan.status,
            priority: plan.priority,
            estimatedCost: plan.estimatedCost,
            createdAt: plan.createdAt,
            executionOrder: plan.executionOrder,
            parallelGroups: plan.parallelGroups
          }
        }
      });
    } catch (error) {
      logger.error('Error creating re-computation:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
      } else {
        res.status(500).json({ 
          error: 'Failed to create re-computation plan',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Get re-computation plans with filtering and pagination
   */
  async getPlans(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const validatedData = getPlansSchema.parse(req.query);
      
      // Build where clause
      const whereClause: any = {};
      
      if (validatedData.workflowId) {
        whereClause.workflowId = validatedData.workflowId;
      }
      
      if (validatedData.status) {
        whereClause.status = validatedData.status;
      }
      
      if (validatedData.priority) {
        whereClause.priority = validatedData.priority;
      }

      // Only return plans for workflows user has access to
      whereClause.workflow = {
        OR: [
          { userId },
          { isPublic: true }
        ]
      };

      // Get total count
      const total = await prisma.recomputationPlan.count({ where: whereClause });

      // Get plans with pagination
      const plans = await prisma.recomputationPlan.findMany({
        where: whereClause,
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
              userId: true,
              isPublic: true
            }
          },
          invalidationEvent: {
            select: {
              id: true,
              nodeId: true,
              changeType: true,
              reason: true,
              createdAt: true
            }
          },
          executions: {
            select: {
              id: true,
              nodeId: true,
              status: true,
              executionTime: true,
              startedAt: true,
              completedAt: true
            }
          }
        },
        orderBy: {
          [validatedData.sortBy]: validatedData.sortOrder
        },
        skip: (validatedData.page - 1) * validatedData.limit,
        take: validatedData.limit
      });

      // Get active progress for running plans
      const plansWithProgress = await Promise.all(
        plans.map(async (plan) => {
          let progress = null;
          
          if (plan.status === PlanStatus.RUNNING) {
            progress = await recomputationEngine.getPlanStatus(plan.id);
          }

          return {
            ...plan,
            executions: plan.executions.length,
            completedExecutions: plan.executions.filter(e => e.status === 'COMPLETED').length,
            failedExecutions: plan.executions.filter(e => e.status === 'FAILED').length,
            progress
          };
        })
      );

      res.json({
        success: true,
        data: {
          plans: plansWithProgress,
          pagination: {
            page: validatedData.page,
            limit: validatedData.limit,
            total,
            totalPages: Math.ceil(total / validatedData.limit)
          }
        }
      });
    } catch (error) {
      logger.error('Error getting re-computation plans:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
      } else {
        res.status(500).json({ 
          error: 'Failed to get re-computation plans',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Get specific re-computation plan details
   */
  async getPlan(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { planId } = req.params;

      const plan = await prisma.recomputationPlan.findFirst({
        where: {
          id: planId,
          workflow: {
            OR: [
              { userId },
              { isPublic: true }
            ]
          }
        },
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
              nodes: true,
              edges: true,
              userId: true,
              isPublic: true
            }
          },
          invalidationEvent: true,
          executions: {
            include: {
              _count: {
                select: {
                  logs: true
                }
              }
            }
          }
        }
      });

      if (!plan) {
        res.status(404).json({ error: 'Re-computation plan not found' });
        return;
      }

      // Get current progress if running
      let progress = null;
      if (plan.status === PlanStatus.RUNNING) {
        progress = await recomputationEngine.getPlanStatus(plan.id);
      }

      // Calculate statistics
      const statistics = {
        totalNodes: (plan.executionOrder as string[]).length,
        totalExecutions: plan.executions.length,
        completedExecutions: plan.executions.filter(e => e.status === 'COMPLETED').length,
        failedExecutions: plan.executions.filter(e => e.status === 'FAILED').length,
        runningExecutions: plan.executions.filter(e => e.status === 'RUNNING').length,
        pendingExecutions: plan.executions.filter(e => e.status === 'PENDING').length,
        totalExecutionTime: plan.executions.reduce((sum, e) => sum + (e.executionTime || 0), 0),
        averageExecutionTime: plan.executions.length > 0 
          ? plan.executions.reduce((sum, e) => sum + (e.executionTime || 0), 0) / plan.executions.length 
          : 0,
        totalTokenUsage: plan.executions.reduce((sum, e) => sum + (e.tokenCount || 0), 0)
      };

      res.json({
        success: true,
        data: {
          plan,
          progress,
          statistics
        }
      });
    } catch (error) {
      logger.error('Error getting re-computation plan:', error);
      res.status(500).json({ 
        error: 'Failed to get re-computation plan',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Cancel re-computation plan
   */
  async cancelPlan(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { planId } = req.params;

      // Verify user has access to the plan
      const plan = await prisma.recomputationPlan.findFirst({
        where: {
          id: planId,
          workflow: {
            OR: [
              { userId },
              { isPublic: true }
            ]
          }
        }
      });

      if (!plan) {
        res.status(404).json({ error: 'Re-computation plan not found' });
        return;
      }

      // Only allow cancellation of pending or running plans
      if (!['PENDING', 'RUNNING'].includes(plan.status)) {
        res.status(400).json({ 
          error: 'Plan cannot be cancelled',
          message: 'Only pending or running plans can be cancelled'
        });
        return;
      }

      // Cancel the plan
      const cancelled = await recomputationEngine.cancelPlan(planId, userId);

      if (cancelled) {
        logger.info(`Re-computation plan cancelled: ${planId} by user ${userId}`);
        res.json({
          success: true,
          message: 'Re-computation plan cancelled successfully'
        });
      } else {
        res.status(500).json({ error: 'Failed to cancel re-computation plan' });
      }
    } catch (error) {
      logger.error('Error cancelling re-computation plan:', error);
      res.status(500).json({ 
        error: 'Failed to cancel re-computation plan',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Pause re-computation plan
   */
  async pausePlan(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { planId } = req.params;

      // Verify user has access to the plan
      const plan = await prisma.recomputationPlan.findFirst({
        where: {
          id: planId,
          workflow: {
            OR: [
              { userId },
              { isPublic: true }
            ]
          }
        }
      });

      if (!plan) {
        res.status(404).json({ error: 'Re-computation plan not found' });
        return;
      }

      // Only allow pausing of running plans
      if (plan.status !== PlanStatus.RUNNING) {
        res.status(400).json({ 
          error: 'Plan cannot be paused',
          message: 'Only running plans can be paused'
        });
        return;
      }

      // Pause the plan
      const paused = await recomputationEngine.pausePlan(planId);

      if (paused) {
        logger.info(`Re-computation plan paused: ${planId} by user ${userId}`);
        res.json({
          success: true,
          message: 'Re-computation plan paused successfully'
        });
      } else {
        res.status(500).json({ error: 'Failed to pause re-computation plan' });
      }
    } catch (error) {
      logger.error('Error pausing re-computation plan:', error);
      res.status(500).json({ 
        error: 'Failed to pause re-computation plan',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Resume paused re-computation plan
   */
  async resumePlan(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { planId } = req.params;

      // Verify user has access to the plan
      const plan = await prisma.recomputationPlan.findFirst({
        where: {
          id: planId,
          workflow: {
            OR: [
              { userId },
              { isPublic: true }
            ]
          }
        }
      });

      if (!plan) {
        res.status(404).json({ error: 'Re-computation plan not found' });
        return;
      }

      // Only allow resuming of paused plans
      if (plan.status !== PlanStatus.PAUSED) {
        res.status(400).json({ 
          error: 'Plan cannot be resumed',
          message: 'Only paused plans can be resumed'
        });
        return;
      }

      // Resume the plan
      const resumed = await recomputationEngine.resumePlan(planId);

      if (resumed) {
        logger.info(`Re-computation plan resumed: ${planId} by user ${userId}`);
        res.json({
          success: true,
          message: 'Re-computation plan resumed successfully'
        });
      } else {
        res.status(500).json({ error: 'Failed to resume re-computation plan' });
      }
    } catch (error) {
      logger.error('Error resuming re-computation plan:', error);
      res.status(500).json({ 
        error: 'Failed to resume re-computation plan',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get real-time progress for a plan
   */
  async getPlanProgress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { planId } = req.params;

      // Verify user has access to the plan
      const plan = await prisma.recomputationPlan.findFirst({
        where: {
          id: planId,
          workflow: {
            OR: [
              { userId },
              { isPublic: true }
            ]
          }
        }
      });

      if (!plan) {
        res.status(404).json({ error: 'Re-computation plan not found' });
        return;
      }

      // Get current progress
      const progress = await recomputationEngine.getPlanStatus(planId);

      res.json({
        success: true,
        data: {
          planId,
          progress,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error getting re-computation plan progress:', error);
      res.status(500).json({ 
        error: 'Failed to get re-computation plan progress',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Batch re-compute multiple nodes
   */
  async batchRecompute(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const validatedData = batchRecomputeSchema.parse(req.body);
      
      // Verify user has access to the workflow
      const workflow = await prisma.workflow.findFirst({
        where: {
          id: validatedData.workflowId,
          OR: [
            { userId },
            { isPublic: true }
          ]
        }
      });

      if (!workflow) {
        res.status(404).json({ error: 'Workflow not found or access denied' });
        return;
      }

      const results = [];
      
      // Create invalidation events and re-computation plans for each node
      for (const nodeId of validatedData.nodeIds) {
        try {
          const invalidationEvent = await dependencyGraphEngine.invalidateDependents(
            validatedData.workflowId,
            nodeId,
            'content',
            validatedData.reason || `Batch re-computation for node ${nodeId}`
          );

          const dbInvalidation = await prisma.dependencyInvalidation.create({
            data: {
              workflowId: invalidationEvent.workflowId,
              nodeId: invalidationEvent.nodeId,
              changeType: invalidationEvent.changeType as any,
              reason: invalidationEvent.reason,
              affectedNodes: invalidationEvent.affectedNodes,
              cascadeNodes: invalidationEvent.cascadeNodes,
              metadata: {
                ...invalidationEvent.metadata,
                batchRecomputation: true,
                batchId: req.body.batchId || `batch-${Date.now()}`
              }
            }
          });

          const plan = await recomputationEngine.createRecomputation(
            validatedData.workflowId,
            dbInvalidation.id,
            {
              priority: validatedData.priority as PlanPriority,
              enableParallelExecution: validatedData.enableParallelExecution,
              userId
            }
          );

          results.push({
            nodeId,
            planId: plan.id,
            status: 'created',
            affectedNodes: invalidationEvent.cascadeNodes.length + 1
          });
        } catch (error) {
          results.push({
            nodeId,
            planId: null,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const successful = results.filter(r => r.status === 'created').length;
      
      logger.info(`Batch re-computation created: ${successful}/${validatedData.nodeIds.length} plans for workflow ${validatedData.workflowId}`);

      res.status(201).json({
        success: true,
        data: {
          workflowId: validatedData.workflowId,
          totalNodes: validatedData.nodeIds.length,
          successfulPlans: successful,
          failedPlans: validatedData.nodeIds.length - successful,
          results
        }
      });
    } catch (error) {
      logger.error('Error in batch re-computation:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
      } else {
        res.status(500).json({ 
          error: 'Failed to create batch re-computation',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStatistics(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const statistics = await recomputationEngine.getQueueStatistics();

      res.json({
        success: true,
        data: {
          queue: statistics,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error getting queue statistics:', error);
      res.status(500).json({ 
        error: 'Failed to get queue statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Retry failed plan
   */
  async retryPlan(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { planId } = req.params;

      // Verify user has access to the plan
      const plan = await prisma.recomputationPlan.findFirst({
        where: {
          id: planId,
          workflow: {
            OR: [
              { userId },
              { isPublic: true }
            ]
          }
        }
      });

      if (!plan) {
        res.status(404).json({ error: 'Re-computation plan not found' });
        return;
      }

      // Only allow retrying failed plans
      if (plan.status !== PlanStatus.FAILED) {
        res.status(400).json({ 
          error: 'Plan cannot be retried',
          message: 'Only failed plans can be retried'
        });
        return;
      }

      // Reset plan status to pending
      await prisma.recomputationPlan.update({
        where: { id: planId },
        data: {
          status: PlanStatus.PENDING,
          startedAt: null,
          completedAt: null,
          errorMessage: null
        }
      });

      // Re-queue the plan
      const resumed = await recomputationEngine.resumePlan(planId);

      if (resumed) {
        logger.info(`Re-computation plan retried: ${planId} by user ${userId}`);
        res.json({
          success: true,
          message: 'Re-computation plan queued for retry'
        });
      } else {
        res.status(500).json({ error: 'Failed to retry re-computation plan' });
      }
    } catch (error) {
      logger.error('Error retrying re-computation plan:', error);
      res.status(500).json({ 
        error: 'Failed to retry re-computation plan',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete old/completed plans
   */
  async cleanupPlans(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { olderThan = 7 } = req.query;
      const daysOld = parseInt(olderThan as string, 10);
      
      if (isNaN(daysOld) || daysOld < 1) {
        res.status(400).json({ error: 'Invalid olderThan parameter' });
        return;
      }

      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      
      // Delete old plans for workflows user has access to
      const deletedPlans = await prisma.recomputationPlan.deleteMany({
        where: {
          status: {
            in: [PlanStatus.COMPLETED, PlanStatus.FAILED, PlanStatus.CANCELLED]
          },
          completedAt: {
            lt: cutoffDate
          },
          workflow: {
            OR: [
              { userId },
              { isPublic: true }
            ]
          }
        }
      });

      logger.info(`Cleaned up ${deletedPlans.count} old re-computation plans for user ${userId}`);

      res.json({
        success: true,
        data: {
          deletedCount: deletedPlans.count,
          cutoffDate: cutoffDate.toISOString(),
          daysOld
        }
      });
    } catch (error) {
      logger.error('Error cleaning up plans:', error);
      res.status(500).json({ 
        error: 'Failed to cleanup plans',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const recomputationController = new RecomputationController();