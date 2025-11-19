import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from 'reactflow';
import PromptNode from '@/components/nodes/PromptNode';
import ResponseNode from '@/components/nodes/ResponseNode';
import ConditionNode from '@/components/nodes/ConditionNode';
import AggregationNode from '@/components/nodes/AggregationNode';

// Mock reactflow handles
vi.mock('reactflow', () => ({
  useReactFlow: () => ({
    setNodes: vi.fn(),
    updateNode: vi.fn(),
  }),
  Handle: ({ type, position }: { type: string; position: string }) => 
    <div data-testid={`handle-${type}-${position}`} />,
}));

// Mock WebSocket service
vi.mock('@/services/useWebSocket', () => ({
  useWebSocket: () => ({
    service: {
      onNodeStatus: vi.fn(() => vi.fn()),
      onNodeOutput: vi.fn(() => vi.fn()),
      onNodeError: vi.fn(() => vi.fn()),
    },
    isConnected: true,
  }),
}));

describe('Node Components', () => {
  const defaultProps = {
    id: 'test-node-id',
    type: 'prompt' as const,
    data: {
      label: 'Test Node',
      prompt: 'Test prompt content',
    },
    selected: false,
    dragging: false,
    position: { x: 100, y: 100 },
    positionAbsolute: { x: 100, y: 100 },
    draggingHandle: null,
    width: 200,
    height: 150,
  };

  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <ReactFlowProvider>
        {component}
      </ReactFlowProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('PromptNode', () => {
    it('renders prompt node correctly', () => {
      renderWithProvider(<PromptNode {...defaultProps} />);
      
      expect(screen.getByText('Test Node')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test prompt content')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-right')).toBeInTheDocument();
      expect(screen.getByTestId('handle-target-left')).toBeInTheDocument();
    });

    it('shows editing interface when double-clicked', async () => {
      const user = userEvent.setup();
      renderWithProvider(<PromptNode {...defaultProps} />);
      
      const nodeElement = screen.getByTestId('prompt-node');
      
      await user.dblClick(nodeElement);
      
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test prompt content')).toBeInTheDocument();
    });

    it('updates prompt content when edited', async () => {
      const user = userEvent.setup();
      renderWithProvider(<PromptNode {...defaultProps} />);
      
      const nodeElement = screen.getByTestId('prompt-node');
      await user.dblClick(nodeElement);
      
      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Updated prompt content');
      
      await user.keyboard('{Enter}');
      
      expect(screen.getByText('Updated prompt content')).toBeInTheDocument();
    });

    it('shows loading state during execution', () => {
      renderWithProvider(
        <PromptNode 
          {...defaultProps} 
          data={{ ...defaultProps.data, executing: true }}
        />
      );
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText(/executing/i)).toBeInTheDocument();
    });

    it('displays error message when execution fails', () => {
      renderWithProvider(
        <PromptNode 
          {...defaultProps} 
          data={{ 
            ...defaultProps.data, 
            error: 'Execution failed: Invalid prompt' 
          }}
        />
      );
      
      expect(screen.getByText(/execution failed/i)).toBeInTheDocument();
      expect(screen.getByText('Invalid prompt')).toBeInTheDocument();
    });

    it('handles empty prompt content', () => {
      renderWithProvider(
        <PromptNode 
          {...defaultProps} 
          data={{ 
            ...defaultProps.data, 
            prompt: '' 
          }}
        />
      );
      
      expect(screen.getByText('No prompt provided')).toBeInTheDocument();
    });

    it('shows character count for long prompts', () => {
      const longPrompt = 'A'.repeat(1000);
      renderWithProvider(
        <PromptNode 
          {...defaultProps} 
          data={{ 
            ...defaultProps.data, 
            prompt: longPrompt 
          }}
        />
      );
      
      expect(screen.getByText(/1000 chars/i)).toBeInTheDocument();
    });

    it('supports prompt templates with variables', () => {
      renderWithProvider(
        <PromptNode 
          {...defaultProps} 
          data={{ 
            ...defaultProps.data, 
            prompt: 'Hello {{name}}, how are you?',
            variables: ['name']
          }}
        />
      );
      
      expect(screen.getByText('{{name}}')).toBeInTheDocument();
      expect(screen.getByTestId('variable-tag')).toBeInTheDocument();
    });
  });

  describe('ResponseNode', () => {
    const responseProps = {
      ...defaultProps,
      type: 'response' as const,
      data: {
        label: 'Response Node',
        response: 'This is the response from the LLM',
        metadata: {
          model: 'gpt-3.5-turbo',
          tokens: 150,
          cost: 0.001,
          executionTime: 1500,
        },
      },
    };

    it('renders response node correctly', () => {
      renderWithProvider(<ResponseNode {...responseProps} />);
      
      expect(screen.getByText('Response Node')).toBeInTheDocument();
      expect(screen.getByText('This is the response from the LLM')).toBeInTheDocument();
      expect(screen.getByTestId('handle-target-left')).toBeInTheDocument();
    });

    it('displays response metadata', () => {
      renderWithProvider(<ResponseNode {...responseProps} />);
      
      expect(screen.getByText('gpt-3.5-turbo')).toBeInTheDocument();
      expect(screen.getByText('150 tokens')).toBeInTheDocument();
      expect(screen.getByText('$0.001')).toBeInTheDocument();
      expect(screen.getByText('1.5s')).toBeInTheDocument();
    });

    it('handles long responses with truncation', () => {
      const longResponse = 'B'.repeat(2000);
      renderWithProvider(
        <ResponseNode 
          {...responseProps} 
          data={{ 
            ...responseProps.data, 
            response: longResponse 
          }}
        />
      );
      
      expect(screen.getByText(/show more/i)).toBeInTheDocument();
      expect(screen.getByText(`${longResponse.substring(0, 200)}...`)).toBeInTheDocument();
    });

    it('expands truncated responses when clicked', async () => {
      const user = userEvent.setup();
      const longResponse = 'C'.repeat(2000);
      
      renderWithProvider(
        <ResponseNode 
          {...responseProps} 
          data={{ 
            ...responseProps.data, 
            response: longResponse 
          }}
        />
      );
      
      const expandButton = screen.getByText(/show more/i);
      await user.click(expandButton);
      
      expect(screen.getByText(longResponse)).toBeInTheDocument();
      expect(screen.getByText(/show less/i)).toBeInTheDocument();
    });

    it('supports markdown rendering', () => {
      const markdownResponse = '# Title\n\n**Bold text** and *italic text*';
      renderWithProvider(
        <ResponseNode 
          {...responseProps} 
          data={{ 
            ...responseProps.data, 
            response: markdownResponse 
          }}
        />
      );
      
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByText('Title')).toBeInTheDocument();
    });

    it('supports code syntax highlighting', () => {
      const codeResponse = '```javascript\nconst hello = "world";\n```';
      renderWithProvider(
        <ResponseNode 
          {...responseProps} 
          data={{ 
            ...responseProps.data, 
            response: codeResponse 
          }}
        />
      );
      
      expect(screen.getByText('const hello = "world";')).toBeInTheDocument();
      expect(screen.getByRole('code')).toBeInTheDocument();
    });

    it('allows copying response to clipboard', async () => {
      const user = userEvent.setup();
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });
      
      renderWithProvider(<ResponseNode {...responseProps} />);
      
      const copyButton = screen.getByTitle(/copy/i);
      await user.click(copyButton);
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('This is the response from the LLM');
      expect(screen.getByText(/copied/i)).toBeInTheDocument();
    });

    it('handles missing response gracefully', () => {
      renderWithProvider(
        <ResponseNode 
          {...responseProps} 
          data={{ 
            label: 'Empty Response Node',
            response: null 
          }}
        />
      );
      
      expect(screen.getByText(/no response/i)).toBeInTheDocument();
    });
  });

  describe('ConditionNode', () => {
    const conditionProps = {
      ...defaultProps,
      type: 'condition' as const,
      data: {
        label: 'Condition Node',
        condition: 'response.rating > 3',
        trueLabel: 'High Rating',
        falseLabel: 'Low Rating',
      },
    };

    it('renders condition node correctly', () => {
      renderWithProvider(<ConditionNode {...conditionProps} />);
      
      expect(screen.getByText('Condition Node')).toBeInTheDocument();
      expect(screen.getByText('response.rating > 3')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-right')).toBeInTheDocument();
    });

    it('displays true/false branch labels', () => {
      renderWithProvider(<ConditionNode {...conditionProps} />);
      
      expect(screen.getByText('High Rating')).toBeInTheDocument();
      expect(screen.getByText('Low Rating')).toBeInTheDocument();
    });

    it('allows editing condition expression', async () => {
      const user = userEvent.setup();
      renderWithProvider(<ConditionNode {...conditionProps} />);
      
      const nodeElement = screen.getByTestId('condition-node');
      await user.dblClick(nodeElement);
      
      const conditionInput = screen.getByRole('textbox');
      expect(conditionInput).toBeInTheDocument();
      expect(conditionInput).toHaveValue('response.rating > 3');
    });

    it('validates condition syntax', async () => {
      const user = userEvent.setup();
      renderWithProvider(<ConditionNode {...conditionProps} />);
      
      const nodeElement = screen.getByTestId('condition-node');
      await user.dblClick(nodeElement);
      
      const conditionInput = screen.getByRole('textbox');
      await user.clear(conditionInput);
      await user.type(conditionInput, 'invalid syntax condition');
      
      await user.keyboard('{Enter}');
      
      expect(screen.getByText(/invalid condition/i)).toBeInTheDocument();
    });

    it('shows evaluation result in debug mode', () => {
      renderWithProvider(
        <ConditionNode 
          {...conditionProps} 
          data={{ 
            ...conditionProps.data, 
            debugMode: true,
            evaluationResult: true,
            debugInfo: {
              leftValue: 5,
              rightValue: 3,
              operator: '>'
            }
          }}
        />
      );
      
      expect(screen.getByText('✓ True')).toBeInTheDocument();
      expect(screen.getByText('5 > 3')).toBeInTheDocument();
    });
  });

  describe('AggregationNode', () => {
    const aggregationProps = {
      ...defaultProps,
      type: 'aggregation' as const,
      data: {
        label: 'Aggregation Node',
        strategy: 'combine',
        inputs: [
          { id: 'input1', content: 'First response', weight: 1 },
          { id: 'input2', content: 'Second response', weight: 2 },
        ],
        output: 'Combined response from multiple inputs',
      },
    };

    it('renders aggregation node correctly', () => {
      renderWithProvider(<AggregationNode {...aggregationProps} />);
      
      expect(screen.getByText('Aggregation Node')).toBeInTheDocument();
      expect(screen.getByText('Combine')).toBeInTheDocument();
      expect(screen.getByTestId('handle-target-left')).toBeInTheDocument();
      expect(screen.getByTestId('handle-source-right')).toBeInTheDocument();
    });

    it('displays input count', () => {
      renderWithProvider(<AggregationNode {...aggregationProps} />);
      
      expect(screen.getByText(/2 inputs/i)).toBeInTheDocument();
    });

    it('allows changing aggregation strategy', async () => {
      const user = userEvent.setup();
      renderWithProvider(<AggregationNode {...aggregationProps} />);
      
      const strategySelect = screen.getByRole('combobox');
      await user.click(strategySelect);
      
      const averageOption = screen.getByText('Average');
      await user.click(averageOption);
      
      expect(screen.getByText('Average')).toBeInTheDocument();
    });

    it('shows individual inputs in expanded view', async () => {
      const user = userEvent.setup();
      renderWithProvider(<AggregationNode {...aggregationProps} />);
      
      const expandButton = screen.getByTitle(/show inputs/i);
      await user.click(expandButton);
      
      expect(screen.getByText('First response')).toBeInTheDocument();
      expect(screen.getByText('Second response')).toBeInTheDocument();
    });

    it('handles weighted aggregation', () => {
      renderWithProvider(
        <AggregationNode 
          {...aggregationProps} 
          data={{ 
            ...aggregationProps.data, 
            strategy: 'weighted_average'
          }}
        />
      );
      
      expect(screen.getByText('Weighted Average')).toBeInTheDocument();
      expect(screen.getByText(/weight: 1/i)).toBeInTheDocument();
      expect(screen.getByText(/weight: 2/i)).toBeInTheDocument();
    });

    it('supports custom aggregation functions', () => {
      renderWithProvider(
        <AggregationNode 
          {...aggregationProps} 
          data={{ 
            ...aggregationProps.data, 
            strategy: 'custom',
            customFunction: '(a, b) => a + b'
          }}
        />
      );
      
      expect(screen.getByText('Custom')).toBeInTheDocument();
      expect(screen.getByDisplayValue('(a, b) => a + b')).toBeInTheDocument();
    });
  });

  describe('Node Interactions', () => {
    it('highlights handles when connecting nodes', async () => {
      const user = userEvent.setup();
      renderWithProvider(
        <ReactFlowProvider>
          <PromptNode {...defaultProps} />
          <ResponseNode {...defaultProps} />
        </ReactFlowProvider>
      );
      
      const handle = screen.getByTestId('handle-source-right');
      
      await fireEvent.mouseEnter(handle);
      
      expect(handle).toHaveClass('highlighted');
    });

    it('shows context menu on right-click', async () => {
      const user = userEvent.setup();
      renderWithProvider(<PromptNode {...defaultProps} />);
      
      const nodeElement = screen.getByTestId('prompt-node');
      await user.pointer([
        { keys: '[MouseRight]', target: nodeElement }
      ]);
      
      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByText(/delete/i)).toBeInTheDocument();
      expect(screen.getByText(/duplicate/i)).toBeInTheDocument();
      expect(screen.getByText(/edit/i)).toBeInTheDocument();
    });

    it('removes node when delete option selected', async () => {
      const user = userEvent.setup();
      renderWithProvider(<PromptNode {...defaultProps} />);
      
      const nodeElement = screen.getByTestId('prompt-node');
      await user.pointer([
        { keys: '[MouseRight]', target: nodeElement }
      ]);
      
      const deleteOption = screen.getByText(/delete/i);
      await user.click(deleteOption);
      
      expect(screen.queryByTestId('prompt-node')).not.toBeInTheDocument();
    });

    it('supports keyboard shortcuts', async () => {
      const user = userEvent.setup();
      renderWithProvider(<PromptNode {...defaultProps} />);
      
      const nodeElement = screen.getByTestId('prompt-node');
      nodeElement.focus();
      
      await user.keyboard('{Enter}'); // Edit
      
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('Performance and Accessibility', () => {
    it('handles rapid state changes efficiently', async () => {
      const user = userEvent.setup();
      renderWithProvider(<PromptNode {...defaultProps} />);
      
      const startTime = performance.now();
      
      // Rapidly update node data
      for (let i = 0; i < 50; i++) {
        renderWithProvider(
          <PromptNode 
            {...defaultProps} 
            data={{ 
              ...defaultProps.data, 
              prompt: `Update ${i}` 
            }}
          />
        );
      }
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('maintains accessibility with proper ARIA labels', () => {
      renderWithProvider(<PromptNode {...defaultProps} />);
      
      const nodeElement = screen.getByTestId('prompt-node');
      expect(nodeElement).toHaveAttribute('role', 'button');
      expect(nodeElement).toHaveAttribute('aria-label', 'Prompt Node: Test Node');
    });

    it('supports screen reader announcements', async () => {
      const user = userEvent.setup();
      renderWithProvider(<PromptNode {...defaultProps} />);
      
      const nodeElement = screen.getByTestId('prompt-node');
      await user.dblClick(nodeElement);
      
      expect(screen.getByRole('status')).toHaveTextContent(/editing prompt node/i);
    });
  });
});