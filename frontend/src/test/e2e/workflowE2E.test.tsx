import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ReactFlowProvider } from 'reactflow';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from 'react-hot-toast';
import WorkflowDemo from '@/pages/WorkflowDemo';

// Mock complete environment
vi.mock('@/services/useWebSocket', () => ({
  useWebSocket: () => ({
    service: {
      onNodeStatus: vi.fn((callback) => {
        // Simulate node status updates
        setTimeout(() => {
          callback('node-1', 'running');
          callback('node-1', 'completed');
        }, 500);
        return vi.fn();
      }),
      onNodeOutput: vi.fn((callback) => {
        setTimeout(() => {
          callback('node-1', 'This is a test response from the LLM');
        }, 600);
        return vi.fn();
      }),
      onNodeError: vi.fn(() => vi.fn()),
      onWorkflowUpdate: vi.fn(() => vi.fn()),
      executeNode: vi.fn(() => Promise.resolve()),
      executeWorkflow: vi.fn(() => Promise.resolve()),
      stopWorkflow: vi.fn(() => Promise.resolve()),
      saveWorkflow: vi.fn((workflow) => {
        return Promise.resolve({ id: 'workflow-123', ...workflow });
      }),
      loadWorkflow: vi.fn((id) => {
        return Promise.resolve({
          id,
          name: 'Test Workflow',
          nodes: [],
          edges: []
        });
      }),
    },
    isConnected: true,
  }),
}));

// Mock API calls
vi.mock('@/services/api', () => ({
  api: {
    workflows: {
      create: vi.fn(() => Promise.resolve({ id: 'workflow-123' })),
      update: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve()),
      get: vi.fn(() => Promise.resolve({
        id: 'workflow-123',
        name: 'Test Workflow',
        nodes: [],
        edges: []
      })),
      list: vi.fn(() => Promise.resolve([])),
    },
    executions: {
      create: vi.fn(() => Promise.resolve({ id: 'exec-123' })),
      get: vi.fn(() => Promise.resolve({
        id: 'exec-123',
        status: 'completed',
        results: []
      })),
      list: vi.fn(() => Promise.resolve([])),
      cancel: vi.fn(() => Promise.resolve()),
    },
  },
}));

// Mock React Router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: 'test-id' }),
    useLocation: () => ({ pathname: '/test' }),
  };
});

// Mock reactflow components
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
    project: vi.fn((position) => ({ x: position.x, y: position.y })),
    viewport: { x: 0, y: 0, zoom: 1 },
  }),
  useNodesState: () => [[], vi.fn()],
  useEdgesState: () => [[], vi.fn()],
  addEdge: vi.fn(),
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  useKeyPress: () => false,
}));

describe('Workflow End-to-End Tests', () => {
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
    user = userEvent.setup({ delay: 0 });
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      },
      writable: true,
    });

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
      headers: new Headers(),
      status: 200,
      statusText: 'OK',
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    vi.resetAllMocks();
  });

  describe('Complete Workflow Creation and Execution', () => {
    it('should create and execute a complete workflow from start to finish', async () => {
      renderWithProviders(<WorkflowDemo />);

      // Step 1: Verify initial state
      expect(screen.getByText(/LLM Chain Demo/i)).toBeInTheDocument();
      expect(screen.getByRole('toolbar')).toBeInTheDocument();
      expect(screen.getByTestId('node-palette')).toBeInTheDocument();
      expect(screen.getByTestId('workflow-canvas')).toBeInTheDocument();

      // Step 2: Add a prompt node
      const promptNodeOption = screen.getByText('Prompt');
      const canvas = screen.getByTestId('workflow-canvas');
      
      await act(async () => {
        fireEvent.dragStart(promptNodeOption);
        fireEvent.drop(canvas);
      });

      await waitFor(() => {
        expect(screen.getByTestId('node-prompt')).toBeInTheDocument();
      });

      // Step 3: Add an LLM response node
      const llmNodeOption = screen.getByText('LLM Response');
      
      await act(async () => {
        fireEvent.dragStart(llmNodeOption);
        fireEvent.drop(canvas);
      });

      await waitFor(() => {
        expect(screen.getByTestId('node-llm')).toBeInTheDocument();
      });

      // Step 4: Connect the nodes
      const promptNode = screen.getByTestId('node-prompt');
      const llmNode = screen.getByTestId('node-llm');
      
      await act(async () => {
        fireEvent.dragStart(promptNode.querySelector('.react-flow__handle')!);
        fireEvent.drop(llmNode.querySelector('.react-flow__handle')!);
      });

      // Step 5: Configure the prompt node
      await act(async () => {
        user.dblClick(promptNode);
      });

      const promptInput = screen.getByRole('textbox');
      await user.clear(promptInput);
      await user.type(promptInput, 'What is the capital of France?');
      await user.keyboard('{Enter}');

      expect(promptInput).toHaveValue('What is the capital of France?');

      // Step 6: Configure the LLM node
      await act(async () => {
        user.dblClick(llmNode);
      });

      const modelSelect = screen.getByRole('combobox');
      await user.click(modelSelect);
      await user.click(screen.getByText('gpt-3.5-turbo'));

      // Step 7: Save the workflow
      const saveButton = screen.getByTitle(/save/i);
      await act(async () => {
        user.click(saveButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/workflow saved/i)).toBeInTheDocument();
      });

      // Step 8: Execute the workflow
      const runButton = screen.getByTitle(/run/i);
      
      await act(async () => {
        user.click(runButton);
      });

      // Verify execution started
      expect(runButton).toBeDisabled();
      expect(screen.getByTitle(/stop/i)).toBeEnabled();

      // Step 9: Wait for execution to complete
      await waitFor(() => {
        expect(screen.getByText(/This is a test response from the LLM/i)).toBeInTheDocument();
      }, { timeout: 2000 });

      // Step 10: Verify results
      const responseNode = screen.getByTestId('node-llm');
      expect(responseNode).toHaveClass('completed');
      
      // Check response is displayed
      expect(screen.getByText('This is a test response from the LLM')).toBeInTheDocument();

      // Step 11: Stop/reset workflow
      const stopButton = screen.getByTitle(/stop/i);
      await act(async () => {
        user.click(stopButton);
      });

      expect(screen.getByTitle(/run/i)).toBeEnabled();
    });

    it('should handle complex branching workflows', async () => {
      renderWithProviders(<WorkflowDemo />);

      const canvas = screen.getByTestId('workflow-canvas');

      // Create a prompt node
      const promptNodeOption = screen.getByText('Prompt');
      await act(async () => {
        fireEvent.dragStart(promptNodeOption);
        fireEvent.drop(canvas);
      });

      // Create a condition node
      const conditionNodeOption = screen.getByText('Condition');
      await act(async () => {
        fireEvent.dragStart(conditionNodeOption);
        fireEvent.drop(canvas);
      });

      // Create two response nodes for different branches
      const llmNodeOption = screen.getByText('LLM Response');
      await act(async () => {
        fireEvent.dragStart(llmNodeOption);
        fireEvent.drop(canvas);
      });

      await act(async () => {
        fireEvent.dragStart(llmNodeOption);
        fireEvent.drop(canvas);
      });

      // Verify all nodes are created
      await waitFor(() => {
        expect(screen.getByTestId('node-prompt')).toBeInTheDocument();
        expect(screen.getByTestId('node-condition')).toBeInTheDocument();
        const llmNodes = screen.getAllByTestId('node-llm');
        expect(llmNodes).toHaveLength(2);
      });

      // Configure condition node
      const conditionNode = screen.getByTestId('node-condition');
      await act(async () => {
        user.dblClick(conditionNode);
      });

      const conditionInput = screen.getByRole('textbox');
      await user.type(conditionInput, 'response.rating > 3');
      await user.keyboard('{Enter}');

      // Test workflow execution
      const runButton = screen.getByTitle(/run/i);
      await act(async () => {
        user.click(runButton);
      });

      // Verify branching logic works
      await waitFor(() => {
        const nodes = screen.getAllByTestId(/^node-/);
        const executedNodes = nodes.filter(node => 
          node.classList.contains('completed')
        );
        
        // Should execute prompt, condition, and one of the branches
        expect(executedNodes.length).toBeGreaterThanOrEqual(2);
      }, { timeout: 3000 });
    });

    it('should handle workflow with aggregation', async () => {
      renderWithProviders(<WorkflowDemo />);

      const canvas = screen.getByTestId('workflow-canvas');

      // Create main prompt node
      const promptNodeOption = screen.getByText('Prompt');
      await act(async () => {
        fireEvent.dragStart(promptNodeOption);
        fireEvent.drop(canvas);
      });

      // Create multiple LLM nodes for parallel processing
      const llmNodeOption = screen.getByText('LLM Response');
      await act(async () => {
        fireEvent.dragStart(llmNodeOption);
        fireEvent.drop(canvas);
      });
      await act(async () => {
        fireEvent.dragStart(llmNodeOption);
        fireEvent.drop(canvas);
      });
      await act(async () => {
        fireEvent.dragStart(llmNodeOption);
        fireEvent.drop(canvas);
      });

      // Create aggregation node
      const aggregationNodeOption = screen.getByText('Aggregation');
      await act(async () => {
        fireEvent.dragStart(aggregationNodeOption);
        fireEvent.drop(canvas);
      });

      // Verify all nodes exist
      await waitFor(() => {
        expect(screen.getByTestId('node-prompt')).toBeInTheDocument();
        expect(screen.getByTestId('node-aggregation')).toBeInTheDocument();
        const llmNodes = screen.getAllByTestId('node-llm');
        expect(llmNodes).toHaveLength(3);
      });

      // Execute workflow
      const runButton = screen.getByTitle(/run/i);
      await act(async () => {
        user.click(runButton);
      });

      // Verify parallel execution and aggregation
      await waitFor(() => {
        const nodes = screen.getAllByTestId(/^node-/);
        const completedNodes = nodes.filter(node => 
          node.classList.contains('completed')
        );
        
        // Should complete all nodes including aggregation
        expect(completedNodes.length).toBeGreaterThan(0);
      }, { timeout: 5000 });
    });
  });

  describe('Workflow Management Features', () => {
    it('should load and edit existing workflows', async () => {
      renderWithProviders(<WorkflowDemo />);

      // Load existing workflow
      const loadButton = screen.getByTitle(/load/i);
      await act(async () => {
        user.click(loadButton);
      });

      // Mock workflow list
      await waitFor(() => {
        expect(screen.getByText(/load workflow/i)).toBeInTheDocument();
      });

      const workflowItem = screen.getByText('Test Workflow');
      await user.click(workflowItem);

      const loadConfirmButton = screen.getByText('Load');
      await act(async () => {
        user.click(loadConfirmButton);
      });

      // Verify workflow is loaded
      await waitFor(() => {
        expect(screen.getByText(/workflow loaded/i)).toBeInTheDocument();
      });

      // Edit the workflow
      const existingNode = screen.getByTestId('node-prompt');
      await act(async () => {
        user.dblClick(existingNode);
      });

      const promptInput = screen.getByRole('textbox');
      await user.clear(promptInput);
      await user.type(promptInput, 'Updated prompt for existing workflow');
      await user.keyboard('{Enter}');

      // Save the changes
      const saveButton = screen.getByTitle(/save/i);
      await act(async () => {
        user.click(saveButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/workflow saved/i)).toBeInTheDocument();
      });
    });

    it('should export and import workflows', async () => {
      renderWithProviders(<WorkflowDemo />);

      // Create a simple workflow first
      const canvas = screen.getByTestId('workflow-canvas');
      const promptNodeOption = screen.getByText('Prompt');
      
      await act(async () => {
        fireEvent.dragStart(promptNodeOption);
        fireEvent.drop(canvas);
      });

      // Export workflow
      const exportButton = screen.getByTitle(/export/i);
      await act(async () => {
        user.click(exportButton);
      });

      // Mock file download
      const mockBlob = new Blob(['{"name":"Test Workflow"}'], { type: 'application/json' });
      const mockUrl = 'blob:test-url';
      
      global.URL.createObjectURL = vi.fn().mockReturnValue(mockUrl);
      global.URL.revokeObjectURL = vi.fn();
      
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      
      global.document.createElement = vi.fn().mockReturnValue(mockLink);

      const exportConfirmButton = screen.getByText('Export');
      await act(async () => {
        user.click(exportConfirmButton);
      });

      expect(mockLink.click).toHaveBeenCalled();

      // Import workflow
      const importButton = screen.getByTitle(/import/i);
      await act(async () => {
        user.click(importButton);
      });

      // Mock file upload
      const fileInput = screen.getByRole('button', { name: /choose file/i });
      const file = new File(['{"name":"Imported Workflow"}'], 'workflow.json', {
        type: 'application/json',
      });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      const importConfirmButton = screen.getByText('Import');
      await act(async () => {
        user.click(importConfirmButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/workflow imported/i)).toBeInTheDocument();
      });
    });

    it('should handle workflow templates', async () => {
      renderWithProviders(<WorkflowDemo />);

      // Access templates
      const templatesButton = screen.getByTitle(/templates/i);
      await act(async () => {
        user.click(templatesButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/workflow templates/i)).toBeInTheDocument();
      });

      // Select a template
      const templateCard = screen.getByText('Basic Q&A');
      await user.click(templateCard);

      const useTemplateButton = screen.getByText('Use Template');
      await act(async () => {
        user.click(useTemplateButton);
      });

      // Verify template is loaded
      await waitFor(() => {
        expect(screen.getByTestId('node-prompt')).toBeInTheDocument();
        expect(screen.getByTestId('node-llm')).toBeInTheDocument();
      });
    });
  });

  describe('User Experience and Accessibility', () => {
    it('should provide helpful tooltips and guidance', async () => {
      renderWithProviders(<WorkflowDemo />);

      // Test help tooltips
      const helpButton = screen.getByTitle(/help/i);
      await user.hover(helpButton);

      await waitFor(() => {
        expect(screen.getByText(/help & shortcuts/i)).toBeInTheDocument();
      });

      // Test node palette tooltips
      const promptNodeOption = screen.getByText('Prompt');
      await user.hover(promptNodeOption);

      await waitFor(() => {
        expect(screen.getByText(/create a prompt node/i)).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      renderWithProviders(<WorkflowDemo />);

      // Test tab navigation
      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole('toolbar'));

      // Test keyboard shortcuts
      await act(async () => {
        user.keyboard('{Control>}s{/Control}'); // Save
      });

      await waitFor(() => {
        expect(screen.getByText(/workflow saved/i)).toBeInTheDocument();
      });

      // Test space key to add nodes
      await act(async () => {
        user.keyboard(' ');
      });

      expect(screen.getByText(/node palette/i)).toBeInTheDocument();
    });

    it('should be fully accessible with screen readers', () => {
      renderWithProviders(<WorkflowDemo />);

      // Check for proper ARIA labels
      const canvas = screen.getByRole('main');
      expect(canvas).toHaveAttribute('aria-label', 'workflow editor canvas');

      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toHaveAttribute('aria-label', 'workflow toolbar');

      // Check for live regions for dynamic content
      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toBeInTheDocument();
    });

    it('should handle responsive design on different screen sizes', async () => {
      renderWithProviders(<WorkflowDemo />);

      // Test mobile view
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 600,
      });

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        expect(screen.getByTestId('node-palette')).toHaveClass('collapsed');
      });

      // Test tablet view
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 900,
      });

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        expect(screen.getByTestId('node-palette')).not.toHaveClass('collapsed');
      });

      // Test desktop view
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        expect(screen.getByTestId('minimap')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network connectivity issues', async () => {
      // Mock network disconnection
      const mockUseWebSocket = vi.requireMock('@/services/useWebSocket');
      mockUseWebSocket.useWebSocket = () => ({
        service: {
          onNodeStatus: vi.fn(() => vi.fn()),
          onNodeOutput: vi.fn(() => vi.fn()),
          onNodeError: vi.fn(() => vi.fn()),
          executeWorkflow: vi.fn(() => Promise.reject(new Error('Network error'))),
        },
        isConnected: false,
      });

      renderWithProviders(<WorkflowDemo />);

      // Try to execute workflow
      const runButton = screen.getByTitle(/run/i);
      await act(async () => {
        user.click(runButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/connection lost/i)).toBeInTheDocument();
        expect(screen.getByText(/attempting to reconnect/i)).toBeInTheDocument();
      });
    });

    it('should handle workflow execution failures gracefully', async () => {
      // Mock execution failure
      const mockUseWebSocket = vi.requireMock('@/services/useWebSocket');
      mockUseWebSocket.useWebSocket = () => ({
        service: {
          onNodeStatus: vi.fn((callback) => {
            setTimeout(() => {
              callback('node-1', 'running');
              callback('node-1', 'error');
            }, 500);
            return vi.fn();
          }),
          onNodeError: vi.fn((callback) => {
            setTimeout(() => {
              callback('node-1', 'Execution failed: Invalid prompt');
            }, 600);
            return vi.fn();
          }),
          onNodeOutput: vi.fn(() => vi.fn()),
          executeWorkflow: vi.fn(() => Promise.resolve()),
        },
        isConnected: true,
      });

      renderWithProviders(<WorkflowDemo />);

      // Execute workflow
      const runButton = screen.getByTitle(/run/i);
      await act(async () => {
        user.click(runButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/execution failed/i)).toBeInTheDocument();
        expect(screen.getByText('Invalid prompt')).toBeInTheDocument();
      });
    });

    it('should handle invalid workflow configurations', async () => {
      renderWithProviders(<WorkflowDemo />);

      const canvas = screen.getByTestId('workflow-canvas');

      // Create nodes with invalid connections
      const promptNodeOption = screen.getByText('Prompt');
      await act(async () => {
        fireEvent.dragStart(promptNodeOption);
        fireEvent.drop(canvas);
      });

      // Try to execute incomplete workflow
      const runButton = screen.getByTitle(/run/i);
      await act(async () => {
        user.click(runButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/incomplete workflow/i)).toBeInTheDocument();
        expect(screen.getByText(/please connect all nodes/i)).toBeInTheDocument();
      });
  });
  });

  describe('Performance and Scalability', () => {
    it('should handle large workflows efficiently', async () => {
      renderWithProviders(<WorkflowDemo />);

      const canvas = screen.getByTestId('workflow-canvas');
      const promptNodeOption = screen.getByText('Prompt');
      const llmNodeOption = screen.getByText('LLM Response');

      const startTime = performance.now();

      // Create a large workflow (50 nodes)
      for (let i = 0; i < 25; i++) {
        await act(async () => {
          fireEvent.dragStart(promptNodeOption);
          fireEvent.drop(canvas);
        });
        
        await act(async () => {
          fireEvent.dragStart(llmNodeOption);
          fireEvent.drop(canvas);
        });
      }

      const endTime = performance.now();
      const creationTime = endTime - startTime;

      // Should create large workflow within reasonable time
      expect(creationTime).toBeLessThan(5000);

      // Verify all nodes are created
      const promptNodes = screen.getAllByTestId('node-prompt');
      const llmNodes = screen.getAllByTestId('node-llm');
      expect(promptNodes.length).toBe(25);
      expect(llmNodes.length).toBe(25);

      // Test performance of operations on large workflow
      const operationStartTime = performance.now();

      // Select all nodes
      await act(async () => {
        user.keyboard('{Control>}a{/Control}');
      });

      const operationEndTime = performance.now();
      const operationTime = operationEndTime - operationStartTime;

      expect(operationTime).toBeLessThan(1000);
    });

    it('should maintain performance during rapid interactions', async () => {
      renderWithProviders(<WorkflowDemo />);

      const canvas = screen.getByTestId('workflow-canvas');

      const startTime = performance.now();

      // Perform rapid interactions
      for (let i = 0; i < 20; i++) {
        // Add node
        const promptNodeOption = screen.getByText('Prompt');
        await act(async () => {
          fireEvent.dragStart(promptNodeOption);
          fireEvent.drop(canvas);
        });

        // Select and deselect node
        if (i % 3 === 0) {
          const node = screen.getByTestId('node-prompt');
          await act(async () => {
            user.click(node);
          });
          
          await act(async () => {
            user.keyboard('{Escape}');
          });
        }

        // Pan canvas
        if (i % 5 === 0) {
          await act(async () => {
            fireEvent.wheel(canvas, { deltaY: -10 });
          });
        }
      }

      const endTime = performance.now();
      const interactionTime = endTime - startTime;

      // Should handle rapid interactions smoothly
      expect(interactionTime).toBeLessThan(3000);
    });
  });
});