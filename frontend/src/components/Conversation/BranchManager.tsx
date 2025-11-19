import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GitBranch, 
  Plus, 
  GitMerge, 
  Eye, 
  GitCompare, 
  Settings, 
  Trash2, 
  ChevronRight, 
  ChevronDown,
  Copy,
  Share2,
  Download,
  Users,
  Clock,
  MessageSquare,
  Layers,
  Zap,
  Target,
  Compass,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { ConversationBranch, BranchTree, BranchVisualization, BranchComparison } from '../shared';
import { useConversationStore } from '@/store/conversationStore';
import { useConversationApi } from '@/services/conversationService';
import { cn, generateId } from '@/utils';
import BranchCreationDialog from './BranchCreationDialog';
import BranchMergeDialog from './BranchMergeDialog';
import BranchVisualizationPanel from './BranchVisualizationPanel';
import BranchComparisonPanel from './BranchComparisonPanel';
import BranchDetailsPanel from './BranchDetailsPanel';

interface BranchManagerProps {
  threadId: string;
  nodeId: string;
  className?: string;
}

const branchTypeConfig = {
  question: {
    icon: HelpCircle,
    label: 'Question',
    description: 'Ask a follow-up question',
    color: '#3b82f6',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
    textClass: 'text-blue-700',
  },
  alternative: {
    icon: GitBranch,
    label: 'Alternative',
    description: 'Explore a different path',
    color: '#f97316',
    bgClass: 'bg-orange-50',
    borderClass: 'border-orange-200',
    textClass: 'text-orange-700',
  },
  clarification: {
    icon: Info,
    label: 'Clarification',
    description: 'Seek clarification on a point',
    color: '#8b5cf6',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-200',
    textClass: 'text-purple-700',
  },
  correction: {
    icon: AlertTriangle,
    label: 'Correction',
    description: 'Correct a previous response',
    color: '#ef4444',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200',
    textClass: 'text-red-700',
  },
  exploration: {
    icon: Compass,
    label: 'Exploration',
    description: 'Explore related topics',
    color: '#10b981',
    bgClass: 'bg-green-50',
    borderClass: 'border-green-200',
    textClass: 'text-green-700',
  },
  summary: {
    icon: MessageSquare,
    label: 'Summary',
    description: 'Summarize the conversation',
    color: '#6b7280',
    bgClass: 'bg-gray-50',
    borderClass: 'border-gray-200',
    textClass: 'text-gray-700',
  },
};

const BranchManager: React.FC<BranchManagerProps> = ({ threadId, nodeId, className }) => {
  const conversationApi = useConversationApi(threadId);
  const {
    // State
    branches,
    branchTree,
    branchVisualization,
    branchComparison,
    activeBranchId,
    selectedBranchIds,
    comparisonBranchIds,
    showBranchPanel,
    showVisualization,
    showComparison,
    loadingBranches,
    loadingVisualization,
    loadingComparison,
    branchesError,
    visualizationError,
    comparisonError,
    isCreatingBranch,
    isMergingBranches,
    branchCreationOptions,
    branchMergeOptions,

    // Actions
    setActiveBranch,
    setBranches,
    setBranchTree,
    setBranchVisualization,
    setBranchComparison,
    selectBranch,
    addToComparison,
    removeFromComparison,
    toggleBranchPanel,
    toggleVisualization,
    toggleComparison,
    setLoadingBranches,
    setLoadingVisualization,
    setLoadingComparison,
    setBranchesError,
    setVisualizationError,
    setComparisonError,
    setCreatingBranch,
    setMergingBranches,
    setBranchCreationOptions,
    setBranchMergeOptions,

    // Computed
    getActiveBranch,
    getSelectedBranches,
    getComparisonBranches,
    getMainBranch,
    getBranchPath,
    getChildBranches,
    getParentBranch,
  } = useConversationStore();

  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [hoveredBranchId, setHoveredBranchId] = useState<string | null>(null);

  // Load branches on component mount
  useEffect(() => {
    if (threadId) {
      loadBranches();
      loadBranchTree();
    }
  }, [threadId]);

  // Auto-refresh when branches change
  useEffect(() => {
    const interval = setInterval(() => {
      if (threadId && showBranchPanel) {
        loadBranches();
        loadBranchTree();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [threadId, showBranchPanel]);

  const loadBranches = useCallback(async () => {
    try {
      setLoadingBranches(true);
      setBranchesError(null);
      const branchesData = await conversationApi.getBranches();
      setBranches(branchesData);
    } catch (error) {
      console.error('Failed to load branches:', error);
      setBranchesError(error instanceof Error ? error.message : 'Failed to load branches');
    } finally {
      setLoadingBranches(false);
    }
  }, [conversationApi, setBranches, setLoadingBranches, setBranchesError]);

  const loadBranchTree = useCallback(async () => {
    try {
      const treeData = await conversationApi.getBranchTree();
      setBranchTree(treeData);
    } catch (error) {
      console.error('Failed to load branch tree:', error);
    }
  }, [conversationApi, setBranchTree]);

  const handleCreateBranch = useCallback(async (branchPointId: string, options: any) => {
    try {
      setCreatingBranch(true);
      const newBranch = await conversationApi.createBranch(branchPointId, options);
      // Branch creation will be handled by WebSocket updates
      setBranchCreationOptions(null);
      return newBranch;
    } catch (error) {
      console.error('Failed to create branch:', error);
      throw error;
    } finally {
      setCreatingBranch(false);
    }
  }, [conversationApi, setCreatingBranch, setBranchCreationOptions]);

  const handleMergeBranches = useCallback(async (sourceBranchId: string, targetBranchId: string, options: any) => {
    try {
      setMergingBranches(true);
      const mergeResult = await conversationApi.mergeBranches(sourceBranchId, targetBranchId, options);
      setBranchMergeOptions(null);
      return mergeResult;
    } catch (error) {
      console.error('Failed to merge branches:', error);
      throw error;
    } finally {
      setMergingBranches(false);
    }
  }, [conversationApi, setMergingBranches, setBranchMergeOptions]);

  const handleSwitchBranch = useCallback(async (branchId: string) => {
    try {
      await conversationApi.switchActiveBranch(branchId);
      setActiveBranch(branchId);
    } catch (error) {
      console.error('Failed to switch branch:', error);
    }
  }, [conversationApi, setActiveBranch]);

  const handleDeleteBranch = useCallback(async (branchId: string) => {
    if (!confirm('Are you sure you want to delete this branch? This action cannot be undone.')) {
      return;
    }

    try {
      await conversationApi.deleteBranch(branchId);
      // Branch deletion will be handled by WebSocket updates
    } catch (error) {
      console.error('Failed to delete branch:', error);
    }
  }, [conversationApi]);

  const handleGenerateVisualization = useCallback(async (options: any) => {
    try {
      setLoadingVisualization(true);
      setVisualizationError(null);
      const visualizationData = await conversationApi.generateVisualization(options);
      setBranchVisualization(visualizationData);
    } catch (error) {
      console.error('Failed to generate visualization:', error);
      setVisualizationError(error instanceof Error ? error.message : 'Failed to generate visualization');
    } finally {
      setLoadingVisualization(false);
    }
  }, [conversationApi, setLoadingVisualization, setVisualizationError, setBranchVisualization]);

  const handleCompareBranches = useCallback(async (branchIds: string[], options: any) => {
    try {
      setLoadingComparison(true);
      setComparisonError(null);
      const comparisonData = await conversationApi.compareBranches(branchIds, options);
      setBranchComparison(comparisonData);
    } catch (error) {
      console.error('Failed to compare branches:', error);
      setComparisonError(error instanceof Error ? error.message : 'Failed to compare branches');
    } finally {
      setLoadingComparison(false);
    }
  }, [conversationApi, setLoadingComparison, setComparisonError, setBranchComparison]);

  const toggleBranchExpansion = useCallback((branchId: string) => {
    setExpandedBranches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(branchId)) {
        newSet.delete(branchId);
      } else {
        newSet.add(branchId);
      }
      return newSet;
    });
  }, []);

  const renderBranchTree = useCallback((branch: any, level = 0): JSX.Element => {
    const childBranches = getChildBranches(branch.id);
    const isExpanded = expandedBranches.has(branch.id);
    const isActive = activeBranchId === branch.id;
    const isSelected = selectedBranchIds.includes(branch.id);
    const isInComparison = comparisonBranchIds.includes(branch.id);
    const isHovered = hoveredBranchId === branch.id;
    const config = branchTypeConfig[branch.branchType as keyof typeof branchTypeConfig];
    const Icon = config.icon;

    return (
      <div key={branch.id} className="select-none">
        <div
          className={cn(
            "group flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer",
            config.bgClass,
            config.borderClass,
            isActive && "ring-2 ring-blue-500 ring-offset-1",
            isSelected && "ring-2 ring-purple-500 ring-offset-1",
            isInComparison && "ring-2 ring-green-500 ring-offset-1",
            isHovered && "shadow-sm",
            "hover:shadow-md"
          )}
          style={{ marginLeft: `${level * 20}px` }}
          onClick={() => selectBranch(branch.id)}
          onMouseEnter={() => setHoveredBranchId(branch.id)}
          onMouseLeave={() => setHoveredBranchId(null)}
        >
          {/* Expand/Collapse button */}
          {childBranches.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleBranchExpansion(branch.id);
              }}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-600" />
              )}
            </button>
          )}

          {/* Branch icon and info */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className="p-1 rounded"
              style={{ backgroundColor: branch.color || config.color }}
            >
              <Icon className="w-4 h-4 text-white" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn("font-medium text-sm truncate", config.textClass)}>
                  {branch.branchName}
                </span>
                {branch.isMainBranch && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    Main
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">{config.label}</span>
                {branch.description && (
                  <span className="text-xs text-gray-400 truncate">
                    {branch.description}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!isActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSwitchBranch(branch.id);
                }}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Switch to this branch"
              >
                <Zap className="w-3 h-3 text-blue-600" />
              </button>
            )}
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                isInComparison 
                  ? removeFromComparison(branch.id)
                  : addToComparison(branch.id);
              }}
              className={cn(
                "p-1 hover:bg-gray-200 rounded transition-colors",
                isInComparison && "bg-green-100"
              )}
              title={isInComparison ? "Remove from comparison" : "Add to comparison"}
            >
              <GitCompare className="w-3 h-3 text-gray-600" />
            </button>

            {!branch.isMainBranch && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteBranch(branch.id);
                }}
                className="p-1 hover:bg-red-100 rounded transition-colors"
                title="Delete branch"
              >
                <Trash2 className="w-3 h-3 text-red-600" />
              </button>
            )}
          </div>
        </div>

        {/* Child branches */}
        <AnimatePresence>
          {isExpanded && childBranches.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="ml-4 border-l-2 border-gray-200 pl-2">
                {childBranches.map(child => renderBranchTree(child, level + 1))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }, [
    activeBranchId,
    selectedBranchIds,
    comparisonBranchIds,
    hoveredBranchId,
    expandedBranches,
    getChildBranches,
    selectBranch,
    addToComparison,
    removeFromComparison,
    handleSwitchBranch,
    handleDeleteBranch,
    toggleBranchExpansion,
  ]);

  const mainBranch = getMainBranch();
  const activeBranch = getActiveBranch();

  return (
    <div className={cn("h-full flex flex-col bg-white border-l border-gray-200", className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-gray-600" />
            <h2 className="font-semibold text-gray-900">Branches</h2>
            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
              {branches.length}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleBranchPanel()}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Toggle branch panel"
            >
              <Settings className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Branch stats */}
        {branchTree && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1 text-gray-600">
              <Layers className="w-3 h-3" />
              <span>Max Depth: {branchTree.maxDepth}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-600">
              <Zap className="w-3 h-3" />
              <span>Active: {branchTree.activeBranches}</span>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="p-3 border-b border-gray-200">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setBranchCreationOptions({
              branchName: `Branch ${branches.length + 1}`,
              branchType: 'alternative',
            })}
            className="flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            New Branch
          </button>
          
          <button
            onClick={() => setBranchMergeOptions({
              sourceBranchId: '',
              targetBranchId: '',
              mergeStrategy: 'append',
            })}
            disabled={selectedBranchIds.length < 2}
            className={cn(
              "flex items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors text-sm",
              selectedBranchIds.length >= 2
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            <GitMerge className="w-4 h-4" />
            Merge
          </button>
        </div>

        {/* Comparison controls */}
        {comparisonBranchIds.length > 0 && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-600">
              {comparisonBranchIds.length} branch{comparisonBranchIds.length > 1 ? 'es' : ''} selected for comparison
            </span>
            <button
              onClick={() => {
                handleCompareBranches(comparisonBranchIds, {});
                toggleComparison();
              }}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              Compare
            </button>
          </div>
        )}
      </div>

      {/* Branch tree */}
      <div className="flex-1 overflow-y-auto p-3">
        {loadingBranches ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-gray-500">Loading branches...</div>
          </div>
        ) : branchesError ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-red-600 text-center">
              <AlertTriangle className="w-5 h-5 mx-auto mb-2" />
              {branchesError}
            </div>
          </div>
        ) : branches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <GitBranch className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-2">No branches yet</p>
            <button
              onClick={() => setBranchCreationOptions({
                branchName: 'First Branch',
                branchType: 'alternative',
              })}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Create your first branch
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {branches
              .filter(branch => !branch.parentBranchId) // Root branches only
              .map(branch => renderBranchTree(branch))}
          </div>
        )}
      </div>

      {/* Modals and panels */}
      <AnimatePresence>
        {branchCreationOptions && (
          <BranchCreationDialog
            threadId={threadId}
            options={branchCreationOptions}
            onConfirm={handleCreateBranch}
            onCancel={() => setBranchCreationOptions(null)}
          />
        )}

        {branchMergeOptions && (
          <BranchMergeDialog
            threadId={threadId}
            branches={branches}
            options={branchMergeOptions}
            onConfirm={handleMergeBranches}
            onCancel={() => setBranchMergeOptions(null)}
          />
        )}

        {showVisualization && (
          <BranchVisualizationPanel
            visualization={branchVisualization}
            loading={loadingVisualization}
            error={visualizationError}
            onRegenerate={handleGenerateVisualization}
            onClose={() => toggleVisualization()}
          />
        )}

        {showComparison && (
          <BranchComparisonPanel
            comparison={branchComparison}
            branches={branches}
            loading={loadingComparison}
            error={comparisonError}
            onClose={() => toggleComparison()}
          />
        )}

        {selectedBranchIds.length === 1 && activeBranch && (
          <BranchDetailsPanel
            branch={activeBranch}
            onClose={() => {
              selectBranch('', false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default BranchManager;