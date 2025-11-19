import React, { memo, useCallback, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GitBranch, 
  Plus, 
  Copy, 
  Trash2, 
  Edit,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { Node as FlowNode, NodeStatus } from '@/shared';
import { useFlowStore } from '@/store/flowStore';
import { cn } from '@/utils/cn';

interface Branch {
  id: string;
  name: string;
  condition?: string;
  color: string;
}

interface BranchNodeData {
  label: string;
  branches: Branch[];
  status: NodeStatus;
  error?: string;
  result?: any;
}

export const BranchNode = memo<NodeProps<BranchNodeData>>(({ id, data, selected }) => {
  const { updateNode, deleteNode, setSelection, addEdge } = useFlowStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editBranches, setEditBranches] = useState(data.branches);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setEditBranches([...data.branches]);
  }, [data.branches]);

  const handleSave = useCallback(() => {
    updateNode(id, { data: { ...data, branches: editBranches } });
    setIsEditing(false);
  }, [id, data, editBranches, updateNode]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditBranches([...data.branches]);
  }, [data.branches]);

  const handleAddBranch = useCallback(() => {
    const newBranch: Branch = {
      id: `branch-${Date.now()}`,
      name: `Branch ${editBranches.length + 1}`,
      color: `hsl(${editBranches.length * 60}, 70%, 60%)`,
    };
    setEditBranches([...editBranches, newBranch]);
  }, [editBranches]);

  const handleRemoveBranch = useCallback((branchId: string) => {
    setEditBranches(editBranches.filter(b => b.id !== branchId));
  }, [editBranches]);

  const handleUpdateBranch = useCallback((branchId: string, updates: Partial<Branch>) => {
    setEditBranches(editBranches.map(b => 
      b.id === branchId ? { ...b, ...updates } : b
    ));
  }, [editBranches]);

  const handleCopy = useCallback(() => {
    console.log('Copy branch node:', id);
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
        return 'border-orange-400 bg-orange-50';
    }
  }, []);

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className={cn(
        'relative min-w-[300px] rounded-lg border-2 shadow-lg transition-all duration-200',
        getStatusColor(data.status),
        selected && 'ring-2 ring-orange-500 ring-offset-2'
      )}
      onClick={() => setSelection([id], [])}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-orange-400 border-2 border-white"
      />

      {/* Node Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <GitBranch className="w-4 h-4 text-orange-600" />
          <span className="font-medium text-sm text-gray-900">{data.label}</span>
        </div>
        <div className="flex items-center space-x-1">
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
              {editBranches.map((branch, index) => (
                <div key={branch.id} className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: branch.color }}
                  />
                  <input
                    type="text"
                    value={branch.name}
                    onChange={(e) => handleUpdateBranch(branch.id, { name: e.target.value })}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Branch name"
                  />
                  <input
                    type="text"
                    value={branch.condition || ''}
                    onChange={(e) => handleUpdateBranch(branch.id, { condition: e.target.value })}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Condition (optional)"
                  />
                  <button
                    onClick={() => handleRemoveBranch(branch.id)}
                    className="p-1 hover:bg-red-100 rounded"
                    title="Remove branch"
                  >
                    <Trash2 className="w-3 h-3 text-red-600" />
                  </button>
                </div>
              ))}
              
              <button
                onClick={handleAddBranch}
                className="w-full px-3 py-2 text-sm bg-orange-100 text-orange-700 hover:bg-orange-200 rounded flex items-center justify-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Branch</span>
              </button>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  onClick={handleCancel}
                  className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-2 py-1 text-xs bg-orange-500 text-white hover:bg-orange-600 rounded"
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
              <div className="space-y-2">
                {data.branches.map((branch, index) => (
                  <div key={branch.id} className="flex items-center space-x-2 text-sm">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: branch.color }}
                    />
                    <span className="text-gray-700">{branch.name}</span>
                    {branch.condition && (
                      <span className="text-xs text-gray-500">({branch.condition})</span>
                    )}
                  </div>
                ))}
                {data.branches.length === 0 && (
                  <div className="text-sm text-gray-500 italic">No branches defined</div>
                )}
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

      {/* Output Handles */}
      <div className="absolute -right-1 top-0 bottom-0 flex flex-col justify-around py-12">
        {data.branches.map((branch, index) => {
          const position = ((index + 1) / (data.branches.length + 1)) * 100;
          return (
            <Handle
              key={branch.id}
              type="source"
              position={Position.Right}
              id={branch.id}
              style={{ 
                top: `${position}%`,
                backgroundColor: branch.color,
                border: '2px solid white'
              }}
              className="w-3 h-3"
            />
          );
        })}
      </div>
    </motion.div>
  );
});

BranchNode.displayName = 'BranchNode';