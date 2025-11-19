import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Node, Edge, NodeStatus, Workflow, WebSocketMessage } from '../shared';

interface FlowState {
  // Flow data
  nodes: Node[];
  edges: Edge[];
  workflow?: Workflow;
  
  // UI state
  selectedNodes: string[];
  selectedEdges: string[];
  clipboard: { nodes: Node[]; edges: Edge[] } | null;
  
  // Interaction state
  isConnecting: boolean;
  isDragging: boolean;
  isPanning: boolean;
  
  // Execution state
  isExecuting: boolean;
  executionResults: Record<string, any>;
  nodeStatuses: Record<string, NodeStatus>;
  
  // View state
  viewport: { x: number; y: number; zoom: number };
  showMinimap: boolean;
  snapToGrid: boolean;
  gridSpacing: number;
  
  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  updateNode: (id: string, updates: Partial<Node>) => void;
  removeNode: (id: string) => void;
  
  addEdge: (edge: Edge) => void;
  updateEdge: (id: string, updates: Partial<Edge>) => void;
  removeEdge: (id: string) => void;
  
  setSelection: (nodeIds: string[], edgeIds: string[]) => void;
  clearSelection: () => void;
  selectAll: () => void;
  
  copySelection: () => void;
  pasteSelection: (position?: { x: number; y: number }) => void;
  deleteSelection: () => void;
  
  duplicateNode: (id: string, position?: { x: number; y: number }) => void;
  
  setWorkflow: (workflow: Workflow) => void;
  loadWorkflow: (workflow: Workflow) => void;
  
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  toggleMinimap: () => void;
  toggleSnapToGrid: () => void;
  
  startExecution: () => void;
  stopExecution: () => void;
  setNodeStatus: (nodeId: string, status: NodeStatus, result?: any) => void;
  clearExecutionResults: () => void;
  
  handleWebSocketMessage: (message: WebSocketMessage) => void;
  
  // Utility actions
  fitView: () => void;
  centerContent: () => void;
  resetZoom: () => void;
  
  // Validation
  validateFlow: () => { isValid: boolean; errors: string[] };
  findCycles: () => string[][];
  getConnectedNodes: (nodeId: string) => string[];
  getUpstreamNodes: (nodeId: string) => string[];
  getDownstreamNodes: (nodeId: string) => string[];
}

export const useFlowStore = create<FlowState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    nodes: [],
    edges: [],
    workflow: undefined,
    selectedNodes: [],
    selectedEdges: [],
    clipboard: null,
    isConnecting: false,
    isDragging: false,
    isPanning: false,
    isExecuting: false,
    executionResults: {},
    nodeStatuses: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    showMinimap: true,
    snapToGrid: false,
    gridSpacing: 20,

    // Node actions
    setNodes: (nodes) => {
      set({ nodes });
      
      // Clean up status for removed nodes
      const currentNodeIds = new Set(nodes.map(n => n.id));
      set((state) => {
        const newStatuses = { ...state.nodeStatuses };
        const newResults = { ...state.executionResults };
        
        Object.keys(newStatuses).forEach(id => {
          if (!currentNodeIds.has(id)) {
            delete newStatuses[id];
          }
        });
        
        Object.keys(newResults).forEach(id => {
          if (!currentNodeIds.has(id)) {
            delete newResults[id];
          }
        });
        
        return {
          nodeStatuses: newStatuses,
          executionResults: newResults,
        };
      });
    },

    setEdges: (edges) => set({ edges }),

    addNode: (node) => {
      set((state) => ({
        nodes: [...state.nodes, node],
      }));
    },

    updateNode: (id, updates) => {
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === id ? { ...node, ...updates } : node
        ),
      }));
    },

    removeNode: (id) => {
      set((state) => ({
        nodes: state.nodes.filter((node) => node.id !== id),
        edges: state.edges.filter((edge) => edge.source !== id && edge.target !== id),
        selectedNodes: state.selectedNodes.filter((nodeId) => nodeId !== id),
      }));
    },

    // Edge actions
    addEdge: (edge) => {
      set((state) => ({
        edges: [...state.edges, edge],
      }));
    },

    updateEdge: (id, updates) => {
      set((state) => ({
        edges: state.edges.map((edge) =>
          edge.id === id ? { ...edge, ...updates } : edge
        ),
      }));
    },

    removeEdge: (id) => {
      set((state) => ({
        edges: state.edges.filter((edge) => edge.id !== id),
        selectedEdges: state.selectedEdges.filter((edgeId) => edgeId !== id),
      }));
    },

    // Selection actions
    setSelection: (nodeIds, edgeIds) => {
      set({
        selectedNodes: nodeIds,
        selectedEdges: edgeIds,
      });
    },

    clearSelection: () => {
      set({
        selectedNodes: [],
        selectedEdges: [],
      });
    },

    selectAll: () => {
      const state = get();
      set({
        selectedNodes: state.nodes.map((node) => node.id),
        selectedEdges: state.edges.map((edge) => edge.id),
      });
    },

    // Clipboard actions
    copySelection: () => {
      const state = get();
      const selectedNodes = state.nodes.filter((node) =>
        state.selectedNodes.includes(node.id)
      );
      const selectedEdges = state.edges.filter((edge) =>
        state.selectedEdges.includes(edge.id)
      );

      set({
        clipboard: {
          nodes: selectedNodes,
          edges: selectedEdges,
        },
      });
    },

    pasteSelection: (position) => {
      const state = get();
      if (!state.clipboard) return;

      // Generate new IDs for copied nodes
      const idMap = new Map<string, string>();
      const newNodes = state.clipboard.nodes.map((node) => {
        const newId = `${node.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        idMap.set(node.id, newId);
        
        // Calculate offset position
        const offset = position ? {
          x: position.x - node.position.x,
          y: position.y - node.position.y,
        } : { x: 50, y: 50 };

        return {
          ...node,
          id: newId,
          position: {
            x: node.position.x + offset.x,
            y: node.position.y + offset.y,
          },
          data: { ...node.data },
        };
      });

      // Update edge IDs and connections
      const newEdges = state.clipboard.edges.map((edge) => ({
        ...edge,
        id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        source: idMap.get(edge.source) || edge.source,
        target: idMap.get(edge.target) || edge.target,
      }));

      set({
        nodes: [...state.nodes, ...newNodes],
        edges: [...state.edges, ...newEdges],
        selectedNodes: newNodes.map((node) => node.id),
        selectedEdges: newEdges.map((edge) => edge.id),
      });
    },

    deleteSelection: () => {
      const state = get();
      
      const newNodes = state.nodes.filter((node) => !state.selectedNodes.includes(node.id));
      const newEdges = state.edges.filter((edge) => 
        !state.selectedEdges.includes(edge.id) &&
        !state.selectedNodes.includes(edge.source) &&
        !state.selectedNodes.includes(edge.target)
      );

      set({
        nodes: newNodes,
        edges: newEdges,
        selectedNodes: [],
        selectedEdges: [],
      });
    },

    duplicateNode: (id, position) => {
      const state = get();
      const node = state.nodes.find((n) => n.id === id);
      if (!node) return;

      const newNode = {
        ...node,
        id: `${node.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        position: position || {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
        data: { ...node.data },
      };

      set((prevState) => ({
        nodes: [...prevState.nodes, newNode],
        selectedNodes: [newNode.id],
      }));
    },

    // Workflow actions
    setWorkflow: (workflow) => set({ workflow }),

    loadWorkflow: (workflow) => {
      set({
        workflow,
        nodes: workflow.nodes || [],
        edges: workflow.edges || [],
        selectedNodes: [],
        selectedEdges: [],
        executionResults: {},
        nodeStatuses: {},
      });
    },

    // View actions
    setViewport: (viewport) => set({ viewport }),

    toggleMinimap: () => set((state) => ({ showMinimap: !state.showMinimap })),

    toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),

    // Execution actions
    startExecution: () => {
      set({
        isExecuting: true,
        nodeStatuses: get().nodes.reduce((acc, node) => {
          acc[node.id] = 'idle';
          return acc;
        }, {} as Record<string, NodeStatus>),
        executionResults: {},
      });
    },

    stopExecution: () => {
      set({
        isExecuting: false,
      });
    },

    setNodeStatus: (nodeId, status, result) => {
      set((state) => ({
        nodeStatuses: {
          ...state.nodeStatuses,
          [nodeId]: status,
        },
        executionResults: result
          ? {
              ...state.executionResults,
              [nodeId]: result,
            }
          : state.executionResults,
      }));
    },

    clearExecutionResults: () => {
      set({
        executionResults: {},
        nodeStatuses: {},
      });
    },

    // WebSocket handler
    handleWebSocketMessage: (message) => {
      const state = get();
      
      switch (message.type) {
        case 'node.status':
          const { nodeId, status, result } = message.payload;
          state.setNodeStatus(nodeId, status, result);
          break;
          
        case 'node.output':
          const { nodeId: outputNodeId, output } = message.payload;
          state.setNodeStatus(outputNodeId, 'completed', { output });
          break;
          
        case 'node.error':
          const { nodeId: errorNodeId, error } = message.payload;
          state.setNodeStatus(errorNodeId, 'error', { error });
          state.updateNode(errorNodeId, {
            data: { ...state.nodes.find(n => n.id === errorNodeId)?.data, error },
          });
          break;
          
        case 'workflow.completed':
          set({ isExecuting: false });
          break;
          
        case 'workflow.failed':
          set({ isExecuting: false });
          break;
          
        default:
          console.log('Unhandled WebSocket message:', message);
      }
    },

    // Utility actions
    fitView: () => {
      // This would integrate with React Flow's fitView functionality
      // Implementation would be in the canvas component
    },

    centerContent: () => {
      set({ viewport: { x: 0, y: 0, zoom: 1 } });
    },

    resetZoom: () => {
      set((state) => ({
        viewport: { ...state.viewport, zoom: 1 },
      }));
    },

    // Validation
    validateFlow: () => {
      const state = get();
      const errors: string[] = [];

      // Check for nodes without required connections
      state.nodes.forEach((node) => {
        const hasInputConnection = state.edges.some((edge) => edge.target === node.id);
        const hasOutputConnection = state.edges.some((edge) => edge.source === node.id);

        // Example validation - adjust based on node types
        if (node.type !== 'input' && !hasInputConnection) {
          errors.push(`Node "${node.data.label}" has no input connection`);
        }
        if (node.type !== 'output' && !hasOutputConnection) {
          errors.push(`Node "${node.data.label}" has no output connection`);
        }
      });

      // Check for cycles
      const cycles = state.findCycles();
      if (cycles.length > 0) {
        errors.push(`Flow contains cycles: ${cycles.map(c => c.join(' → ')).join(', ')}`);
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    },

    findCycles: () => {
      const state = get();
      const graph = new Map<string, string[]>();
      
      // Build adjacency list
      state.edges.forEach((edge) => {
        if (!graph.has(edge.source)) {
          graph.set(edge.source, []);
        }
        graph.get(edge.source)!.push(edge.target);
      });

      const cycles: string[][] = [];
      const visited = new Set<string>();
      const recursionStack = new Set<string>();
      const path: string[] = [];

      const dfs = (nodeId: string): boolean => {
        if (recursionStack.has(nodeId)) {
          // Found a cycle
          const cycleStart = path.indexOf(nodeId);
          cycles.push([...path.slice(cycleStart), nodeId]);
          return true;
        }

        if (visited.has(nodeId)) {
          return false;
        }

        visited.add(nodeId);
        recursionStack.add(nodeId);
        path.push(nodeId);

        const neighbors = graph.get(nodeId) || [];
        for (const neighbor of neighbors) {
          if (dfs(neighbor)) {
            return true;
          }
        }

        recursionStack.delete(nodeId);
        path.pop();
        return false;
      };

      state.nodes.forEach((node) => {
        if (!visited.has(node.id)) {
          dfs(node.id);
        }
      });

      return cycles;
    },

    getConnectedNodes: (nodeId) => {
      const state = get();
      const connected = new Set<string>();
      
      state.edges.forEach((edge) => {
        if (edge.source === nodeId) {
          connected.add(edge.target);
        }
        if (edge.target === nodeId) {
          connected.add(edge.source);
        }
      });

      return Array.from(connected);
    },

    getUpstreamNodes: (nodeId) => {
      const state = get();
      const visited = new Set<string>();
      const upstream: string[] = [];

      const dfs = (currentId: string) => {
        if (visited.has(currentId)) return;
        visited.add(currentId);

        state.edges.forEach((edge) => {
          if (edge.target === currentId) {
            upstream.push(edge.source);
            dfs(edge.source);
          }
        });
      };

      dfs(nodeId);
      return upstream;
    },

    getDownstreamNodes: (nodeId) => {
      const state = get();
      const visited = new Set<string>();
      const downstream: string[] = [];

      const dfs = (currentId: string) => {
        if (visited.has(currentId)) return;
        visited.add(currentId);

        state.edges.forEach((edge) => {
          if (edge.source === currentId) {
            downstream.push(edge.target);
            dfs(edge.target);
          }
        });
      };

      dfs(nodeId);
      return downstream;
    },
  }))
);

// Subscribe to state changes and save to localStorage
if (typeof window !== 'undefined') {
  useFlowStore.subscribe(
    (state) => ({
      nodes: state.nodes,
      edges: state.edges,
      viewport: state.viewport,
    }),
    (persistedState) => {
      localStorage.setItem(
        'flow-state',
        JSON.stringify(persistedState)
      );
    }
  );
}

// Load persisted state on startup
const loadPersistedState = () => {
  if (typeof window === 'undefined') return;

  try {
    const persisted = localStorage.getItem('flow-state');
    if (persisted) {
      const { nodes, edges, viewport } = JSON.parse(persisted);
      const state = useFlowStore.getState();
      state.setNodes(nodes || []);
      state.setEdges(edges || []);
      state.setViewport(viewport || { x: 0, y: 0, zoom: 1 });
    }
  } catch (error) {
    console.warn('Failed to load persisted flow state:', error);
  }
};

// Initialize persisted state
if (typeof window !== 'undefined') {
  loadPersistedState();
}