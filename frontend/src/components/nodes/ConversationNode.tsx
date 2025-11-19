import React, { memo, useCallback, useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  GitBranch, 
  Plus, 
  Eye, 
  Users, 
  Clock,
  Activity,
  ChevronRight,
  ChevronDown,
  Zap
} from 'lucide-react';
import { Node as FlowNode, NodeStatus } from '@/shared';
import { useFlowStore } from '@/store/flowStore';
import { useConversationStore } from '@/store/conversationStore';
import { useConversationApi } from '@/services';
import { cn } from '@/utils/cn';

interface ConversationNodeData {
  label: string;
  threadId?: string;
  nodeId: string;
  status: NodeStatus;
  error?: string;
  result?: any;
  conversationData?: {
    messageCount: number;
    branchCount: number;
    lastActivity: Date;
    isActive: boolean;
  };
}

interface Branch {
  id: string;
  name: string;
  type: string;
  color: string;
  messageCount: number;
  isActive: boolean;
}

export const ConversationNode = memo<NodeProps<ConversationNodeData>>(({ id, data, selected }) => {
  const { updateNode, deleteNode, setSelection } = useFlowStore();
  const { 
    branches, 
    activeBranchId, 
    showBranchPanel, 
    toggleBranchPanel,
    setActiveThread,
    setActiveBranch
  } = useConversationStore();
  
  const [expanded, setExpanded] = useState(false);
  const [showBranches, setShowBranches] = useState(false);
  const [branchList, setBranchList] = useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  const conversationApi = useConversationApi(data.threadId || '');

  // Load branches when node is expanded
  useEffect(() => {
    if (expanded && data.threadId) {
      loadBranches();
    }
  }, [expanded, data.threadId]);

  const loadBranches = async () => {
    if (!data.threadId) return;

    setIsLoadingBranches(true);
    try {
      const branchesData = await conversationApi.getBranches();
      setBranchList(branchesData.map(branch => ({
        id: branch.id,
        name: branch.branchName,
        type: branch.branchType,
        color: branch.color || '#6b7280',
        messageCount: 0, // This would come from branch stats
        isActive: branch.isActive,
      })));
    } catch (error) {
      console.error('Failed to load branches:', error);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const handleNodeClick = useCallback(() => {
    setSelection([id], []);
    
    if (data.threadId) {
      setActiveThread(data.threadId);
      if (!showBranchPanel) {
        toggleBranchPanel();
      }
    }
  }, [id, data.threadId, setActiveThread, showBranchPanel, toggleBranchPanel, setSelection]);

  const handleBranchClick = useCallback((branchId: string) => {
    if (data.threadId) {
      setActiveThread(data.threadId);
      setActiveBranch(branchId);
    }
  }, [data.threadId, setActiveThread, setActiveBranch]);

  const handleCreateBranch = useCallback(() => {
    if (data.threadId) {
      setActiveThread(data.threadId);
      // This would trigger the branch creation dialog
      // For now, just log the action
      console.log('Create branch for thread:', data.threadId);
    }
  }, [data.threadId, setActiveThread]);

  const getStatusColor = useCallback((status: NodeStatus) => {
    switch (status) {
      case 'running':
        return 'border-blue-500 bg-blue-50';
      case 'completed':
        return 'border-green-500 bg-green-50';
      case 'error':
        return 'border-red-500 bg-red-50';
      case 'skipped':
        return 'border-gray-400 bg-gray-50';
      default:
        return 'border-purple-500 bg-purple-50';
    }
  }, []);

  const getStatusIcon = useCallback((status: NodeStatus) => {
    switch (status) {
      case 'running':
        return <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />;
      case 'completed':
        return <div className="w-2 h-2 bg-green-500 rounded-full" />;
      case 'error':
        return <div className="w-2 h-2 bg-red-500 rounded-full" />;
      default:
        return <div className="w-2 h-2 bg-gray-400 rounded-full" />;
    }
  }, []);

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className={cn(
        'relative min-w-[320px] rounded-lg border-2 shadow-lg transition-all duration-200',
        getStatusColor(data.status),
        selected && 'ring-2 ring-purple-500 ring-offset-2',
        'cursor-pointer'
      )}
      onClick={handleNodeClick}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-purple-400 border-2 border-white"
      />

      {/* Node Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <MessageSquare className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{data.label}</h3>
            <div className="flex items-center gap-2 mt-1">
              {getStatusIcon(data.status)}
              <span className="text-xs text-gray-500 capitalize">{data.status}</span>
              {data.conversationData?.isActive && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <Activity className="w-3 h-3" />
                  <span>Active</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* Node Content */}
      <div className="p-4">
        {/* Conversation Stats */}
        {data.conversationData && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center p-2 bg-white rounded border border-gray-200">
              <MessageSquare className="w-4 h-4 text-gray-600 mx-auto mb-1" />
              <div className="text-lg font-semibold text-gray-900">
                {data.conversationData.messageCount}
              </div>
              <div className="text-xs text-gray-500">Messages</div>
            </div>
            
            <div className="text-center p-2 bg-white rounded border border-gray-200">
              <GitBranch className="w-4 h-4 text-gray-600 mx-auto mb-1" />
              <div className="text-lg font-semibold text-gray-900">
                {data.conversationData.branchCount}
              </div>
              <div className="text-xs text-gray-500">Branches</div>
            </div>
          </div>
        )}

        {/* Branch Information */}
        {data.threadId && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Conversation Branches</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBranches(!showBranches);
                }}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                {showBranches ? 'Hide' : 'Show'} ({branchList.length})
              </button>
            </div>

            <AnimatePresence>
              {showBranches && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {isLoadingBranches ? (
                      <div className="text-center py-4">
                        <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="text-xs text-gray-500 mt-2">Loading branches...</p>
                      </div>
                    ) : branchList.length === 0 ? (
                      <div className="text-center py-4">
                        <GitBranch className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                        <p className="text-xs text-gray-500">No branches yet</p>
                      </div>
                    ) : (
                      branchList.map((branch) => (
                        <div
                          key={branch.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBranchClick(branch.id);
                          }}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded border cursor-pointer transition-all",
                            activeBranchId === branch.id
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          )}
                        >
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: branch.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {branch.name}
                            </div>
                            <div className="text-xs text-gray-500 capitalize">
                              {branch.type}
                            </div>
                          </div>
                          {branch.isActive && (
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  
                  {data.threadId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateBranch();
                      }}
                      className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Create Branch
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Last Activity */}
        {data.conversationData?.lastActivity && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span>Last activity: {data.conversationData.lastActivity.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {data.error && (
          <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-700">
            {data.error}
          </div>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-purple-400 border-2 border-white"
      />

      {/* Quick Actions */}
      <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1">
          {data.threadId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(`/conversations/${data.threadId}`, '_blank');
              }}
              className="p-1 bg-white rounded shadow hover:bg-gray-50 transition-colors"
              title="Open conversation"
            >
              <Eye className="w-3 h-3 text-gray-600" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});

ConversationNode.displayName = 'ConversationNode';

