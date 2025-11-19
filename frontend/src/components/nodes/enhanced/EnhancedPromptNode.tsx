import React, { memo, useCallback, useState, useEffect } from 'react';
import { NodeProps } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Edit3, Save, X, Zap, Clock, BarChart3 } from 'lucide-react';
import { NodeStatus } from '../shared';
import { EnhancedNodeBase } from './EnhancedNodeBase';
import { useFlowStore } from '../../store';
import { cn } from '../../utils/cn';

interface EnhancedPromptNodeData {
  label: string;
  prompt: string;
  template?: string;
  variables?: Record<string, any>;
  status: NodeStatus;
  error?: string;
  result?: any;
  executionTime?: number;
  tokenCount?: number;
  isLocked?: boolean;
  isCollapsed?: boolean;
  isDisabled?: boolean;
  metadata?: Record<string, any>;
}

export const EnhancedPromptNode = memo<NodeProps<EnhancedPromptNodeData>>(({ 
  id, 
  data, 
  selected 
}) => {
  const { updateNode } = useFlowStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.prompt || '');
  const [showTemplate, setShowTemplate] = useState(false);
  const [templateValue, setTemplateValue] = useState(data.template || '');

  // Update edit value when data changes
  useEffect(() => {
    setEditValue(data.prompt || '');
    setTemplateValue(data.template || '');
  }, [data.prompt, data.template]);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleSave = useCallback(() => {
    updateNode(id, { 
      data: { 
        ...data, 
        prompt: editValue,
        template: templateValue
      } 
    });
    setIsEditing(false);
  }, [id, data, editValue, templateValue, updateNode]);

  const handleCancel = useCallback(() => {
    setEditValue(data.prompt || '');
    setTemplateValue(data.template || '');
    setIsEditing(false);
  }, [data.prompt, data.template]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  const renderContent = () => {
    if (isEditing) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="space-y-3"
        >
          {/* Prompt Input */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Prompt Message
            </label>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full p-2 text-sm border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
              placeholder="Enter your prompt message..."
              autoFocus
            />
          </div>

          {/* Template Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-700">
                Template (Optional)
              </label>
              <button
                onClick={() => setShowTemplate(!showTemplate)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                {showTemplate ? 'Hide' : 'Show'}
              </button>
            </div>
            <AnimatePresence>
              {showTemplate && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <textarea
                    value={templateValue}
                    onChange={(e) => setTemplateValue(e.target.value)}
                    className="w-full p-2 text-sm border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Enter template (e.g., {{variable}})..."
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded transition-colors duration-200 flex items-center space-x-1"
            >
              <X className="w-3 h-3" />
              <span>Cancel</span>
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1 text-xs bg-blue-500 text-white hover:bg-blue-600 rounded transition-colors duration-200 flex items-center space-x-1"
            >
              <Save className="w-3 h-3" />
              <span>Save</span>
            </button>
          </div>
        </motion.div>
      );
    }

    return (
      <div className="space-y-3">
        {/* Prompt Display */}
        <div 
          className="text-sm text-gray-700 min-h-[60px] whitespace-pre-wrap cursor-text hover:bg-gray-50 p-2 rounded transition-colors duration-200"
          onClick={handleEdit}
        >
          {data.prompt || (
            <span className="text-gray-400 italic">Click to add prompt...</span>
          )}
        </div>

        {/* Template Display */}
        {data.template && (
          <div className="border-t pt-2">
            <div className="flex items-center space-x-1 mb-1">
              <div className="w-2 h-2 bg-purple-500 rounded-full" />
              <span className="text-xs font-medium text-gray-600">Template</span>
            </div>
            <div className="text-xs text-gray-600 bg-purple-50 p-2 rounded">
              {data.template}
            </div>
          </div>
        )}

        {/* Variables Display */}
        {data.variables && Object.keys(data.variables).length > 0 && (
          <div className="border-t pt-2">
            <div className="flex items-center space-x-1 mb-1">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs font-medium text-gray-600">Variables</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(data.variables).map(([key, value]) => (
                <span
                  key={key}
                  className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded"
                  title={String(value)}
                >
                  {key}: {typeof value === 'string' ? value.substring(0, 10) : String(value)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Execution Stats */}
        {(data.executionTime || data.tokenCount) && (
          <div className="border-t pt-2">
            <div className="flex items-center justify-between text-xs text-gray-600">
              {data.executionTime && (
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{data.executionTime}ms</span>
                </div>
              )}
              {data.tokenCount && (
                <div className="flex items-center space-x-1">
                  <BarChart3 className="w-3 h-3" />
                  <span>{data.tokenCount} tokens</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Result Preview */}
        {data.result && data.status === 'completed' && (
          <div className="border-t pt-2">
            <div className="flex items-center space-x-1 mb-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span className="text-xs font-medium text-gray-600">Result</span>
            </div>
            <div className="text-xs text-gray-700 bg-blue-50 p-2 rounded max-h-20 overflow-y-auto">
              {typeof data.result === 'string' 
                ? data.result.substring(0, 100) + (data.result.length > 100 ? '...' : '')
                : JSON.stringify(data.result, null, 2).substring(0, 100) + '...'
              }
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <EnhancedNodeBase
      id={id}
      data={data}
      selected={selected}
      nodeType="prompt"
      icon={<MessageSquare className="w-4 h-4 text-blue-600" />}
      statusColors={{
        idle: 'border-blue-300 bg-white',
        running: 'border-blue-500 bg-blue-50',
        completed: 'border-green-500 bg-green-50',
        error: 'border-red-500 bg-red-50',
        skipped: 'border-gray-400 bg-gray-50',
      }}
    >
      {renderContent()}
    </EnhancedNodeBase>
  );
});

EnhancedPromptNode.displayName = 'EnhancedPromptNode';