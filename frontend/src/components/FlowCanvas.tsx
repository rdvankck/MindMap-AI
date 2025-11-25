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
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

import { useFlowStore, useAppStore } from '../store';
import { PromptNode, ResponseNode, BranchNode, ConditionNode, AggregationNode } from './nodes';
import { cn, generateId, debounce, isWorkflowValid } from '../utils';
import { Node as FlowNode, NodeStatus } from '../shared';

// Import styles
import 'reactflow/dist/style.css';

// Node types
const nodeTypes = {
  prompt: PromptNode,
  response: ResponseNode,
  branch: BranchNode,
  condition: ConditionNode,
  aggregation: AggregationNode,
};

// Minimap node colors
const minimapNodeColor = (node: Node) => {
  switch (node.type) {
    case 'prompt': return '#3b82f6';
    case 'response': return '#a855f7';
    case 'condition': return '#6366f1';
    case 'branch': return '#f97316';
    case 'aggregation': return '#14b8a6';
    default: return '#6b7280';
  }
};

const FlowCanvas: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const { fitView, getViewport } = useReactFlow();
  
  const {
    nodes: storeNodes,
    edges: storeEdges,
    selectedNodes,
    selectedEdges,
    isExecuting,
    showMinimap,
    snapToGrid,
    gridSpacing,
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
    loadWorkflow,
  } = useFlowStore();

  const { setLoading } = useAppStore();

  const [nodes, setNodesInternal, onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdgesInternal, onEdgesChange] = useEdgesState(storeEdges);

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
  }, []);

  // Handle connection creation
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      
      const newEdge = {
        id: generateId('edge'),
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#6b7280', strokeWidth: 2 },
      };
      
      addEdgeToStore(newEdge);
      setEdgesInternal((eds) => addEdge(newEdge, eds));
    },
    [addEdgeToStore, setEdgesInternal]
  );

  // Handle node changes
  const onNodesChangeInternal = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      
      // Update store based on changes
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          updateNode(change.id, { position: change.position });
        } else if (change.type === 'remove') {
          removeNode(change.id);
        }
      });
    },
    [onNodesChange, updateNode, removeNode]
  );

  // Handle edge changes
  const onEdgesChangeInternal = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      
      // Update store based on changes
      changes.forEach((change) => {
        if (change.type === 'remove') {
          removeEdge(change.id);
        }
      });
    },
    [onEdgesChange, removeEdge]
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

  // Handle drag over
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const position = reactFlowInstance?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      if (!position) return;

      const newNode: Node = {
        id: generateId(type),
        type,
        position,
        data: {
          label: `New ${type}`,
          status: 'idle' as NodeStatus,
        },
      };

      addNodeToStore(newNode);
    },
    [reactFlowInstance, addNodeToStore]
  );

  // Handle keyboard shortcuts
  const deletePressed = useKeyPress(['Delete', 'Backspace']);
  const copyPressed = useKeyPress(['c'], true); // Ctrl+C
  const pastePressed = useKeyPress(['v'], true); // Ctrl+V
  const savePressed = useKeyPress(['s'], true); // Ctrl+S
  const selectAllPressed = useKeyPress(['a'], true); // Ctrl+A

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
      clearSelection();
      setTimeout(() => {
        const allNodeIds = nodes.map(n => n.id);
        const allEdgeIds = edges.map(e => e.id);
        setSelection(allNodeIds, allEdgeIds);
      }, 0);
    }
  }, [selectAllPressed, nodes, edges, clearSelection, setSelection]);

  // Handle save
  const handleSave = useCallback(async () => {
    try {
      setLoading(true, 'Saving workflow...');
      
      const validation = validateFlow();
      if (!validation.isValid) {
        console.error('Workflow validation failed:', validation.errors);
        return;
      }

      // Save workflow to backend
      const workflowData = {
        nodes,
        edges,
        metadata: {
          lastSaved: new Date(),
          version: '1.0',
        },
      };

      // API call would go here
      console.log('Saving workflow:', workflowData);
      
    } catch (error) {
      console.error('Failed to save workflow:', error);
    } finally {
      setLoading(false);
    }
  }, [nodes, edges, validateFlow, setLoading]);

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

  // Handle horizontal scrolling
  const handleHorizontalScroll = useCallback((direction: 'left' | 'right') => {
    const scrollAmount = 2000; // Daha da artırılmış kaydırma miktarı
    const wrapper = reactFlowWrapper.current;
    if (wrapper) {
      const currentScroll = wrapper.scrollLeft;
      const targetScroll = direction === 'left' 
        ? currentScroll - scrollAmount 
        : currentScroll + scrollAmount;
      
      wrapper.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }
  }, []);

  // Handle vertical scrolling
  const handleVerticalScroll = useCallback((direction: 'up' | 'down') => {
    const scrollAmount = 2000; // Dikey kaydırma miktarı
    const wrapper = reactFlowWrapper.current;
    if (wrapper) {
      const currentScroll = wrapper.scrollTop;
      const targetScroll = direction === 'up' 
        ? currentScroll - scrollAmount 
        : currentScroll + scrollAmount;
      
      wrapper.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    }
  }, []);

  // Handle mouse wheel horizontal and vertical scrolling
  useEffect(() => {
    const wrapper = reactFlowWrapper.current;
    if (!wrapper) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        // Shift+Wheel için çok daha hızlı yatay kaydırma
        wrapper.scrollLeft += e.deltaY * 5;
      } else {
        // Normal wheel için hem yatay hem dikey kaydırma
        wrapper.scrollLeft += e.deltaX * 2;
        // Dikey kaydırma için wrapper'ın parent'ını kullan
        const parent = wrapper.parentElement;
        if (parent && e.deltaY !== 0) {
          e.preventDefault();
          parent.scrollTop += e.deltaY * 2;
        }
      }
    };

    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div className="w-full h-full relative overflow-auto" ref={reactFlowWrapper}>
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
        nodeTypes={nodeTypes}
        snapToGrid={snapToGrid}
        snapGrid={[gridSpacing, gridSpacing]}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        fitView={false}
        attributionPosition="bottom-left"
        className={cn(
          'bg-gray-50',
          snapToGrid && 'bg-grid'
        )}
        minZoom={0.01}
        maxZoom={5}
        panOnScroll={false}
        panOnDrag={true}
        panOnScrollMode="free"
        selectionOnDrag={false}
        connectOnDrag={false}
        elementsSelectable={true}
        draggable={true}
        maxBounds={{ x: 50000, y: 50000, width: 100000, height: 100000 }}
        style={{ 
          width: '500vw', 
          height: '500vh',
          minWidth: '50000px',
          minHeight: '50000px'
        }}
      >
        <Background 
          color="#e5e7eb" 
          gap={snapToGrid ? gridSpacing : 20}
          size={1}
        />
        
        <Controls
          className="bg-white border border-gray-200 rounded-lg shadow-lg"
          showZoom={true}
          showFitView={true}
          showInteractive={false}
        />

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
                className="bg-white border border-gray-200 rounded-lg shadow-lg"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toolbar */}
        <Panel position="top-left" className="bg-white border border-gray-200 rounded-lg shadow-lg p-2">
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
            <div className="flex items-center space-x-1">
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
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center space-x-1 border-l border-gray-200 pl-2">
              {/* Vertical Controls */}
              <div className="flex flex-col items-center space-y-1">
                <button
                  onClick={() => handleVerticalScroll('up')}
                  className="p-2 hover:bg-gray-100 rounded flex items-center space-x-1 text-gray-600"
                  title="Scroll up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleHorizontalScroll('left')}
                    className="p-2 hover:bg-gray-100 rounded flex items-center space-x-1 text-gray-600"
                    title="Scroll left (Shift + Wheel)"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleHorizontalScroll('right')}
                    className="p-2 hover:bg-gray-100 rounded flex items-center space-x-1 text-gray-600"
                    title="Scroll right (Shift + Wheel)"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => handleVerticalScroll('down')}
                  className="p-2 hover:bg-gray-100 rounded flex items-center space-x-1 text-gray-600"
                  title="Scroll down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </Panel>

        {/* Status Bar */}
        <Panel position="bottom-left" className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-1">
          <div className="flex items-center space-x-4 text-xs text-gray-600">
            <span>Nodes: {nodes.length}</span>
            <span>Edges: {edges.length}</span>
            <span>Selected: {selectedNodes.length + selectedEdges.length}</span>
            {isExecuting && (
              <span className="text-blue-600 flex items-center space-x-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                <span>Executing...</span>
              </span>
            )}
          </div>
        </Panel>

        {/* Help Panel */}
        <Panel position="top-right" className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-xs">
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
              <span>Horizontal Scroll:</span>
              <kbd className="px-1 py-0.5 bg-gray-100 rounded">Shift+Wheel</kbd>
            </div>
            <div className="flex justify-between">
              <span>Vertical Scroll:</span>
              <kbd className="px-1 py-0.5 bg-gray-100 rounded">Wheel</kbd>
            </div>
            <div className="flex justify-between">
              <span>Pan Canvas:</span>
              <kbd className="px-1 py-0.5 bg-gray-100 rounded">Drag</kbd>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

// Wrapper component with ReactFlowProvider
export const FlowCanvasProvider: React.FC = () => {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
};

export default FlowCanvasProvider;