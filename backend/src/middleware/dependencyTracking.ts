import { Request, Response } from 'express';
import { dependencyGraphEngine } from '@/services/dependencyGraphEngine';
import { logger } from '@/utils/logger';
import { broadcastToConversation } from '@/websocket';

/**
 * Middleware to automatically track dependencies when workflows are updated
 */
export const dependencyTrackingMiddleware = async (
  req: Request,
  res: Response,
  next: Function
) => {
  // Store original request body for comparison
  const originalBody = { ...req.body };
  
  // Continue with the request
  res.on('finish', async () => {
    try {
      // Only track if the request was successful and modified workflow data
      if (res.statusCode >= 200 && res.statusCode < 300 && 
          (req.originalUrl.includes('/workflows/') && req.method !== 'GET')) {
        
        const workflowId = req.params.workflowId || req.params.id;
        if (workflowId) {
          await handleWorkflowChange(workflowId, originalBody, req.body, req.method);
        }
      }
    } catch (error) {
      logger.error('Error in dependency tracking middleware:', error);
    }
  });

  next();
};

/**
 * Handle workflow changes and trigger dependency invalidation
 */
async function handleWorkflowChange(
  workflowId: string,
  originalData: any,
  newData: any,
  method: string
): Promise<void> {
  try {
    let changeType: 'content' | 'config' | 'connection' | 'deletion';
    let changedNodes: string[] = [];

    switch (method) {
      case 'PUT':
      case 'PATCH':
        changeType = determineChangeType(originalData, newData);
        changedNodes = await findChangedNodes(originalData, newData);
        break;
      case 'DELETE':
        changeType = 'deletion';
        changedNodes = originalData.nodes?.map((node: any) => node.id) || [];
        break;
      default:
        return;
    }

    if (changedNodes.length === 0) return;

    // Invalidate dependencies for each changed node
    for (const nodeId of changedNodes) {
      try {
        await dependencyGraphEngine.invalidateDependents(
          workflowId,
          nodeId,
          changeType,
          `Workflow ${method.toLowerCase()} operation`,
          {
            method,
            originalData,
            newData,
            timestamp: new Date().toISOString()
          }
        );
      } catch (error) {
        logger.error(`Error invalidating dependencies for node ${nodeId}:`, error);
      }
    }

    logger.info(`Dependency tracking: Invalidated dependencies for ${changedNodes.length} nodes in workflow ${workflowId}`);
  } catch (error) {
    logger.error('Error handling workflow change:', error);
  }
}

/**
 * Determine the type of change based on request data
 */
function determineChangeType(originalData: any, newData: any): 'content' | 'config' | 'connection' {
  const originalNodes = originalData.nodes || [];
  const newNodes = newData.nodes || [];
  const originalEdges = originalData.edges || [];
  const newEdges = newData.edges || [];

  // Check for connection changes
  if (JSON.stringify(originalEdges) !== JSON.stringify(newEdges)) {
    return 'connection';
  }

  // Check for config changes
  const originalConfigs = originalNodes.map((node: any) => node.config || {});
  const newConfigs = newNodes.map((node: any) => node.config || {});
  if (JSON.stringify(originalConfigs) !== JSON.stringify(newConfigs)) {
    return 'config';
  }

  // Default to content changes
  return 'content';
}

/**
 * Find nodes that have changed
 */
async function findChangedNodes(originalData: any, newData: any): Promise<string[]> {
  const originalNodes = originalData.nodes || [];
  const newNodes = newData.nodes || [];
  const changedNodeIds: string[] = [];

  // Create a map of original nodes for quick lookup
  const originalNodeMap = new Map(originalNodes.map((node: any) => [node.id, node]));

  // Check for changes in existing nodes
  for (const newNode of newNodes) {
    const originalNode = originalNodeMap.get(newNode.id);
    if (originalNode) {
      // Compare node data
      if (JSON.stringify(originalNode) !== JSON.stringify(newNode)) {
        changedNodeIds.push(newNode.id);
      }
    } else {
      // New node added
      changedNodeIds.push(newNode.id);
    }
  }

  // Check for deleted nodes
  for (const originalNode of originalNodes) {
    if (!newNodes.find((node: any) => node.id === originalNode.id)) {
      changedNodeIds.push(originalNode.id);
    }
  }

  return changedNodeIds;
}

/**
 * Controller method to handle automatic dependency invalidation in conversation nodes
 */
export async function handleConversationNodeUpdate(
  conversationThreadId: string,
  nodeId: string,
  changeType: 'content' | 'config' | 'connection',
  reason: string
): Promise<void> {
  try {
    // Get the workflow ID from the conversation thread
    const conversation = await prisma?.conversationThread.findUnique({
      where: { id: conversationThreadId },
      select: { workflowId: true }
    });

    if (!conversation?.workflowId) {
      logger.warn(`No workflow found for conversation thread ${conversationThreadId}`);
      return;
    }

    // Invalidate dependencies for the node
    await dependencyGraphEngine.invalidateDependents(
      conversation.workflowId,
      nodeId,
      changeType,
      `Conversation update: ${reason}`,
      {
        conversationThreadId,
        source: 'conversation_system'
      }
    );

    logger.info(`Invalidated dependencies for conversation node ${nodeId} in workflow ${conversation.workflowId}`);
  } catch (error) {
    logger.error('Error handling conversation node update:', error);
  }
}

/**
 * Middleware to add dependency tracking context to requests
 */
export const addDependencyContext = async (
  req: Request,
  res: Response,
  next: Function
) => {
  try {
    // Add dependency tracking utilities to the request object
    req.dependencyTracking = {
      invalidateDependencies: async (workflowId: string, nodeId: string, changeType: string, reason: string) => {
        return await dependencyGraphEngine.invalidateDependents(workflowId, nodeId, changeType as any, reason);
      },
      detectChanges: async (workflowId: string, nodeId: string, currentData: any, previousData?: any) => {
        return await dependencyGraphEngine.detectNodeChanges(workflowId, nodeId, currentData, previousData);
      },
      getDependencyGraph: async (workflowId: string) => {
        return await dependencyGraphEngine.buildDependencyGraph(workflowId);
      }
    };
  } catch (error) {
    logger.error('Error adding dependency context:', error);
  }

  next();
};

/**
 * Enhanced TypeScript declaration for Express Request
 */
declare global {
  namespace Express {
    interface Request {
      dependencyTracking?: {
        invalidateDependencies: (workflowId: string, nodeId: string, changeType: string, reason: string) => Promise<any>;
        detectChanges: (workflowId: string, nodeId: string, currentData: any, previousData?: any) => Promise<any>;
        getDependencyGraph: (workflowId: string) => Promise<any>;
      };
    }
  }
}