import React, { memo, useCallback, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Copy,
  Trash2,
  Edit,
  Download,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Node as FlowNode, NodeStatus } from '@/shared';
import { useFlowStore } from '@/store/flowStore';
import { cn } from '@/utils/cn';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ResponseNodeData {
  label: string;
  response: string;
  status: NodeStatus;
  error?: string;
  result?: any;
  model?: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export const ResponseNode = memo<NodeProps<ResponseNodeData>>(({ id, data, selected }) => {
  const { updateNode, deleteNode, setSelection } = useFlowStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.response);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setEditValue(data.response);
  }, [data.response]);

  const handleSave = useCallback(() => {
    updateNode(id, { data: { ...data, response: editValue } });
    setIsEditing(false);
  }, [id, data, editValue, updateNode]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditValue(data.response);
  }, [data.response]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(data.response);
  }, [data.response]);

  const handleDelete = useCallback(() => {
    deleteNode(id);
  }, [id, deleteNode]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([data.response], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response-${id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data.response, id]);

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
        return 'border-purple-300 bg-purple-50';
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
        return <Bot className="w-4 h-4 text-purple-600" />;
    }
  }, []);

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className={cn(
        'relative min-w-[320px] max-w-[500px] rounded-lg border-2 shadow-lg transition-all duration-200',
        getStatusColor(data.status),
        selected && 'ring-2 ring-purple-500 ring-offset-2'
      )}
      onClick={() => setSelection([id], [])}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-purple-400 border-2 border-white"
      />

      {/* Node Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Bot className="w-4 h-4 text-purple-600" />
          <span className="font-medium text-sm text-gray-900">{data.label}</span>
          {data.model && (
            <span className="text-xs text-gray-500">({data.model})</span>
          )}
        </div>
        <div className="flex items-center space-x-1">
          {getStatusIcon(data.status)}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
            className="p-1 hover:bg-gray-200 rounded"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? (
              <ChevronDown className="w-3 h-3 text-gray-600" />
            ) : (
              <ChevronUp className="w-3 h-3 text-gray-600" />
            )}
          </button>
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
              handleDownload();
            }}
            className="p-1 hover:bg-gray-200 rounded"
            title="Download"
          >
            <Download className="w-3 h-3 text-gray-600" />
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
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
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
                      className="w-full p-2 text-sm border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                      rows={6}
                      placeholder="Enter response..."
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
                        className="px-2 py-1 text-xs bg-purple-500 text-white hover:bg-purple-600 rounded"
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
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        className="text-sm text-gray-800 markdown-content"
                      >
                        {data.response || 'No response yet...'}
                      </ReactMarkdown>
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token Usage */}
      {data.tokenUsage && !isCollapsed && (
        <div className="px-3 pb-2">
          <div className="text-xs text-gray-500 border-t pt-2">
            Tokens: {data.tokenUsage.totalTokens} 
            ({data.tokenUsage.promptTokens} prompt + {data.tokenUsage.completionTokens} completion)
          </div>
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-purple-400 border-2 border-white"
      />
    </motion.div>
  );
});

ResponseNode.displayName = 'ResponseNode';