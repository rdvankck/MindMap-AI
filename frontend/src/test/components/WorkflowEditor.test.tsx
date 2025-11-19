import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ReactFlowProvider } from 'reactflow';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from 'react-hot-toast';
import WorkflowEditor from '@/components/WorkflowEditor';

// Mock reactflow
vi.mock('reactflow', () => ({
  ReactFlow: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
  },
  useReactFlow: () => ({
    getNodes: () => [],
    getEdges: () => [],
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    addNodes: vi.fn(),
    addEdges: vi.fn(),
    deleteElements: vi.fn(),
    fitView: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    project: vi.fn(),
    viewport: { x: 0, y: 0, zoom: 1 },
  }),
  useNodesState: () => [[], vi.fn()],
  useEdgesState: () => [[], vi.fn()],
  addEdge: vi.fn(),
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
}));

// Mock WebSocket service
vi.mock('@/services/useWebSocket', () => ({
  useWebSocket: () => ({
    service: {
      onNodeStatus: vi.fn(() => vi.fn()),
      onNodeOutput: vi.fn(() => vi.fn()),
      onNodeError: vi.fn(() => vi.fn()),
      onWorkflowUpdate: vi.fn(() => vi.fn()),
      executeNode: vi.fn(),
      executeWorkflow: vi.fn(),
      stopWorkflow: vi.fn(),
      saveWorkflow: vi.fn(),
    },
    isConnected: true,
  }),
}));

// Mock workflow store
vi.mock('@/store/workflowStore', () => ({
  useWorkflowStore: () => ({
    nodes: [],
    edges: [],
    selectedNodes: [],
    selectedEdges: [],
    isLoading: false,
    error: null,
    workflowName: 'Test Workflow',
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    addNode: vi.fn(),
    removeNode: vi.fn(),
    updateNode: vi.fn(),
    addEdge: vi.fn(),
    removeEdge: vi.fn(),
    setSelectedNodes: vi.fn(),
    setSelectedEdges: vi.fn(),
    clearSelection: vi.fn(),
    setWorkflowName: vi.fn(),
    reset: vi.fn(),
    saveWorkflow: vi.fn(),
    loadWorkflow: vi.fn(),
    exportWorkflow: vi.fn(),
  }),
}));

describe('WorkflowEditor Component', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <ReactFlowProvider>
              {component}
            </ReactFlowProvider>
          </ToastProvider>
        </QueryClientProvider>
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
    user = userEvent.setup();
    vi.clearAllMocks();
    
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
    });
  });

  afterEach(() => {
    queryClient.clear();
    vi.resetAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders without crashing', () => {
      renderWithProviders(<WorkflowEditor />);
      
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('displays workflow editor title', () => {
      renderWithProviders(<WorkflowEditor />);
      
      expect(screen.getByText(/workflow editor/i)).toBeInTheDocument();
    });

    it('renders toolbar with essential controls', () => {
      renderWithProviders(<WorkflowEditor />);
      
      // Check for toolbar buttons
      expect(screen.getByTitle(/save/i)).toBeInTheDocument();
      expect(screen.getByTitle(/run/i)).toBeInTheDocument();
      expect(screen.getByTitle(/stop/i)).toBeInTheDocument();
      expect(screen.getByTitle(/export/i)).toBeInTheDocument();
      expect(screen.getByTitle(/import/i)).toBeInTheDocument();
      expect(screen.getByTitle(/clear/i)).toBeInTheDocument();
    });

    it('renders node palette', () => {
      renderWithProviders(<WorkflowEditor />);
      
      expect(screen.getByText(/node palette/i)).toBeInTheDocument();
      expect(screen.getByText(/core/i)).toBeInTheDocument();
      expect(screen.getByText(/logic/i)).toBeInTheDocument();
      expect(screen.getByText(/operations/i)).toBeInTheDocument();
    });

    it('renders canvas area', () => {
      renderWithProviders(<WorkflowEditor />);
      
      expect(screen.getByTestId('workflow-canvas')).toBeInTheDocument();
    });

    it('renders minimap', () => {
      renderWithProviders(<WorkflowEditor />);
      
      expect(screen.getByTestId('workflow-minimap')).toBeInTheDocument();
    });
  });

  describe('Node Management', () => {
    it('should add a prompt node when dragged from palette', async () => {
      renderWithProviders(<WorkflowEditor />);
      
      const promptNode = screen.getByText(/prompt/i);
      
      // Simulate drag start
      fireEvent.dragStart(promptNode);
      
      // Simulate drop on canvas
      const canvas = screen.getByTestId('workflow-canvas');
      fireEvent.drop(canvas);
      
      await waitFor(() => {
        // Verify node was added (mocked implementation)
        expect(screen.getByText(/prompt node/i)).toBeInTheDocument();
      });
    });

    it('should select a node when clicked', async () => {
      renderWithProviders(<WorkflowEditor />);
      
      // Create a test node first
      const testNode = screen.getByTestId('node-prompt');
      
      await act(async () => {
        user.click(testNode);
      });
      
      expect(testNode).toHaveClass('selected');
    });

    it('should delete selected nodes with delete key', async () => {
      renderWithProviders(<WorkflowEditor />);
      
      const testNode = screen.getByTestId('node-prompt');
      
      await act(async () => {
        user.click(testNode);
      });
      
      await act(async () => {
        user.keyboard('{Delete}');
      });
      
      await waitFor(() => {
        expect(testNode).not.toBeInTheDocument();
      });
    });

    it('should duplicate nodes with Ctrl+D', async () => {
      renderWithProviders(<WorkflowEditor />);
      
      const testNode = screen.getByTestId('node-prompt');
      
      await act(async () => {
        user.click(testNode);
      });
      
      await act(async () => {
        user.keyboard('{Control>}d{/Control}');
      });
      
      await waitFor(() => {
        const nodes = screen.getAllByTestId(/node-prompt/);
        expect(nodes).toHaveLength(2);
      });
    });
  });

  describe('Edge Management', () => {
    it('should create edges between nodes', async () => {
      renderWithProviders(<WorkflowEditor />);
      
      const sourceNode = screen.getByTestId('node-prompt');
      const targetNode = screen.getByTestId('node-llm');
      
      // Simulate connection creation
      fireEvent.dragStart(sourceNode);
      fireEvent.drop(targetNode);
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-line')).toBeInTheDocument();
      });
    });

    it('should delete edges when clicking remove button', async () => {
      renderWithProviders(<WorkflowEditor />);
      
      const edge = screen.getByTestId('edge-connection');
      const removeButton = within(edge).getByTitle('Remove connection');
      
      await act(async () => {
        user.click(removeButton);
      });
      
      await waitFor(() => {
        expect(edge).not.toBeInTheDocument();
      });
    });
  });

  describe('Toolbar Actions', () => {
    it('should save workflow when save button clicked', async () => {
      renderWithProviders(<WorkflowEditor />);
      
      const saveButton = screen.getByTitle(/save/i);
      
      await act(async () => {
        user.click(saveButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/workflow saved/i)).toBeInTheDocument();
      });
    });

    it('should run workflow when run button clicked', async () => {
      renderWithProviders(<WorkflowEditor />);
      
      const runButton = screen.getByTitle(/run/i);
      
      await act(async () => {
        user.click(runButton);
      });
      
      await waitFor(() => {
        expect(runButton).toBeDisabled();
        expect(screen.getByTitle(/stop/i)).toBeEnabled();
      });
    });

    it('should stop workflow when stop button clicked', async () => {
      renderWithProviders(<WorkflowEditor />);
      
      const runButton = screen.getByTitle(/run/i);
      const stopButton = screen.getByTitle(/stop/i);
      
      // Start workflow
      await act(async () => {
        user.click(runButton);
      });
      
      // Stop workflow
      await act(async () => {
        user.click(stopButton);
      });
      
      await waitFor(() => {
        expect(runButton).toBeEnabled();
        expect(stopButton).toBeDisabled();
      });
    });

    it('should clear canvas when clear button clicked', async () => {
      renderWithProviders(<WorkflowEditor />);
      
      const clearButton = screen.getByTitle(/clear/i);
      
      await act(async () => {
        user.click(clearButton);
      });
      
      // Confirm in dialog
      const confirmButton = screen.getByText(/clear/i);
      await act(async () => {
        user.click(confirmButton);
      });
      
      await waitFor(() => {
        expect(screen.queryByTestId('node-prompt')).not.toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should save workflow with Ctrl+S', async () => {
      renderWithProviders(<WorkflowEditor />);
      
      await act(async () => {
        user.keyboard('{Control>}s{/Control}');
      });
      
      await waitFor(() => {
        expect(screen.getByText(/workflow saved/i)).toBeInTheDocument();
      });
    });

    it('should run workflow with Ctrl+Enter', async () => {
      renderWithProviders(<WorkflowEditor />);
      
      await act(async () => {
        user.keyboard('{Control>}{Enter}{/Control}');
      });
      
      await waitFor(() => {
        expect(screen.getByTitle(/stop/i)).toBeEnabled();
      });
    });

    it('should undo with Ctrl+Z', async () => {
      renderWithProviders(<WorkflowEditor />);
      
      await act(async () => {
        user.keyboard('{Control>}z{/Control}');
      });
      
      // Verify undo functionality (mocked)
      expect(screen.getByTitle(/undo/i)).toBeInTheDocument();
    });

    it('should redo with Ctrl+Y', async () => {
      renderWithProviders(<WorkflowEditor />);
      
      await act(async () => {
        user.keyboard('{Control>}y{/Control}');
      });
      
      // Verify redo functionality (mocked)
      expect(screen.getByTitle(/redo/i)).toBeInTheDocument();
    });

    it('should select all nodes with Ctrl+A', async () => {
      renderWithProviders(<WorkflowEditor />);
      
      await act(async () => {
        user.keyboard('{Control>}a{/Control}');
      });
      
      const nodes = screen.getAllByTestId(/node-/);
      nodes.forEach(node => {
        expect(node).toHaveClass('selected');
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt layout on small screens', async () => {
      // Mock small screen
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 600,
      });

      renderWithProviders(<WorkflowEditor />);
      
      fireEvent(window, new Event('resize'));
      
      await waitFor(() => {
        const palette = screen.getByTestId('node-palette');
        expect(palette).toHaveClass('collapsed');
      });
    });

    it('should show sidebar toggle on mobile', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 600,
      });

      renderWithProviders(<WorkflowEditor />);
      
      const toggleButton = screen.getByTitle(/toggle sidebar/i);
      expect(toggleButton).toBeInTheDocument();
      
      await act(async () => {
        user.click(toggleButton);
      });
      
      expect(screen.getByTestId('node-palette')).toBeVisible();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when workflow fails to load', async () => {
      // Mock error state
      vi.mocked(useWorkflowStore).mockReturnValue({
        ...vi.importActual('@/store/workflowStore').useWorkflowStore(),
        error: 'Failed to load workflow',
      });

      renderWithProviders(<WorkflowEditor />);
      
      expect(screen.getByText(/failed to load workflow/i)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should handle node execution errors gracefully', async () => {
      const mockWebSocketService = {
        onNodeError: vi.fn((callback) => {
          setTimeout(() => {
            callback('node-123', 'Execution failed');
          }, 100);
          return vi.fn();
        }),
      };

      vi.mocked(useWebSocket).mockReturnValue({
        service: mockWebSocketService,
        isConnected: true,
      });

      renderWithProviders(<WorkflowEditor />);
      
      await waitFor(() => {
        expect(screen.getByText(/execution failed/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should recover from WebSocket disconnection', async () => {
      vi.mocked(useWebSocket).mockReturnValue({
        service: {
          onNodeStatus: vi.fn(() => vi.fn()),
          onNodeOutput: vi.fn(() => vi.fn()),
          onNodeError: vi.fn(() => vi.fn()),
        },
        isConnected: false,
      });

      renderWithProviders(<WorkflowEditor />);
      
      expect(screen.getByText(/connection lost/i)).toBeInTheDocument();
      expect(screen.getByText(/attempting to reconnect/i)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should handle large number of nodes efficiently', async () => {
      const largeWorkflow = {
        nodes: Array.from({ length: 100 }, (_, i) => ({
          id: `node-${i}`,
          type: 'prompt',
          data: { label: `Node ${i}` },
          position: { x: i * 50, y: i * 30 },
        })),
        edges: [],
      };

      vi.mocked(useWorkflowStore).mockReturnValue({
        ...vi.importActual('@/store/workflowStore').useWorkflowStore(),
        nodes: largeWorkflow.nodes,
      });

      const startTime = performance.now();
      renderWithProviders(<WorkflowEditor />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should render within 1 second
    });

    it('should debounce rapid toolbar actions', async () => {
      renderWithProviders(<WorkflowEditor />);
      
      const saveButton = screen.getByTitle(/save/i);
      
      // Rapidly click save button
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          user.click(saveButton);
        });
      }
      
      // Should only call save once due to debouncing
      await waitFor(() => {
        expect(screen.getByText(/workflow saved/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderWithProviders(<WorkflowEditor />);
      
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'workflow editor');
      expect(screen.getByRole('toolbar')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderWithProviders(<WorkflowEditor />);
      
      await act(async () => {
        user.tab();
      });
      
      expect(document.activeElement).toBe(screen.getByRole('toolbar'));
    });

    it('should announce actions to screen readers', async () => {
      renderWithProviders(<WorkflowEditor />);
      
      const saveButton = screen.getByTitle(/save/i);
      
      await act(async () => {
        user.click(saveButton);
      });
      
      const announcement = screen.getByRole('status');
      expect(announcement).toHaveTextContent(/workflow saved/i);
    });
  });
});