import React, { memo, useCallback, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Code, 
  CheckCircle, 
  AlertCircle, 
  Play,
  Copy,
  Trash2,
  Edit,
  Settings
} from 'lucide-react';
import { Node as FlowNode, NodeStatus } from '@/shared';
import { useFlowStore } from '@/store/flowStore';
import { cn } from '@/utils/cn';

interface ConditionNodeData {
  label: string;
  condition: string;
  language: 'javascript' | 'python' | 'jsonpath';
  trueLabel?: string;
  falseLabel?: string;
  status: NodeStatus;
  error?: string;
  result?: any;
}

export const ConditionNode = memo<NodeProps<ConditionNodeData>>(({ id, data, selected }) => {
  const { updateNode, deleteNode, setSelection } = useFlowStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editCondition, setEditCondition] = useState(data.condition);
  const [editLanguage, setEditLanguage] = useState(data.language);
  const [editTrueLabel, setEditTrueLabel] = useState(data.trueLabel || 'True');
  const [editFalseLabel, setEditFalseLabel] = useState(data.falseLabel || 'False');

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setEditCondition(data.condition);
    setEditLanguage(data.language);
    setEditTrueLabel(data.trueLabel || 'True');
    setEditFalseLabel(data.falseLabel || 'False');
  }, [data]);

  const handleSave = useCallback(() => {
    updateNode(id, { 
      data: { 
        ...data, 
        condition: editCondition,
        language: editLanguage,
        trueLabel: editTrueLabel,
        falseLabel: editFalseLabel
      } 
    });
    setIsEditing(false);
  }, [id, data, editCondition, editLanguage, editTrueLabel, editFalseLabel, updateNode]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditCondition(data.condition);
    setEditLanguage(data.language);
  }, [data]);

  const handleTest = useCallback(() => {
    // Test the condition logic
    try {
      let result = false;
      if (editLanguage === 'javascript') {
        // Simple evaluation (in production, this would be sandboxed)
        result = new Function('return ' + editCondition)();
      } else if (editLanguage === 'python') {
        // Python evaluation would require backend call
        console.log('Python condition:', editCondition);
      }
      console.log('Condition test result:', result);
    } catch (error) {
      console.error('Condition test error:', error);
    }
  }, [editCondition, editLanguage]);

  const handleCopy = useCallback(() => {
    console.log('Copy condition node:', id);
  }, [id]);

  const handleDelete = useCallback(() => {
    deleteNode(id);
  }, [id, deleteNode]);

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
        return 'border-indigo-400 bg-indigo-50';
    }
  }, []);

  const getStatusIcon = useCallback((status: NodeStatus) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="w-4 h-4 animate-spin text-blue-600" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'skipped':
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
      default:
        return <Code className="w-4 h-4 text-indigo-600" />;
    }
  }, []);

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className={cn(
        'relative min-w-[320px] max-w-[450px] rounded-lg border-2 shadow-lg transition-all duration-200',
        getStatusColor(data.status),
        selected && 'ring-2 ring-indigo-500 ring-offset-2'
      )}
      onClick={() => setSelection([id], [])}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-indigo-400 border-2 border-white"
      />

      {/* Node Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Code className="w-4 h-4 text-indigo-600" />
          <span className="font-medium text-sm text-gray-900">{data.label}</span>
          <span className="text-xs text-gray-500">({data.language})</span>
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
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Language
                </label>
                <select
                  value={editLanguage}
                  onChange={(e) => setEditLanguage(e.target.value as any)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="jsonpath">JSONPath</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Condition
                </label>
                <textarea
                  value={editCondition}
                  onChange={(e) => setEditCondition(e.target.value)}
                  className="w-full p-2 text-sm font-mono border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Enter condition (e.g., input.value > 10)"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    True Label
                  </label>
                  <input
                    type="text"
                    value={editTrueLabel}
                    onChange={(e) => setEditTrueLabel(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="True"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    False Label
                  </label>
                  <input
                    type="text"
                    value={editFalseLabel}
                    onChange={(e) => setEditFalseLabel(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="False"
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={handleTest}
                  className="flex-1 px-3 py-1 text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded flex items-center justify-center space-x-1"
                >
                  <Play className="w-3 h-3" />
                  <span>Test</span>
                </button>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  onClick={handleCancel}
                  className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-2 py-1 text-xs bg-indigo-500 text-white hover:bg-indigo-600 rounded"
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
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Condition:</div>
                  <div className="p-2 bg-gray-100 rounded text-sm font-mono">
                    {data.condition || 'No condition set'}
                  </div>
                </div>

                <div className="flex justify-between text-xs text-gray-500">
                  <div>True: <span className="font-medium text-green-600">{data.trueLabel || 'True'}</span></div>
                  <div>False: <span className="font-medium text-red-600">{data.falseLabel || 'False'}</span></div>
                </div>

                {data.error && (
                  <div className="p-2 bg-red-100 border border-red-300 rounded text-xs text-red-700">
                    {data.error}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Output Handles */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '30%' }}
        className="w-3 h-3 bg-green-400 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: '70%' }}
        className="w-3 h-3 bg-red-400 border-2 border-white"
      />
    </motion.div>
  );
});

ConditionNode.displayName = 'ConditionNode';