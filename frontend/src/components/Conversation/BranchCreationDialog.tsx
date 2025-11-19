import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Plus, 
  Target, 
  Compass, 
  AlertTriangle, 
  Lightbulb, 
  MessageSquare, 
  HelpCircle,
  GitBranch,
  Check
} from 'lucide-react';
import { BranchCreationOptions } from '../shared';
import { cn, generateId } from '@/utils';

interface BranchCreationDialogProps {
  threadId: string;
  options: Partial<BranchCreationOptions>;
  onConfirm: (branchPointId: string, options: BranchCreationOptions) => Promise<void>;
  onCancel: () => void;
}

const branchTypes = [
  {
    type: 'question' as const,
    icon: HelpCircle,
    label: 'Ask a Question',
    description: 'Create a branch to ask a follow-up question about the current topic',
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  {
    type: 'alternative' as const,
    icon: GitBranch,
    label: 'Explore Alternative',
    description: 'Branch off to explore a different approach or perspective',
    color: 'bg-orange-50 border-orange-200 text-orange-700',
    iconColor: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  {
    type: 'clarification' as const,
    icon: Lightbulb,
    label: 'Seek Clarification',
    description: 'Create a branch to clarify a point or get more details',
    color: 'bg-purple-50 border-purple-200 text-purple-700',
    iconColor: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  {
    type: 'correction' as const,
    icon: AlertTriangle,
    label: 'Make a Correction',
    description: 'Branch to correct or revise previous information',
    color: 'bg-red-50 border-red-200 text-red-700',
    iconColor: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  {
    type: 'exploration' as const,
    icon: Compass,
    label: 'Explore Topic',
    description: 'Create a branch to explore related or tangential topics',
    color: 'bg-green-50 border-green-200 text-green-700',
    iconColor: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  {
    type: 'summary' as const,
    icon: MessageSquare,
    label: 'Create Summary',
    description: 'Branch to create a summary or synthesis of the conversation',
    color: 'bg-gray-50 border-gray-200 text-gray-700',
    iconColor: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
];

const BranchCreationDialog: React.FC<BranchCreationDialogProps> = ({
  threadId,
  options,
  onConfirm,
  onCancel,
}) => {
  const [selectedType, setSelectedType] = useState(options.branchType || 'alternative');
  const [branchName, setBranchName] = useState(options.branchName || '');
  const [description, setDescription] = useState(options.description || '');
  const [reasoning, setReasoning] = useState('');
  const [contextKeywords, setContextKeywords] = useState('');
  const [copyMessages, setCopyMessages] = useState(options.copyMessages || false);
  const [copyContext, setCopyContext] = useState(options.copyContext !== false);
  const [isCreating, setIsCreating] = useState(false);

  const selectedTypeConfig = branchTypes.find(t => t.type === selectedType);

  const handleConfirm = async () => {
    if (!branchName.trim()) {
      return;
    }

    setIsCreating(true);
    try {
      const branchOptions: BranchCreationOptions = {
        branchName: branchName.trim(),
        branchType: selectedType,
        description: description.trim() || undefined,
        metadata: {
          reasoning: reasoning.trim() || undefined,
          contextKeywords: contextKeywords.trim() ? contextKeywords.split(',').map(k => k.trim()) : undefined,
          userIntent: selectedType,
        },
        copyMessages,
        copyContext,
      };

      // For now, we'll use a default branch point ID
      // In a real implementation, this would be the current message or selected message
      const branchPointId = 'current-message'; // This should be passed from parent
      
      await onConfirm(branchPointId, branchOptions);
    } catch (error) {
      console.error('Failed to create branch:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleTypeSelect = (type: typeof selectedType) => {
    setSelectedType(type);
    if (!branchName || branchName === options.branchName) {
      const config = branchTypes.find(t => t.type === type);
      setBranchName(`${config?.label} ${Date.now()}`);
    }
  };

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
          className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Plus className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Create New Branch</h2>
                <p className="text-sm text-gray-500">Branch from the current conversation point</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Branch Type Selection */}
          <div className="p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What type of branch do you want to create?
              </label>
              <div className="grid grid-cols-2 gap-3">
                {branchTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.type}
                      onClick={() => handleTypeSelect(type.type)}
                      className={cn(
                        "p-4 border-2 rounded-lg text-left transition-all",
                        selectedType === type.type
                          ? `${type.color} border-current`
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("p-2 rounded-lg", type.bgColor)}>
                          <Icon className={cn("w-5 h-5", type.iconColor)} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{type.label}</h3>
                          <p className="text-sm text-gray-500 mt-1">{type.description}</p>
                        </div>
                        {selectedType === type.type && (
                          <div className="flex items-center">
                            <Check className="w-4 h-4 text-current" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Branch Details */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="Enter a name for this branch"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this branch will explore..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reasoning (optional)
                </label>
                <textarea
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  placeholder="Why are you creating this branch? What do you hope to achieve?"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Context Keywords (optional)
                </label>
                <input
                  type="text"
                  value={contextKeywords}
                  onChange={(e) => setContextKeywords(e.target.value)}
                  placeholder="keyword1, keyword2, keyword3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Separate keywords with commas
                </p>
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copyContext}
                    onChange={(e) => setCopyContext(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Copy conversation context</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copyMessages}
                    onChange={(e) => setCopyMessages(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Copy previous messages</span>
                </label>
              </div>
            </div>
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
              disabled={!branchName.trim() || isCreating}
              className={cn(
                "px-4 py-2 rounded-lg transition-colors flex items-center gap-2",
                branchName.trim() && !isCreating
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              )}
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Branch
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BranchCreationDialog;