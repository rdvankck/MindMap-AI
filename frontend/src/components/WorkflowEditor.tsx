import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { 
  Menu, 
  X, 
  Save, 
  Play, 
  Settings, 
  HelpCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

import FlowCanvasProvider from './FlowCanvas';
import NodePalette from './NodePalette';
import { useFlowStore, useAppStore } from '../store';
import { cn } from '../utils';

interface WorkflowEditorProps {
  workflowId?: string;
  onWorkflowChange?: (workflow: any) => void;
}

const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ 
  workflowId, 
  onWorkflowChange 
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  const {
    nodes,
    edges,
    isExecuting,
    validateFlow,
    startExecution,
    stopExecution,
    handleWebSocketMessage,
  } = useFlowStore();
  
  const { 
    user, 
    settings, 
    setLoading,
    currentWorkflow,
    setCurrentWorkflow 
  } = useAppStore();

  // Auto-save effect
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (nodes.length > 0) {
        handleAutoSave();
      }
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [nodes, edges]);

  // Handle auto-save
  const handleAutoSave = async () => {
    try {
      // Save current state to backend
      console.log('Auto-saving workflow...');
      // API call would go here
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  // Handle manual save
  const handleSave = async () => {
    try {
      setLoading(true, 'Saving workflow...');
      
      const validation = validateFlow();
      if (!validation.isValid) {
        toast.error('Cannot save: Workflow has errors', {
          description: validation.errors.join(', '),
        });
        return;
      }

      // Save workflow to backend
      const workflowData = {
        id: currentWorkflow?.id,
        name: currentWorkflow?.name || 'Untitled Workflow',
        description: currentWorkflow?.description || '',
        nodes,
        edges,
        metadata: {
          ...currentWorkflow?.metadata,
          lastSaved: new Date(),
          nodeCount: nodes.length,
          edgeCount: edges.length,
        },
      };

      // API call would go here
      console.log('Saving workflow:', workflowData);
      
      toast.success('Workflow saved successfully');
      onWorkflowChange?.(workflowData);
      
    } catch (error) {
      console.error('Failed to save workflow:', error);
      toast.error('Failed to save workflow');
    } finally {
      setLoading(false);
    }
  };

  // Handle execution
  const handleExecute = () => {
    const validation = validateFlow();
    if (!validation.isValid) {
      toast.error('Cannot execute: Workflow has errors', {
        description: validation.errors.join(', '),
      });
      return;
    }

    startExecution();
    toast.success('Workflow execution started');
  };

  // Handle stop execution
  const handleStopExecution = () => {
    stopExecution();
    toast.success('Workflow execution stopped');
  };

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      
      // Ctrl/Cmd + Enter to execute
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (isExecuting) {
          handleStopExecution();
        } else {
          handleExecute();
        }
      }
      
      // Escape to close modals
      if (e.key === 'Escape') {
        setShowSettings(false);
        setShowHelp(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExecuting, nodes, edges]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar with Node Palette */}
      <AnimatePresence>
        {!sidebarCollapsed && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="flex-shrink-0 z-10"
          >
            <NodePalette />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Sidebar Toggle */}
            <button
              onClick={toggleSidebar}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              )}
            </button>

            {/* Workflow Info */}
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {currentWorkflow?.name || 'Untitled Workflow'}
              </h1>
              <p className="text-sm text-gray-500">
                {currentWorkflow?.description || 'Create your LLM workflow'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Execution Controls */}
            <div className="flex items-center space-x-1 border-r border-gray-200 pr-3">
              {!isExecuting ? (
                <button
                  onClick={handleExecute}
                  className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center space-x-2"
                  title="Execute workflow (Ctrl+Enter)"
                >
                  <Play className="w-4 h-4" />
                  <span className="text-sm font-medium">Run</span>
                </button>
              ) : (
                <button
                  onClick={handleStopExecution}
                  className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center space-x-2"
                  title="Stop execution (Ctrl+Enter)"
                >
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-sm font-medium">Stop</span>
                </button>
              )}
            </div>

            {/* Save Control */}
            <button
              onClick={handleSave}
              className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2"
              title="Save workflow (Ctrl+S)"
            >
              <Save className="w-4 h-4" />
              <span className="text-sm font-medium">Save</span>
            </button>

            {/* Additional Controls */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  showSettings 
                    ? 'bg-gray-100 text-gray-900' 
                    : 'hover:bg-gray-100 text-gray-600'
                )}
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => setShowHelp(!showHelp)}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  showHelp 
                    ? 'bg-gray-100 text-gray-900' 
                    : 'hover:bg-gray-100 text-gray-600'
                )}
                title="Help"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative">
          <FlowCanvasProvider />
        </div>

        {/* Status Bar */}
        <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4 text-gray-600">
            <span>Nodes: {nodes.length}</span>
            <span>Edges: {edges.length}</span>
            {isExecuting && (
              <span className="flex items-center space-x-1 text-blue-600">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                <span>Executing...</span>
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-4 text-gray-500">
            <span>Auto-saved: Just now</span>
            {user && (
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>{user.name}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Workflow Settings</h2>
              {/* Settings content would go here */}
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Help & Shortcuts</h2>
              
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Keyboard Shortcuts</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Save workflow:</span>
                      <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Ctrl+S</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Execute/Stop:</span>
                      <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Ctrl+Enter</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Delete selection:</span>
                      <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Delete</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Copy selection:</span>
                      <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Ctrl+C</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Paste:</span>
                      <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Ctrl+V</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Horizontal scroll:</span>
                      <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Shift+Wheel</kbd>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setShowHelp(false)}
                  className="px-3 py-2 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded-lg"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkflowEditor;