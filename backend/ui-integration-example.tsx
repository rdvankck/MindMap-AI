import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface RecomputationPlan {
  id: string;
  workflowId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PAUSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  progress?: {
    totalNodes: number;
    completedNodes: number;
    failedNodes: number;
    runningNodes: number;
    pendingNodes: number;
  };
  executionOrder: string[];
  parallelGroups: string[][];
  estimatedCost: {
    nodes: number;
    tokens: number;
    timeMs: number;
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

interface RecomputationProgress {
  planId: string;
  status: string;
  progress: {
    totalNodes: number;
    completedNodes: number;
    failedNodes: number;
    runningNodes: number;
    pendingNodes: number;
  };
  currentGroup: {
    index: number;
    total: number;
    nodes: string[];
  };
  executionTime: number;
  errors: Array<{
    nodeId: string;
    error: string;
    timestamp: Date;
  }>;
  estimatedTimeRemaining: number;
}

interface RecomputationControlsProps {
  plan: RecomputationPlan;
  onPlanUpdate: (plan: RecomputationPlan) => void;
  authToken: string;
}

const RecomputationControls: React.FC<RecomputationControlsProps> = ({ 
  plan, 
  onPlanUpdate, 
  authToken 
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [progress, setProgress] = useState<RecomputationProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io('/recomputation', {
      auth: { token: authToken }
    });

    newSocket.on('connect', () => {
      console.log('Connected to re-computation WebSocket');
      newSocket.emit('join-plan', plan.id);
    });

    newSocket.on('progress-update', (data: any) => {
      setProgress(data.progress);
    });

    newSocket.on('plan-completed', (data: any) => {
      onPlanUpdate({
        ...plan,
        status: 'COMPLETED',
        completedAt: data.timestamp
      });
    });

    newSocket.on('plan-failed', (data: any) => {
      onPlanUpdate({
        ...plan,
        status: 'FAILED',
        completedAt: data.timestamp,
        errorMessage: data.error
      });
    });

    newSocket.on('plan-paused', () => {
      onPlanUpdate({ ...plan, status: 'PAUSED' });
    });

    newSocket.on('plan-resumed', () => {
      onPlanUpdate({ ...plan, status: 'RUNNING' });
    });

    newSocket.on('plan-cancelled', () => {
      onPlanUpdate({ ...plan, status: 'CANCELLED', completedAt: new Date().toISOString() });
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('leave-plan', plan.id);
      newSocket.disconnect();
    };
  }, [plan.id, authToken, onPlanUpdate]);

  const handleControl = useCallback(async (action: 'pause' | 'resume' | 'cancel' | 'retry') => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/recomputation/plans/${plan.id}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} plan`);
      }

      const result = await response.json();
      console.log(`Plan ${action} successful:`, result.message);
    } catch (error) {
      console.error(`Error ${action}ing plan:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [plan.id, authToken]);

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getProgressPercentage = (): number => {
    if (!progress) return 0;
    const { completedNodes, failedNodes, totalNodes } = progress.progress;
    return Math.round(((completedNodes + failedNodes) / totalNodes) * 100);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'COMPLETED': return 'text-green-600';
      case 'FAILED': return 'text-red-600';
      case 'RUNNING': return 'text-blue-600';
      case 'PAUSED': return 'text-yellow-600';
      case 'CANCELLED': return 'text-gray-600';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold">Re-computation Plan</h3>
          <p className="text-sm text-gray-600">ID: {plan.id}</p>
        </div>
        <div className="text-right">
          <span className={`font-medium ${getStatusColor(plan.status)}`}>
            {plan.status}
          </span>
          {plan.priority !== 'MEDIUM' && (
            <span className={`ml-2 text-xs px-2 py-1 rounded ${
              plan.priority === 'CRITICAL' ? 'bg-red-100 text-red-800' :
              plan.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
              plan.priority === 'LOW' ? 'bg-blue-100 text-blue-800' : ''
            }`}>
              {plan.priority}
            </span>
          )}
        </div>
      </div>

      {/* Progress Section */}
      {plan.status === 'RUNNING' && progress && (
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-gray-600">
              {progress.progress.completedNodes + progress.progress.failedNodes} / {progress.progress.totalNodes} nodes
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
          
          {progress.currentGroup && (
            <div className="text-sm text-gray-600 mb-2">
              <p>Group {progress.currentGroup.index + 1} of {progress.currentGroup.total}</p>
              <p>Nodes: {progress.currentGroup.nodes.join(', ')}</p>
            </div>
          )}

          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Completed:</span>
              <span className="ml-2 font-medium text-green-600">{progress.progress.completedNodes}</span>
            </div>
            <div>
              <span className="text-gray-600">Running:</span>
              <span className="ml-2 font-medium text-blue-600">{progress.progress.runningNodes}</span>
            </div>
            <div>
              <span className="text-gray-600">Failed:</span>
              <span className="ml-2 font-medium text-red-600">{progress.progress.failedNodes}</span>
            </div>
            <div>
              <span className="text-gray-600">Time:</span>
              <span className="ml-2 font-medium">{formatTime(progress.executionTime)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Errors Section */}
      {progress && progress.errors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 rounded-lg">
          <h4 className="text-sm font-medium text-red-800 mb-2">Errors ({progress.errors.length})</h4>
          <div className="space-y-2">
            {progress.errors.slice(0, 3).map((error, index) => (
              <div key={index} className="text-sm">
                <span className="font-medium text-red-700">{error.nodeId}:</span>
                <span className="text-red-600 ml-2">{error.error}</span>
              </div>
            ))}
            {progress.errors.length > 3 && (
              <p className="text-sm text-red-600">
                ... and {progress.errors.length - 3} more errors
              </p>
            )}
          </div>
        </div>
      )}

      {/* Cost Estimation */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-800 mb-2">Estimated Cost</h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Nodes:</span>
            <span className="ml-2 font-medium">{plan.estimatedCost.nodes}</span>
          </div>
          <div>
            <span className="text-gray-600">Tokens:</span>
            <span className="ml-2 font-medium">{plan.estimatedCost.tokens.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-600">Time:</span>
            <span className="ml-2 font-medium">{formatTime(plan.estimatedCost.timeMs)}</span>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex space-x-2">
        {plan.status === 'RUNNING' && (
          <>
            <button
              onClick={() => handleControl('pause')}
              disabled={isLoading}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : 'Pause'}
            </button>
            <button
              onClick={() => handleControl('cancel')}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : 'Cancel'}
            </button>
          </>
        )}
        
        {plan.status === 'PAUSED' && (
          <>
            <button
              onClick={() => handleControl('resume')}
              disabled={isLoading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : 'Resume'}
            </button>
            <button
              onClick={() => handleControl('cancel')}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : 'Cancel'}
            </button>
          </>
        )}
        
        {plan.status === 'FAILED' && (
          <button
            onClick={() => handleControl('retry')}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Retry'}
          </button>
        )}
      </div>

      {/* Metadata */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          <p>Created: {new Date(plan.createdAt).toLocaleString()}</p>
          {plan.startedAt && <p>Started: {new Date(plan.startedAt).toLocaleString()}</p>}
          {plan.completedAt && <p>Completed: {new Date(plan.completedAt).toLocaleString()}</p>}
        </div>
      </div>
    </div>
  );
};

// Example usage in a workflow component
const WorkflowRecomputationPanel: React.FC<{ workflowId: string; authToken: string }> = ({ 
  workflowId, 
  authToken 
}) => {
  const [plans, setPlans] = useState<RecomputationPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPlans = useCallback(async () => {
    try {
      const response = await fetch(`/api/recomputation/plans?workflowId=${workflowId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPlans(data.data.plans);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  }, [workflowId, authToken]);

  useEffect(() => {
    fetchPlans();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchPlans, 5000);
    return () => clearInterval(interval);
  }, [fetchPlans]);

  const handleCreateRecomputation = useCallback(async (nodeId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/recomputation/plans', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          workflowId,
          nodeId,
          reason: 'Manual re-computation trigger',
          priority: 'MEDIUM'
        })
      });

      if (response.ok) {
        await fetchPlans();
      }
    } catch (error) {
      console.error('Error creating re-computation plan:', error);
    } finally {
      setIsLoading(false);
    }
  }, [workflowId, authToken, fetchPlans]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Re-computation Plans</h2>
        <button
          onClick={() => handleCreateRecomputation('all-nodes')}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Creating...' : 'Re-compute All'}
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">No re-computation plans found</p>
          <button
            onClick={() => handleCreateRecomputation('all-nodes')}
            disabled={isLoading}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Create First Plan
          </button>
        </div>
      ) : (
        plans.map(plan => (
          <RecomputationControls
            key={plan.id}
            plan={plan}
            onPlanUpdate={fetchPlans}
            authToken={authToken}
          />
        ))
      )}
    </div>
  );
};

export default RecomputationControls;
export { WorkflowRecomputationPanel };