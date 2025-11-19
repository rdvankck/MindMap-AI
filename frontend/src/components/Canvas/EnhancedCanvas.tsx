import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeChange,
  EdgeChange,
  SelectionChange,
  ReactFlowProvider,
  ReactFlowInstance,
  Panel,
  useReactFlow,
  useKeyPress,
  Viewport,
  CoordinateExtent,
} from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Square, 
  Save, 
  Download, 
  Upload,
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid,
  Layers,
  HelpCircle,
  Settings,
  RotateCcw,
  Compass,
  MousePointer,
  Hand,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Monitor,
  Fullscreen,
  FullscreenExit
} from 'lucide-react';

import { useFlowStore, useAppStore } from '../../store';
import { AnimatedConnection } from '../connections/AnimatedConnection';
import { EnhancedPromptNode } from '../nodes/enhanced/EnhancedPromptNode';
import { cn, generateId, debounce, isWorkflowValid } from '../../utils';

// Import styles
import 'reactflow/dist/style.css';

// Enhanced edge types
const edgeTypes = {
  animated: AnimatedConnection,
};

// Enhanced node types
const nodeTypes = {
  prompt: EnhancedPromptNode,
  // Add other enhanced node types as needed
};

interface EnhancedCanvasProps {
  className?: string;
  onNodeSelect?: (nodeId: string) => void;
  onEdgeSelect?: (edgeId: string) => void;
  onCanvasClick?: () => void;
  showMinimap?: boolean;
  showGrid?: boolean;
  snapToGrid?: boolean;
  gridSpacing?: number;
  panOnDrag?: boolean;
  zoomOnScroll?: boolean;
  zoomOnPinch?: boolean;
  preventScrolling?: boolean;
  connectionMode?: 'strict' | 'loose';
  fitView?: boolean;
  fitViewOptions?: {
    padding?: number;
    includeHiddenNodes?: boolean;
    minZoom?: number;
    maxZoom?: number;
  };
  attributionPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  style?: React.CSSProperties;
}

const EnhancedCanvas: React.FC<EnhancedCanvasProps> = ({
  className,
  onNodeSelect,
  onEdgeSelect,
  onCanvasClick,
  showMinimap: showMinimapProp,
  showGrid: showGridProp,
  snapToGrid: snapToGridProp,
  gridSpacing: gridSpacingProp = 20,
  panOnDrag = true,
  zoomOnScroll = true,
  zoomOnPinch = true,
  preventScrolling = true,
  connectionMode = 'loose',
  fitView: fitViewProp = true,
  fitViewOptions = {},
  attributionPosition = 'bottom-left',
  style,
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const { fitView, getViewport, zoomIn, zoomOut, setCenter, project } = useReactFlow();
  
  const {
    nodes: storeNodes,
    edges: storeEdges,
    selectedNodes,
    selectedEdges,
    isExecuting,
    showMinimap: showMinimapStore,
    snapToGrid: snapToGridStore,
    gridSpacing: gridSpacingStore,
    viewMode,
    isLocked,
    isFullscreen,
    setNodes,
    setEdges,
    addNode: addNodeToStore,
    addEdge: addEdgeToStore,
    updateNode,
    removeNode,
    removeEdge,
    setSelection,
    clearSelection,
    copySelection,
    pasteSelection,
    deleteSelection,
    startExecution,
    stopExecution,
    validateFlow,
    fitView: fitViewStore,
    centerContent,
    resetZoom,
    toggleMinimap,
    toggleSnapToGrid,
    toggleViewMode,
    toggleLock,
    toggleFullscreen,
    loadWorkflow,
  } = useFlowStore();

  const { setLoading, setTheme, theme } = useAppStore();

  const [nodes, setNodesInternal, onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdgesInternal, onEdgesChange] = useEdgesState(storeEdges);
  const [isPanning, setIsPanning] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [canvasBounds, setCanvasBounds] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [selectionBox, setSelectionBox] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);

  // Computed values
  const showMinimap = showMinimapProp ?? showMinimapStore;
  const showGrid = showGridProp ?? viewMode !== 'minimal';
  const snapToGrid = snapToGridProp ?? snapToGridStore;
  const gridSpacing = gridSpacingProp ?? gridSpacingStore;

  // Sync store state with React Flow state
  useEffect(() => {
    setNodes(storeNodes);
    setEdges(storeEdges);
  }, [storeNodes, storeEdges, setNodes, setEdges]);

  // Handle store updates
  useEffect(() => {
    setNodesInternal(nodes);
  }, [nodes, setNodesInternal]);

  useEffect(() => {
    setEdgesInternal(edges);
  }, [edges, setEdgesInternal]);

  // Initialize React Flow instance
  const onInit = useCallback((rfi: ReactFlowInstance) => {
    setReactFlowInstance(rfi);
    
    // Set canvas bounds
    const bounds = rfi.getBoundingClientRect();
    setCanvasBounds({
      x: 0,
      y: 0,
      width: bounds.width,
      height: bounds.height,
    });
  }, []);

  // Handle connection creation with enhanced data
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      
      // Determine connection type based on nodes
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);
      
      let connectionType = 'data';
      if (sourceNode?.type === 'condition' || targetNode?.type === 'condition') {
        connectionType = 'control';
      } else if (sourceNode?.type === 'branch' || targetNode?.type === 'branch') {
        connectionType = 'async';
      }
      
      const newEdge: Edge = {
        id: generateId('edge'),
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        type: 'animated',
        animated: true,
        style: { stroke: '#6b7280', strokeWidth: 2 },
        data: {
          connectionType,
          dataType: 'text',
          label: `${connectionType} flow`,
          animated: true,
          isActive: false,
        },
      };
      
      addEdgeToStore(newEdge);
      setEdgesInternal((eds) => addEdge(newEdge, eds));
    },
    [nodes, addEdgeToStore, setEdgesInternal]
  );

  // Handle node changes
  const onNodesChangeInternal = useCallback(
    (changes: NodeChange[]) => {
      if (isLocked) return;
      
      onNodesChange(changes);
      
      // Update store based on changes
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          updateNode(change.id, { position: change.position });
        } else if (change.type === 'remove') {
          removeNode(change.id);
        } else if (change.type === 'select' && change.selected) {
          onNodeSelect?.(change.id);
        }
      });
    },
    [onNodesChange, updateNode, removeNode, isLocked, onNodeSelect]
  );

  // Handle edge changes
  const onEdgesChangeInternal = useCallback(
    (changes: EdgeChange[]) => {
      if (isLocked) return;
      
      onEdgesChange(changes);
      
      // Update store based on changes
      changes.forEach((change) => {
        if (change.type === 'remove') {
          removeEdge(change.id);
        } else if (change.type === 'select' && change.selected) {
          onEdgeSelect?.(change.id);
        }
      });
    },
    [onEdgesChange, removeEdge, isLocked, onEdgeSelect]
  );

  // Handle selection
  const onSelectionChange = useCallback(
    (params: SelectionChange) => {
      const selectedNodeIds = params.nodes.map((n) => n.id);
      const selectedEdgeIds = params.edges.map((e) => e.id);
      setSelection(selectedNodeIds, selectedEdgeIds);
    },
    [setSelection]
  );

  // Handle canvas pane click
  const onPaneClick = useCallback(() => {
    clearSelection();
    onCanvasClick?.();
  }, [clearSelection, onCanvasClick]);

  // Handle drag over
  const onDragOver = useCallback((event: React.DragEvent) => {
    if (isLocked) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, [isLocked]);

  // Handle drop with enhanced positioning
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      if (isLocked) return;
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const position = reactFlowInstance?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      if (!position) return;

      // Snap to grid if enabled
      const snappedPosition = snapToGrid ? {
        x: Math.round(position.x / gridSpacing) * gridSpacing,
        y: Math.round(position.y / gridSpacing) * gridSpacing,
      } : position;

      const newNode: Node = {
        id: generateId(type),
        type,
        position: snappedPosition,
        data: {
          label: `New ${type}`,
          status: 'idle',
        },
      };

      addNodeToStore(newNode);
    },
    [reactFlowInstance, isLocked, snapToGrid, gridSpacing, addNodeToStore]
  );

  // Minimap node colors
  const minimapNodeColor = useCallback((node: Node) => {
    switch (node.type) {
      case 'prompt': return '#3b82f6';
      case 'response': return '#a855f7';
      case 'condition': return '#6366f1';
      case 'branch': return '#f97316';
      case 'aggregation': return '#14b8a6';
      default: return '#6b7280';
    }
  }, []);

  // Handle keyboard shortcuts
  const deletePressed = useKeyPress(['Delete', 'Backspace']);
  const copyPressed = useKeyPress(['c'], true);
  const pastePressed = useKeyPress(['v'], true);
  const savePressed = useKeyPress(['s'], true);
  const selectAllPressed = useKeyPress(['a'], true);
  const spacePressed = useKeyPress([' ']);
  const fPressed = useKeyPress(['f'], true);

  useEffect(() => {
    if (deletePressed && (selectedNodes.length > 0 || selectedEdges.length > 0)) {
      deleteSelection();
    }
  }, [deletePressed, selectedNodes, selectedEdges, deleteSelection]);

  useEffect(() => {
    if (copyPressed && (selectedNodes.length > 0 || selectedEdges.length > 0)) {
      copySelection();
    }
  }, [copyPressed, selectedNodes, selectedEdges, copySelection]);

  useEffect(() => {
    if (pastePressed) {
      const viewport = getViewport();
      pasteSelection({ 
        x: viewport.x + 200, 
        y: viewport.y + 200 
      });
    }
  }, [pastePressed, pasteSelection, getViewport]);

  useEffect(() => {
    if (savePressed) {
      handleSave();
    }
  }, [savePressed]);

  useEffect(() => {
    if (selectAllPressed) {
      const allNodeIds = nodes.map(n => n.id);
      const allEdgeIds = edges.map(e => e.id);
      setSelection(allNodeIds, allEdgeIds);
    }
  }, [selectAllPressed, nodes, edges, setSelection]);

  useEffect(() => {
    if (spacePressed) {
      setIsPanning(!isPanning);
    }
  }, [spacePressed, isPanning]);

  useEffect(() => {
    if (fPressed) {
      toggleFullscreen();
    }
  }, [fPressed, toggleFullscreen]);

  // Handle save
  const handleSave = useCallback(async () => {
    try {
      setLoading(true, 'Saving workflow...');
      
      const validation = validateFlow();
      if (!validation.isValid) {
        console.error('Workflow validation failed:', validation.errors);
        return;
      }

      const workflowData = {
        nodes,
        edges,
        metadata: {
          lastSaved: new Date(),
          version: '1.0',
          viewMode,
          gridSpacing,
        },
      };

      console.log('Saving workflow:', workflowData);
      
    } catch (error) {
      console.error('Failed to save workflow:', error);
    } finally {
      setLoading(false);
    }
  }, [nodes, edges, validateFlow, setLoading, viewMode, gridSpacing]);

  // Handle execution
  const handleExecute = useCallback(() => {
    if (isWorkflowValid(nodes, edges)) {
      startExecution();
    } else {
      console.error('Workflow is not valid for execution');
    }
  }, [nodes, edges, startExecution]);

  // Handle export
  const handleExport = useCallback(() => {
    const workflowData = {
      nodes,
      edges,
      metadata: {
        exported: new Date(),
        version: '1.0',
      },
    };
    
    const blob = new Blob([JSON.stringify(workflowData, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  // Handle import
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workflowData = JSON.parse(e.target?.result as string);
          loadWorkflow(workflowData);
        } catch (error) {
          console.error('Failed to import workflow:', error);
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  }, [loadWorkflow]);

  return (
    <div className={cn('w-full h-full relative', className)} ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeInternal}
        onEdgesChange={onEdgesChangeInternal}
        onConnect={onConnect}
        onInit={onInit}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onSelectionChange={onSelectionChange}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        snapToGrid={snapToGrid}
        snapGrid={[gridSpacing, gridSpacing]}
        panOnDrag={isPanning ? 1 : panOnDrag ? 0 : undefined}
        zoomOnScroll={zoomOnScroll}
        zoomOnPinch={zoomOnPinch}
        preventScrolling={preventScrolling}
        connectionMode={connectionMode}
        fitView={fitViewProp}
        fitViewOptions={fitViewOptions}
        attributionPosition={attributionPosition}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        className={cn(
          'bg-gray-50',
          showGrid && snapToGrid && 'bg-grid',
          theme === 'dark' && 'bg-gray-900',
          isLocked && 'pointer-events-none'
        )}
        style={style}
      >
        {/* Enhanced Background */}
        <Background 
          color={theme === 'dark' ? '#374151' : '#e5e7eb'} 
          gap={snapToGrid ? gridSpacing : 20}
          size={1}
          variant={theme === 'dark' ? 'dots' : 'lines'}
        />
        
        {/* Enhanced Controls */}
        <Controls
          className={cn(
            'bg-white border border-gray-200 rounded-lg shadow-lg',
            theme === 'dark' && 'bg-gray-800 border-gray-700'
          )}
          showZoom={true}
          showFitView={true}
          showInteractive={false}
        />

        {/* Enhanced Minimap */}
        <AnimatePresence>
          {showMinimap && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <MiniMap
                nodeColor={minimapNodeColor}
                nodeStrokeWidth={3}
                pannable
                zoomable
                className={cn(
                  'bg-white border border-gray-200 rounded-lg shadow-lg',
                  theme === 'dark' && 'bg-gray-800 border-gray-700'
                )}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Enhanced Toolbar */}
        <Panel position="top-left" className={cn(
          'bg-white border border-gray-200 rounded-lg shadow-lg p-2',
          theme === 'dark' && 'bg-gray-800 border-gray-700'
        )}>
          <div className="flex items-center space-x-2">
            {/* Execution Controls */}
            <div className="flex items-center space-x-1 border-r border-gray-200 pr-2">
              {!isExecuting ? (
                <button
                  onClick={handleExecute}
                  className="p-2 hover:bg-gray-100 rounded flex items-center space-x-1 text-green-600"
                  title="Run workflow"
                >
                  <Play className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={stopExecution}
                  className="p-2 hover:bg-gray-100 rounded flex items-center space-x-1 text-red-600"
                  title="Stop execution"
                >
                  <Square className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* File Operations */}
            <div className="flex items-center space-x-1 border-r border-gray-200 pr-2">
              <button
                onClick={handleSave}
                className="p-2 hover:bg-gray-100 rounded flex items-center space-x-1 text-blue-600"
                title="Save workflow (Ctrl+S)"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={handleExport}
                className="p-2 hover:bg-gray-100 rounded flex items-center space-x-1 text-gray-600"
                title="Export workflow"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={handleImport}
                className="p-2 hover:bg-gray-100 rounded flex items-center space-x-1 text-gray-600"
                title="Import workflow"
              >
                <Upload className="w-4 h-4" />
              </button>
            </div>

            {/* View Controls */}
            <div className="flex items-center space-x-1 border-r border-gray-200 pr-2">
              <button
                onClick={fitViewStore}
                className="p-2 hover:bg-gray-100 rounded flex items-center space-x-1 text-gray-600"
                title="Fit view"
              >
                <Maximize className="w-4 h-4" />
              </button>
              <button
                onClick={resetZoom}
                className="p-2 hover:bg-gray-100 rounded flex items-center space-x-1 text-gray-600"
                title="Reset zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={centerContent}
                className="p-2 hover:bg-gray-100 rounded flex items-center space-x-1 text-gray-600"
                title="Center content"
              >
                <Compass className="w-4 h-4" />
              </button>
            </div>

            {/* Canvas Controls */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setIsPanning(!isPanning)}
                className={cn(
                  'p-2 hover:bg-gray-100 rounded flex items-center space-x-1',
                  isPanning ? 'text-blue-600 bg-blue-50' : 'text-gray-600'
                )}
                title={isPanning ? 'Selection mode' : 'Pan mode (Space)'}
              >
                {isPanning ? <Hand className="w-4 h-4" /> : <MousePointer className="w-4 h-4" />}
              </button>
              <button
                onClick={toggleSnapToGrid}
                className={cn(
                  'p-2 hover:bg-gray-100 rounded flex items-center space-x-1',
                  snapToGrid ? 'text-blue-600 bg-blue-50' : 'text-gray-600'
                )}
                title="Toggle snap to grid"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={toggleMinimap}
                className={cn(
                  'p-2 hover:bg-gray-100 rounded flex items-center space-x-1',
                  showMinimap ? 'text-blue-600 bg-blue-50' : 'text-gray-600'
                )}
                title="Toggle minimap"
              >
                <Layers className="w-4 h-4" />
              </button>
              <button
                onClick={toggleLock}
                className={cn(
                  'p-2 hover:bg-gray-100 rounded flex items-center space-x-1',
                  isLocked ? 'text-yellow-600 bg-yellow-50' : 'text-gray-600'
                )}
                title={isLocked ? 'Unlock canvas' : 'Lock canvas'}
              >
                {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-2 hover:bg-gray-100 rounded flex items-center space-x-1 text-gray-600"
                title="Toggle fullscreen (F)"
              >
                {isFullscreen ? <FullscreenExit className="w-4 h-4" /> : <Fullscreen className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </Panel>

        {/* Enhanced Status Bar */}
        <Panel position="bottom-left" className={cn(
          'bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-1',
          theme === 'dark' && 'bg-gray-800 border-gray-700'
        )}>
          <div className="flex items-center space-x-4 text-xs text-gray-600">
            <span>Nodes: {nodes.length}</span>
            <span>Edges: {edges.length}</span>
            <span>Selected: {selectedNodes.length + selectedEdges.length}</span>
            <span>Mode: {isPanning ? 'Pan' : 'Select'}</span>
            <span>Grid: {snapToGrid ? `${gridSpacing}px` : 'Off'}</span>
            {isExecuting && (
              <span className="text-blue-600 flex items-center space-x-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                <span>Executing...</span>
              </span>
            )}
          </div>
        </Panel>

        {/* Enhanced Help Panel */}
        <Panel position="top-right" className={cn(
          'bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-xs',
          theme === 'dark' && 'bg-gray-800 border-gray-700'
        )}>
          <div className="flex items-center space-x-2 mb-2">
            <HelpCircle className="w-4 h-4 text-gray-600" />
            <span className="font-medium text-sm text-gray-900">Keyboard Shortcuts</span>
          </div>
          <div className="space-y-1 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Delete:</span>
              <kbd className="px-1 py-0.5 bg-gray-100 rounded">Delete</kbd>
            </div>
            <div className="flex justify-between">
              <span>Copy:</span>
              <kbd className="px-1 py-0.5 bg-gray-100 rounded">Ctrl+C</kbd>
            </div>
            <div className="flex justify-between">
              <span>Paste:</span>
              <kbd className="px-1 py-0.5 bg-gray-100 rounded">Ctrl+V</kbd>
            </div>
            <div className="flex justify-between">
              <span>Save:</span>
              <kbd className="px-1 py-0.5 bg-gray-100 rounded">Ctrl+S</kbd>
            </div>
            <div className="flex justify-between">
              <span>Select All:</span>
              <kbd className="px-1 py-0.5 bg-gray-100 rounded">Ctrl+A</kbd>
            </div>
            <div className="flex justify-between">
              <span>Pan Mode:</span>
              <kbd className="px-1 py-0.5 bg-gray-100 rounded">Space</kbd>
            </div>
            <div className="flex justify-between">
              <span>Fullscreen:</span>
              <kbd className="px-1 py-0.5 bg-gray-100 rounded">F</kbd>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

// Wrapper component with ReactFlowProvider
export const EnhancedCanvasProvider: React.FC<EnhancedCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <EnhancedCanvas {...props} />
    </ReactFlowProvider>
  );
};

export default EnhancedCanvasProvider;