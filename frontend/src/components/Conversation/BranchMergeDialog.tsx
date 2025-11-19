import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  GitMerge, 
  ArrowRight, 
  Check, 
  AlertTriangle,
  Info,
  GitCompare
} from 'lucide-react';
import { ConversationBranch, BranchMergeOptions } from '../shared';
import { cn } from '@/utils';

interface BranchMergeDialogProps {
  threadId: string;
  branches: ConversationBranch[];
  options: Partial<BranchMergeOptions>;
  onConfirm: (sourceBranchId: string, targetBranchId: string, options: BranchMergeOptions) => Promise<void>;
  onCancel: () => void;
}

const mergeStrategies = [
  {
    value: 'append' as const,
    label: 'Append',
    description: 'Add all messages from source branch after target branch messages',
    icon: '➕',
  },
  {
    value: 'interleave' as const,
    label: 'Interleave',
    description: 'Mix messages from both branches chronologically',
    icon: '🔄',
  },
  {
    value: 'selective' as const,
    label: 'Selective',
    description: 'Choose specific messages to keep from each branch',
    icon: '🎯',
  },
  {
    value: 'summarize' as const,
    label: 'Summarize',
    description: 'Create a summary of both branches and continue',
    icon: '📝',
  },
  {
    value: 'vote' as const,
    label: 'Vote',
    description: 'Let the AI choose the best conversation path',
    icon: '🗳️',
  },
];

const BranchMergeDialog: React.FC<BranchMergeDialogProps> = ({
  threadId,
  branches,
  options,
  onConfirm,
  onCancel,
}) => {
  const [sourceBranchId, setSourceBranchId] = useState(options.sourceBranchId || '');
  const [targetBranchId, setTargetBranchId] = useState(options.targetBranchId || '');
  const [mergeStrategy, setMergeStrategy] = useState<BranchMergeOptions['mergeStrategy']>(
    options.mergeStrategy || 'append'
  );
  const [preserveHistory, setPreserveHistory] = useState(options.preserveHistory !== false);
  const [isMerging, setIsMerging] = useState(false);

  const sourceBranch = branches.find(b => b.id === sourceBranchId);
  const targetBranch = branches.find(b => b.id === targetBranchId);

  const canMerge = sourceBranchId && targetBranchId && sourceBranchId !== targetBranchId;

  const handleConfirm = async () => {
    if (!canMerge) return;

    setIsMerging(true);
    try {
      const mergeOptions: BranchMergeOptions = {
        sourceBranchId,
        targetBranchId,
        mergeStrategy,
        preserveHistory,
      };

      await onConfirm(sourceBranchId, targetBranchId, mergeOptions);
    } catch (error) {
      console.error('Failed to merge branches:', error);
    } finally {
      setIsMerging(false);
    }
  };

  const getBranchPreview = (branch: ConversationBranch) => (
    <div className="p-3 border rounded-lg bg-white">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: branch.color || '#6b7280' }}
        />
        <span className="font-medium text-sm">{branch.branchName}</span>
        <span className="text-xs text-gray-500">({branch.branchType})</span>
      </div>
      {branch.description && (
        <p className="text-xs text-gray-600">{branch.description}</p>
      )}
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
        <span>Depth: {branch.depth}</span>
        {branch.metadata?.createdAt && (
          <span>Created: {new Date(branch.metadata.createdAt).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <GitMerge className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Merge Branches</h2>
                <p className="text-sm text-gray-500">Combine conversation paths into one</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-6">
            {/* Branch Selection */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Select Branches to Merge</h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Source Branch */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Source Branch
                  </label>
                  <select
                    value={sourceBranchId}
                    onChange={(e) => setSourceBranchId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Select source branch</option>
                    {branches
                      .filter(b => b.id !== targetBranchId)
                      .map(branch => (
                        <option key={branch.id} value={branch.id}>
                          {branch.branchName} ({branch.branchType})
                        </option>
                      ))}
                  </select>
                  
                  {sourceBranch && (
                    <div className="mt-3">
                      {getBranchPreview(sourceBranch)}
                    </div>
                  )}
                </div>

                {/* Target Branch */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Branch
                  </label>
                  <select
                    value={targetBranchId}
                    onChange={(e) => setTargetBranchId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Select target branch</option>
                    {branches
                      .filter(b => b.id !== sourceBranchId)
                      .map(branch => (
                        <option key={branch.id} value={branch.id}>
                          {branch.branchName} ({branch.branchType})
                        </option>
                      ))}
                  </select>
                  
                  {targetBranch && (
                    <div className="mt-3">
                      {getBranchPreview(targetBranch)}
                    </div>
                  )}
                </div>
              </div>

              {/* Merge direction indicator */}
              {sourceBranch && targetBranch && (
                <div className="mt-4 flex items-center justify-center">
                  <div className="text-center">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>{sourceBranch.branchName}</span>
                      <ArrowRight className="w-4 h-4" />
                      <span>{targetBranch.branchName}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Messages from source will be merged into target
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Merge Strategy */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Merge Strategy</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mergeStrategies.map((strategy) => (
                  <button
                    key={strategy.value}
                    onClick={() => setMergeStrategy(strategy.value)}
                    className={cn(
                      "p-4 border-2 rounded-lg text-left transition-all",
                      mergeStrategy === strategy.value
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{strategy.icon}</div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{strategy.label}</h4>
                        <p className="text-sm text-gray-600">{strategy.description}</p>
                      </div>
                      {mergeStrategy === strategy.value && (
                        <Check className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Merge Options</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={preserveHistory}
                    onChange={(e) => setPreserveHistory(e.target.checked)}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Preserve branch history</span>
                    <p className="text-xs text-gray-500">
                      Keep the source branch as a reference after merging
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Warning */}
            {canMerge && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800">Important Note</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Merging branches will combine the conversation history. This action cannot be undone. 
                      Make sure you have selected the correct branches and merge strategy.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canMerge || isMerging}
              className={cn(
                "px-4 py-2 rounded-lg transition-colors flex items-center gap-2",
                canMerge && !isMerging
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              )}
            >
              {isMerging ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <GitMerge className="w-4 h-4" />
                  Merge Branches
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BranchMergeDialog;