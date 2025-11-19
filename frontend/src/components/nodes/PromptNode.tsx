import React, { memo, useCallback, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Play,
  Copy,
  Trash2,
  Edit
} from 'lucide-react';
import { Node as FlowNode, NodeStatus } from '@/shared';
import { useFlowStore } from '@/store/flowStore';
import { cn } from '@/utils';

interface PromptNodeData {
  label: string;
  prompt: string;
  status: NodeStatus;
  error?: string;
  result?: any;
}

export const PromptNode = memo<NodeProps<PromptNodeData>>(({ id, data, selected }) => {
  const { updateNode, deleteNode, setNodeStatus, setSelection } = useFlowStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.prompt);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setEditValue(data.prompt);
  }, [data.prompt]);

  const handleSave = useCallback(() => {
    updateNode(id, { data: { ...data, prompt: editValue } });
    setIsEditing(false);
  }, [id, data, editValue, updateNode]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditValue(data.prompt);
  }, [data.prompt]);

  const handleCopy = useCallback(() => {
    // Copy node logic would go here
    console.log('Copy node:', id);
  }, [id]);

  const handleDelete = useCallback(() => {
    deleteNode(id);
  }, [id, deleteNode]);

  const handleExecute = useCallback(() => {
    setNodeStatus(id, 'running');
    // Simulate execution
    setTimeout(() => {
      setNodeStatus(id, 'completed', { output: 'Sample response' });
    }, 2000);
  }, [id, setNodeStatus]);

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
        return 'border-gray-300 bg-white';
    }
  }, []);

  const getStatusIcon = useCallback((status: NodeStatus) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-600" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'skipped':
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
      default:
        return <Play className="w-4 h-4 text-gray-600" />;
    }
  }, []);

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className={cn(
        'relative min-w-[280px] rounded-lg border-2 shadow-lg transition-all duration-200',
        getStatusColor(data.status),
        selected && 'ring-2 ring-blue-500 ring-offset-2'
      )}
      onClick={() => setSelection([id], [])}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-gray-400 border-2 border-white"
      />

      {/* Node Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-4 h-4 text-gray-600" />
          <span className="font-medium text-sm text-gray-900">{data.label}</span>
        </div>
        <div className="flex items-center space-x-1">
          {getStatusIcon(data.status)}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEdit();
            }}
            className="p-1 hover:bg-gray-200 rounded"
            title="Edit"
          >
            <Edit className="w-3 h-3 text-gray-600" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className="p-1 hover:bg-gray-200 rounded"
            title="Copy"
          >
            <Copy className="w-3 h-3 text-gray-600" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="p-1 hover:bg-red-100 rounded"
            title="Delete"
          >
            <Trash2 className="w-3 h-3 text-red-600" />
          </button>
        </div>
      </div>

      {/* Node Content */}
      <div className="p-3">
        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Enter your prompt..."
                autoFocus
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={handleCancel}
                  className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-2 py-1 text-xs bg-blue-500 text-white hover:bg-blue-600 rounded"
                >
                  Save
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-sm text-gray-700 min-h-[60px] whitespace-pre-wrap">
                {data.prompt || 'Click to add prompt...'}
              </div>
              {data.error && (
                <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-700">
                  {data.error}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Execute Button */}
      {data.status === 'idle' && !isEditing && (
        <div className="p-2 pt-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleExecute();
            }}
            className="w-full px-3 py-1 text-xs bg-blue-500 text-white hover:bg-blue-600 rounded flex items-center justify-center space-x-1"
          >
            <Play className="w-3 h-3" />
            <span>Execute</span>
          </button>
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-gray-400 border-2 border-white"
      />
    </motion.div>
  );
});

PromptNode.displayName = 'PromptNode';