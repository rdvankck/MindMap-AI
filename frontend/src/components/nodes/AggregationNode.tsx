import React, { memo, useCallback, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Merge, 
  Plus, 
  Settings,
  Copy,
  Trash2,
  Edit,
  ArrowDown
} from 'lucide-react';
import { Node as FlowNode, NodeStatus } from '@/shared';
import { useFlowStore } from '@/store/flowStore';
import { cn } from '@/utils/cn';

interface AggregationStrategy {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const aggregationStrategies: AggregationStrategy[] = [
  {
    id: 'concatenate',
    name: 'Concatenate',
    description: 'Join all inputs together',
    icon: '➕'
  },
  {
    id: 'merge',
    name: 'Merge Objects',
    description: 'Merge all input objects',
    icon: '🔀'
  },
  {
    id: 'array',
    name: 'Create Array',
    description: 'Create array of all inputs',
    icon: '📋'
  },
  {
    id: 'latest',
    name: 'Latest',
    description: 'Use the most recent input',
    icon: '🕒'
  },
  {
    id: 'sum',
    name: 'Sum',
    description: 'Sum all numeric inputs',
    icon: 'Σ'
  },
  {
    id: 'average',
    name: 'Average',
    description: 'Average all numeric inputs',
    icon: 'x̄'
  }
];

interface AggregationNodeData {
  label: string;
  strategy: string;
  config: Record<string, any>;
  status: NodeStatus;
  error?: string;
  result?: any;
  inputCount: number;
}

export const AggregationNode = memo<NodeProps<AggregationNodeData>>(({ id, data, selected }) => {
  const { updateNode, deleteNode, setSelection } = useFlowStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editStrategy, setEditStrategy] = useState(data.strategy);
  const [editConfig, setEditConfig] = useState(data.config || {});

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setEditStrategy(data.strategy);
    setEditConfig(data.config || {});
  }, [data.strategy, data.config]);

  const handleSave = useCallback(() => {
    updateNode(id, { 
      data: { 
        ...data, 
        strategy: editStrategy,
        config: editConfig
      } 
    });
    setIsEditing(false);
  }, [id, data, editStrategy, editConfig, updateNode]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditStrategy(data.strategy);
    setEditConfig(data.config || {});
  }, [data.strategy, data.config]);

  const handleCopy = useCallback(() => {
    console.log('Copy aggregation node:', id);
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
        return 'border-teal-400 bg-teal-50';
    }
  }, []);

  const getStatusIcon = useCallback((status: NodeStatus) => {
    switch (status) {
      case 'running':
        return <Settings className="w-4 h-4 animate-spin text-blue-600" />;
      case 'completed':
        return <Plus className="w-4 h-4 text-green-600" />;
      case 'error':
        return <Plus className="w-4 h-4 text-red-600" />;
      case 'skipped':
        return <Plus className="w-4 h-4 text-gray-600" />;
      default:
        return <Merge className="w-4 h-4 text-teal-600" />;
    }
  }, []);

  const currentStrategy = aggregationStrategies.find(s => s.id === data.strategy) || aggregationStrategies[0];

  // Generate dynamic input handles based on inputCount
  const inputHandles = Array.from({ length: Math.max(data.inputCount || 2, 2) }, (_, i) => i);

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className={cn(
        'relative min-w-[280px] max-w-[400px] rounded-lg border-2 shadow-lg transition-all duration-200',
        getStatusColor(data.status),
        selected && 'ring-2 ring-teal-500 ring-offset-2'
      )}
      onClick={() => setSelection([id], [])}
    >
      {/* Input Handles - Dynamic */}
      {inputHandles.map((index) => {
        const position = ((index + 1) / (inputHandles.length + 1)) * 100;
        return (
          <Handle
            key={`input-${index}`}
            type="target"
            position={Position.Left}
            id={`input-${index}`}
            style={{ 
              top: `${position}%`,
            }}
            className="w-3 h-3 bg-teal-400 border-2 border-white"
          />
        );
      })}

      {/* Node Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Merge className="w-4 h-4 text-teal-600" />
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
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Aggregation Strategy
                </label>
                <div className="space-y-2">
                  {aggregationStrategies.map((strategy) => (
                    <label
                      key={strategy.id}
                      className="flex items-start space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="radio"
                        name="strategy"
                        value={strategy.id}
                        checked={editStrategy === strategy.id}
                        onChange={(e) => setEditStrategy(e.target.value)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{strategy.icon}</span>
                          <span className="text-sm font-medium">{strategy.name}</span>
                        </div>
                        <div className="text-xs text-gray-500">{strategy.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Number of Inputs
                </label>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={data.inputCount || 2}
                  onChange={(e) => updateNode(id, { 
                    data: { ...data, inputCount: parseInt(e.target.value) || 2 }
                  })}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
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
                  className="px-2 py-1 text-xs bg-teal-500 text-white hover:bg-teal-600 rounded"
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
              <div className="flex items-center space-x-3 mb-3">
                <div className="text-2xl">{currentStrategy.icon}</div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{currentStrategy.name}</div>
                  <div className="text-xs text-gray-500">{currentStrategy.description}</div>
                </div>
              </div>

              <div className="text-xs text-gray-500">
                {data.inputCount || 2} input{(data.inputCount || 2) > 1 ? 's' : ''}
              </div>

              {data.error && (
                <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-700">
                  {data.error}
                </div>
              )}

              {data.result !== undefined && (
                <div className="mt-2 p-2 bg-green-100 border border-green-300 rounded text-xs">
                  <div className="font-medium text-green-800 mb-1">Result:</div>
                  <div className="text-green-700 truncate">
                    {typeof data.result === 'object' 
                      ? JSON.stringify(data.result).substring(0, 100) + '...'
                      : String(data.result).substring(0, 100)
                    }
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Output Handle */}
      <div className="absolute -right-1 top-1/2 transform -translate-y-1/2">
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-teal-400 border-2 border-white"
        />
        <ArrowDown className="absolute -right-1 top-1/2 transform -translate-y-1/2 w-4 h-4 text-teal-600" />
      </div>
    </motion.div>
  );
});

AggregationNode.displayName = 'AggregationNode';