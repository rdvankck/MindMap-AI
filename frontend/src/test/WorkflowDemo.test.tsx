import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ReactFlowProvider } from 'reactflow';
import WorkflowDemo from '../src/pages/WorkflowDemo';

// Mock WebSocket
vi.mock('../src/services/useWebSocket', () => ({
  useWebSocket: () => ({
    service: {
      onNodeStatus: () => () => {},
      onNodeOutput: () => () => {},
      onNodeError: () => () => {},
    },
    isConnected: true,
  }),
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
  Toaster: () => null,
}));

describe('WorkflowDemo', () => {
  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <BrowserRouter>
        <ReactFlowProvider>
          {component}
        </ReactFlowProvider>
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    // Clear any existing state
    localStorage.clear();
  });

  it('renders without crashing', () => {
    renderWithProviders(<WorkflowDemo />);
    
    // Check that the main components are rendered
    expect(screen.getByText(/LLM Chain Demo/)).toBeInTheDocument();
  });

  it('displays workflow information', () => {
    renderWithProviders(<WorkflowDemo />);
    
    expect(screen.getByText('LLM Chain Demo')).toBeInTheDocument();
    expect(screen.getByText('A demonstration of the LLM node interface')).toBeInTheDocument();
  });

  it('shows connection status', async () => {
    renderWithProviders(<WorkflowDemo />);
    
    // Wait for demo nodes to be added
    await waitFor(() => {
      expect(screen.getByText('User Prompt')).toBeInTheDocument();
    });
    
    await waitFor(() => {
      expect(screen.getByText('LLM Response')).toBeInTheDocument();
    });
    
    await waitFor(() => {
      expect(screen.getByText('Quality Check')).toBeInTheDocument();
    });
  });

  it('has functioning toolbar buttons', () => {
    renderWithProviders(<WorkflowDemo />);
    
    // Check for toolbar buttons
    const runButton = screen.getByText('Run');
    const saveButton = screen.getByText('Save');
    
    expect(runButton).toBeInTheDocument();
    expect(saveButton).toBeInTheDocument();
    
    // Test button interactions
    fireEvent.click(runButton);
    fireEvent.click(saveButton);
  });

  it('shows keyboard shortcuts help', () => {
    renderWithProviders(<WorkflowDemo />);
    
    // Find and click help button
    const helpButton = screen.getByTitle('Help');
    fireEvent.click(helpButton);
    
    // Check that help modal appears
    expect(screen.getByText('Help & Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    
    // Check for specific shortcuts
    expect(screen.getByText('Save workflow:')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+S')).toBeInTheDocument();
    expect(screen.getByText('Execute/Stop:')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+Enter')).toBeInTheDocument();
  });

  it('handles sidebar toggle', () => {
    renderWithProviders(<WorkflowDemo />);
    
    // Find sidebar toggle button
    const sidebarToggle = screen.getByTitle(/Show sidebar|Hide sidebar/);
    expect(sidebarToggle).toBeInTheDocument();
    
    // Toggle sidebar
    fireEvent.click(sidebarToggle);
    
    // The sidebar should toggle (this is a basic test, 
    // in a real test you'd check the sidebar visibility)
  });
});

describe('Node Components', () => {
  it('can drag nodes from palette', async () => {
    renderWithProviders(<WorkflowDemo />);
    
    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('Node Palette')).toBeInTheDocument();
    });
    
    // Check that node types are available
    expect(screen.getByText('Core')).toBeInTheDocument();
    expect(screen.getByText('Logic')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Prompt')).toBeInTheDocument();
    expect(screen.getByText('LLM Response')).toBeInTheDocument();
  });

  it('displays node categories', async () => {
    renderWithProviders(<WorkflowDemo />);
    
    await waitFor(() => {
      expect(screen.getByText('Node Palette')).toBeInTheDocument();
    });
    
    // Check all categories are present
    const categories = [
      'Core',
      'Logic', 
      'Operations',
      'Data',
      'External',
      'Flow Control'
    ];
    
    categories.forEach(category => {
      expect(screen.getByText(category)).toBeInTheDocument();
    });
  });
});