import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Square, 
  Save, 
  Download, 
  Upload,
  Settings,
  HelpCircle,
  Zap,
  Activity,
  MousePointer,
  Smartphone,
  Eye,
  EyeOff,
  Grid,
  Layers,
  Compass,
  RotateCcw,
  Lock,
  Unlock
} from 'lucide-react';
import { 
  EnhancedCanvasProvider,
  AdvancedMinimap,
  VisualFeedbackProvider,
  useVisualFeedback,
  AccessibilityProvider,
  ResponsiveCanvas,
  EnhancedPromptNode
} from '../index';
import { useFlowStore } from '../../store';
import { cn } from '../../utils/cn';

interface EnhancedWorkflowDemoProps {
  className?: string;
}

export const EnhancedWorkflowDemo: React.FC<EnhancedWorkflowDemoProps> = ({ className }) => {
  const { showSuccess, showError, showWarning, showInfo, showLoading } = useVisualFeedback();
  const { 
    nodes, 
    edges, 
    isExecuting, 
    showMinimap, 
    snapToGrid, 
    isLocked,
    startExecution,
    stopExecution,
    toggleMinimap,
    toggleSnapToGrid,
    toggleLock,
    addNode,
    validateFlow
  } = useFlowStore();

  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'presentation'>('edit');
  const [autoSave, setAutoSave] = useState(true);

  // Demo workflow creation
  const createDemoWorkflow = useCallback(() => {
    showInfo('Creating demo workflow...');
    
    // Add sample nodes
    const promptNodeId = addNode({
      type: 'prompt',
      position: { x: 100, y: 100 },
      data: {
        label: 'Welcome Message',
        prompt: 'Hello! How can I help you today?',
        status: 'idle',
      },
    });

    setTimeout(() => {
      showSuccess('Demo workflow created successfully!', 'You can now interact with the nodes and connections.');
    }, 500);
  }, [addNode, showInfo, showSuccess]);

  // Enhanced execution with visual feedback
  const handleExecute = useCallback(async () => {
    const validation = validateFlow();
    if (!validation.isValid) {
      showError('Workflow Validation Failed', validation.errors.join(', '));
      return;
    }

    showLoading('Starting workflow execution...');
    
    try {
      await startExecution();
      showSuccess('Workflow started', 'Nodes are now processing in sequence.');
    } catch (error) {
      showError('Execution Failed', error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }, [validateFlow, showLoading, startExecution, showSuccess, showError]);

  // Enhanced save with feedback
  const handleSave = useCallback(() => {
    showInfo('Saving workflow...');
    
    // Simulate save operation
    setTimeout(() => {
      showSuccess('Workflow saved successfully!', 'All changes have been persisted.');
    }, 1000);
  }, [showInfo, showSuccess]);

  // Keyboard shortcuts demonstration
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter: Execute workflow
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleExecute();
      }
      
      // Ctrl/Cmd + S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      
      // Ctrl/Cmd + Shift + M: Toggle minimap
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        toggleMinimap();
        showInfo('Minimap toggled', showMinimap ? 'Minimap hidden' : 'Minap visible');
      }
      
      // F1: Show help
      if (e.key === 'F1') {
        e.preventDefault();
        setShowHelp(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExecute, handleSave, toggleMinimap, showMinimap, showInfo]);

  return (
    <div className={cn('w-full h-screen flex flex-col bg-gray-50 dark:bg-gray-900', className)}>
      {/* Enhanced Toolbar */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 z-20"
      >
        <div className="flex items-center justify-between">
          {/* Left section - Logo and Title */}
          <div className="flex items-center space-x-3">
            <motion.div
              animate={{ rotate: isExecuting ? 360 : 0 }}
              transition={{ duration: 2, repeat: isExecuting ? Infinity : 0, ease: "linear" }}
            >
              <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </motion.div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Enhanced Node Editor
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Visual LLM Workflow Builder
              </p>
            </div>
          </div>

          {/* Center section - View Mode Controls */}
          <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {(['edit', 'preview', 'presentation'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded transition-colors duration-200',
                  viewMode === mode
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Right section - Actions */}
          <div className="flex items-center space-x-2">
            {/* Execution Controls */}
            <div className="flex items-center space-x-1 border-r border-gray-200 dark:border-gray-600 pr-2">
              {!isExecuting ? (
                <button
                  onClick={handleExecute}
                  className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors duration-200"
                  title="Execute workflow (Ctrl+Enter)"
                >
                  <Play className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={stopExecution}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200"
                  title="Stop execution"
                >
                  <Square className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* File Operations */}
            <div className="flex items-center space-x-1 border-r border-gray-200 dark:border-gray-600 pr-2">
              <button
                onClick={handleSave}
                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors duration-200"
                title="Save workflow (Ctrl+S)"
              >
                <Save className="w-5 h-5" />
              </button>
              <button
                className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
                title="Export workflow"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
                title="Import workflow"
              >
                <Upload className="w-5 h-5" />
              </button>
            </div>

            {/* View Controls */}
            <div className="flex items-center space-x-1">
              <button
                onClick={toggleMinimap}
                className={cn(
                  'p-2 rounded-lg transition-colors duration-200',
                  showMinimap
                    ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
                title="Toggle minimap (Ctrl+Shift+M)"
              >
                <Layers className="w-5 h-5" />
              </button>
              <button
                onClick={toggleSnapToGrid}
                className={cn(
                  'p-2 rounded-lg transition-colors duration-200',
                  snapToGrid
                    ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
                title="Toggle snap to grid"
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={toggleLock}
                className={cn(
                  'p-2 rounded-lg transition-colors duration-200',
                  isLocked
                    ? 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
                    : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
                title={isLocked ? 'Unlock canvas' : 'Lock canvas'}
              >
                {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
                title="Help (F1)"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Canvas Area */}
      <div className="flex-1 relative overflow-hidden">
        <AccessibilityProvider>
          <VisualFeedbackProvider>
            <ResponsiveCanvas>
              <EnhancedCanvasProvider
                showMinimap={showMinimap}
                showGrid={true}
                snapToGrid={snapToGrid}
                panOnDrag={!isLocked}
                zoomOnScroll={!isLocked}
                className="w-full h-full"
              />
            </ResponsiveCanvasProvider>
          </VisualFeedbackProvider>
        </AccessibilityProvider>

        {/* Demo Content Overlay */}
        {nodes.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="text-center max-w-md">
              <div className="mb-4">
                <Zap className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Welcome to Enhanced Node Editor
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create visual LLM workflows with advanced interactions and animations
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={createDemoWorkflow}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 pointer-events-auto"
              >
                Create Demo Workflow
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Enhanced Status Bar */}
      <motion.footer
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2"
      >
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            <span>Nodes: {nodes.length}</span>
            <span>Edges: {edges.length}</span>
            <span>Mode: {viewMode}</span>
            <span className="flex items-center space-x-1">
              <Activity className="w-3 h-3" />
              <span>{isExecuting ? 'Executing' : 'Ready'}</span>
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <Grid className="w-3 h-3" />
              <span>Grid: {snapToGrid ? 'On' : 'Off'}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Layers className="w-3 h-3" />
              <span>Minimap: {showMinimap ? 'On' : 'Off'}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Lock className="w-3 h-3" />
              <span>{isLocked ? 'Locked' : 'Unlocked'}</span>
            </span>
            {autoSave && (
              <span className="flex items-center space-x-1 text-green-600">
                <Save className="w-3 h-3" />
                <span>Auto-save enabled</span>
              </span>
            )}
          </div>
        </div>
      </motion.footer>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed top-16 right-4 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-30"
          >
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={autoSave}
                      onChange={(e) => setAutoSave(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Auto-save workflow
                    </span>
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Animation Speed
                  </label>
                  <select className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700">
                    <option>No animations</option>
                    <option>Slow</option>
                    <option>Normal</option>
                    <option>Fast</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Theme
                  </label>
                  <select className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700">
                    <option>Light</option>
                    <option>Dark</option>
                    <option>Auto</option>
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Panel */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Enhanced Node Editor Help
                  </h2>
                  <button
                    onClick={() => setShowHelp(false)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <EyeOff className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                  <div>
                    <h3 className="font-medium mb-2">Enhanced Features</h3>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Animated connection lines with data flow visualization</li>
                      <li>Interactive node states with hover effects</li>
                      <li>Advanced minimap with zoom controls</li>
                      <li>Responsive design for mobile and tablet</li>
                      <li>Accessibility features and keyboard navigation</li>
                      <li>Visual feedback system with toast notifications</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-2">Keyboard Shortcuts</h3>
                    <ul className="space-y-1">
                      <div className="flex justify-between">
                        <span>Execute workflow:</span>
                        <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl+Enter</kbd>
                      </div>
                      <div className="flex justify-between">
                        <span>Save workflow:</span>
                        <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl+S</kbd>
                      </div>
                      <div className="flex justify-between">
                        <span>Toggle minimap:</span>
                        <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl+Shift+M</kbd>
                      </div>
                      <div className="flex justify-between">
                        <span>Show help:</span>
                        <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">F1</kbd>
                      </div>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-2">Touch Gestures (Mobile)</h3>
                    <ul className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Smartphone className="w-4 h-4" />
                        <span>Single finger - Pan canvas</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MousePointer className="w-4 h-4" />
                        <span>Two fingers - Pinch to zoom</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Eye className="w-4 h-4" />
                        <span>Tap - Select nodes</span>
                      </div>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

EnhancedWorkflowDemo.displayName = 'EnhancedWorkflowDemo';