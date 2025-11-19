import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  GitBranch, 
  MessageSquare, 
  Clock, 
  Users,
  Hash,
  Tag,
  Calendar,
  Activity,
  Settings,
  ExternalLink,
  Copy,
  Share2,
  Download,
  Edit,
  Trash2
} from 'lucide-react';
import { ConversationBranch } from '../shared';
import { useConversationApi } from '@/services/conversationService';
import { cn, formatDate } from '@/utils';

interface BranchDetailsPanelProps {
  branch: ConversationBranch;
  onClose: () => void;
}

const branchTypeInfo = {
  question: {
    label: 'Question',
    description: 'Branch created to ask follow-up questions',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  alternative: {
    label: 'Alternative',
    description: 'Branch exploring different approaches or perspectives',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  clarification: {
    label: 'Clarification',
    description: 'Branch seeking more details or explanations',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  correction: {
    label: 'Correction',
    description: 'Branch created to correct or revise information',
    color: 'bg-red-100 text-red-800 border-red-200',
  },
  exploration: {
    label: 'Exploration',
    description: 'Branch exploring related or tangential topics',
    color: 'bg-green-100 text-green-800 border-green-200',
  },
  summary: {
    label: 'Summary',
    description: 'Branch providing synthesis or summary of content',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
  },
};

const BranchDetailsPanel: React.FC<BranchDetailsPanelProps> = ({
  branch,
  onClose,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBranch, setEditedBranch] = useState<Partial<ConversationBranch>>({});
  const [messageCount, setMessageCount] = useState<number | null>(null);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const conversationApi = useConversationApi(branch.threadId);

  useEffect(() => {
    loadBranchStats();
  }, [branch.id]);

  const loadBranchStats = async () => {
    try {
      const history = await conversationApi.getConversationHistory({
        branchId: branch.id,
        limit: 1,
      });
      setMessageCount(history.total);

      // Get last activity timestamp from messages
      if (history.messages.length > 0) {
        setLastActivity(new Date(history.messages[history.messages.length - 1].timestamp));
      } else {
        setLastActivity(branch.createdAt);
      }
    } catch (error) {
      console.error('Failed to load branch stats:', error);
    }
  };

  const handleSave = async () => {
    try {
      // This would call an API to update the branch
      // For now, just close the edit mode
      setIsEditing(false);
      setEditedBranch({});
    } catch (error) {
      console.error('Failed to update branch:', error);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await conversationApi.exportConversation('json', {
        includeBranchInfo: true,
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `branch-${branch.branchName}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export branch:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyBranchLink = () => {
    const link = `${window.location.origin}/conversations/${branch.threadId}?branch=${branch.id}`;
    navigator.clipboard.writeText(link);
  };

  const typeInfo = branchTypeInfo[branch.branchType as keyof typeof branchTypeInfo];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: branch.color || '#6b7280' }}>
                <GitBranch className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedBranch.branchName || branch.branchName}
                      onChange={(e) => setEditedBranch({ ...editedBranch, branchName: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    branch.branchName
                  )}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn("px-2 py-1 text-xs rounded-full border", typeInfo.color)}>
                    {typeInfo.label}
                  </span>
                  {branch.isMainBranch && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full border border-blue-200">
                      Main Branch
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditedBranch({});
                    }}
                    className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit branch"
                  >
                    <Edit className="w-4 h-4 text-gray-600" />
                  </button>
                  
                  <button
                    onClick={handleCopyBranchLink}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Copy branch link"
                  >
                    <Copy className="w-4 h-4 text-gray-600" />
                  </button>
                  
                  <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    title="Export branch"
                  >
                    <Download className={cn("w-4 h-4 text-gray-600", isExporting && "animate-spin")} />
                  </button>
                </>
              )}
              
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
            {/* Description */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
              {isEditing ? (
                <textarea
                  value={editedBranch.description || branch.description || ''}
                  onChange={(e) => setEditedBranch({ ...editedBranch, description: e.target.value })}
                  placeholder="Describe this branch..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              ) : (
                <p className="text-gray-600">
                  {branch.description || typeInfo.description}
                </p>
              )}
            </div>

            {/* Branch Information */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Branch Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Hash className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">ID:</span>
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">{branch.id}</code>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Activity className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">Status:</span>
                  <span className={cn(
                    "px-2 py-1 rounded-full text-xs",
                    branch.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  )}>
                    {branch.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <GitBranch className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">Depth:</span>
                  <span className="font-medium">{branch.depth}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <MessageSquare className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">Messages:</span>
                  <span className="font-medium">
                    {messageCount !== null ? messageCount : 'Loading...'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">Created:</span>
                  <span className="font-medium">{formatDate(branch.createdAt)}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">Last Activity:</span>
                  <span className="font-medium">
                    {lastActivity ? formatDate(lastActivity) : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>

            {/* Metadata */}
            {branch.metadata && Object.keys(branch.metadata).length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Metadata</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                    {JSON.stringify(branch.metadata, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Tags */}
            {branch.metadata?.tags && branch.metadata.tags.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {branch.metadata.tags.map((tag: string, index: number) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full border border-gray-200"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Branch Relationships */}
            {branch.parentBranchId || (branch.childBranchIds && branch.childBranchIds.length > 0) && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Branch Relationships</h3>
                <div className="space-y-2">
                  {branch.parentBranchId && (
                    <div className="flex items-center gap-2 text-sm">
                      <GitBranch className="w-4 h-4 text-gray-400 rotate-180" />
                      <span className="text-gray-500">Parent:</span>
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                        {branch.parentBranchId}
                      </code>
                    </div>
                  )}
                  
                  {branch.childBranchIds && branch.childBranchIds.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <GitBranch className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-500">Child branches:</span>
                      </div>
                      <div className="ml-6 space-y-1">
                        {branch.childBranchIds.map((childId: string, index: number) => (
                          <code key={index} className="block bg-gray-100 px-2 py-1 rounded text-xs">
                            {childId}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleCopyBranchLink}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  <Copy className="w-4 h-4" />
                  Copy Link
                </button>
                
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                
                <button
                  onClick={() => {
                    // Navigate to branch view
                    window.location.href = `/conversations/${branch.threadId}?branch=${branch.id}`;
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Branch
                </button>
                
                {!branch.isMainBranch && (
                  <button
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Branch
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BranchDetailsPanel;