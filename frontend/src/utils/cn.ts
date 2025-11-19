import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Debounce function for React hooks
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

// Throttle function for React hooks
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Generate unique ID
export function generateId(prefix: string = 'node'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format date
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Validate JSON
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

// Deep clone
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as any;
  if (typeof obj === 'object') {
    const clonedObj = {} as { [key: string]: any };
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj as T;
  }
  return obj;
}

// Get node position with snapping
export function snapToGrid(position: { x: number; y: number }, gridSize: number = 20) {
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
  };
}

// Check if point is within bounds
export function isPointInBounds(
  point: { x: number; y: number },
  bounds: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

// Get connection path type based on conditions
export function getConnectionType(sourceType: string, targetType: string): string {
  const flowTypes = ['condition', 'branch', 'aggregation'];
  
  if (flowTypes.includes(sourceType) || flowTypes.includes(targetType)) {
    return 'smoothstep';
  }
  
  return 'default';
}

// Validate node configuration
export function validateNodeConfig(nodeType: string, config: Record<string, any>): string[] {
  const errors: string[] = [];
  
  switch (nodeType) {
    case 'prompt':
      if (!config.prompt?.trim()) {
        errors.push('Prompt is required');
      }
      break;
      
    case 'condition':
      if (!config.condition?.trim()) {
        errors.push('Condition is required');
      }
      break;
      
    case 'llm':
      if (!config.model?.trim()) {
        errors.push('Model selection is required');
      }
      break;
      
    case 'http':
      try {
        new URL(config.url);
      } catch {
        errors.push('Valid URL is required');
      }
      break;
  }
  
  return errors;
}

// Get node type display name
export function getNodeTypeName(nodeType: string): string {
  const names: Record<string, string> = {
    prompt: 'Prompt',
    response: 'LLM Response',
    condition: 'Condition',
    branch: 'Branch',
    aggregation: 'Aggregation',
    llm: 'LLM Call',
    code: 'Code Execution',
    input: 'Input',
    output: 'Output',
    file: 'File Read',
    http: 'HTTP Request',
    wait: 'Wait',
    transform: 'Transform',
    merge: 'Merge',
    split: 'Split',
    webhook: 'Webhook',
    database: 'Database',
    cache: 'Cache',
    email: 'Email',
    slack: 'Slack',
    storage: 'Storage',
  };
  
  return names[nodeType] || nodeType;
}

// Get node type color
export function getNodeTypeColor(nodeType: string): string {
  const colors: Record<string, string> = {
    prompt: 'border-blue-400 bg-blue-50',
    response: 'border-purple-400 bg-purple-50',
    condition: 'border-indigo-400 bg-indigo-50',
    branch: 'border-orange-400 bg-orange-50',
    aggregation: 'border-teal-400 bg-teal-50',
    llm: 'border-green-400 bg-green-50',
    code: 'border-gray-400 bg-gray-50',
    input: 'border-cyan-400 bg-cyan-50',
    output: 'border-pink-400 bg-pink-50',
    file: 'border-yellow-400 bg-yellow-50',
    http: 'border-red-400 bg-red-50',
  };
  
  return colors[nodeType] || 'border-gray-400 bg-gray-50';
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Get error message from error object
export function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error) return error.error;
  return 'An unknown error occurred';
}

// Check if workflow is valid for execution
export function isWorkflowValid(nodes: any[], edges: any[]): boolean {
  if (nodes.length === 0) return false;
  
  // Check if there are disconnected nodes
  const connectedNodeIds = new Set();
  edges.forEach(edge => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });
  
  // Allow input nodes to be disconnected
  const disconnectedNodes = nodes.filter(node => 
    node.type !== 'input' && !connectedNodeIds.has(node.id)
  );
  
  return disconnectedNodes.length === 0;
}

// Get execution time in human readable format
export function formatExecutionTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// Calculate token cost (example rates)
export function calculateTokenCost(tokens: number, model: string): number {
  const rates: Record<string, number> = {
    'gpt-3.5-turbo': 0.002, // per 1K tokens
    'gpt-4': 0.03,
    'claude-3-sonnet': 0.015,
    'claude-3-opus': 0.075,
  };
  
  const rate = rates[model] || 0.002;
  return (tokens / 1000) * rate;
}

// Export to different formats
export function exportWorkflow(workflow: any, format: 'json' | 'yaml' | 'csv'): string {
  switch (format) {
    case 'json':
      return JSON.stringify(workflow, null, 2);
      
    case 'yaml':
      // Simple YAML export - in production use a proper YAML library
      return `# ${workflow.name}\n${workflow.description || ''}\n\nnodes:\n${workflow.nodes.map((node: any) => 
        `  - id: ${node.id}\n    type: ${node.type}\n    position: { x: ${node.position.x}, y: ${node.position.y} }`
      ).join('\n')}`;
      
    case 'csv':
      const headers = ['id', 'type', 'label', 'x', 'y'];
      const rows = workflow.nodes.map((node: any) => [
        node.id,
        node.type,
        node.data?.label || '',
        node.position.x,
        node.position.y
      ]);
      return [headers, ...rows].map(row => row.join(',')).join('\n');
      
    default:
      return JSON.stringify(workflow);
  }
}