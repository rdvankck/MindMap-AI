import { io, Socket } from 'socket.io-client';
import { WebSocketMessage, NodeExecution, WorkflowExecution } from '../shared';

interface WebSocketServiceOptions {
  url?: string;
  token?: string;
  autoReconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export class WebSocketService {
  private socket: Socket | null = null;
  private options: Required<WebSocketServiceOptions>;
  private reconnectCount = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(options: WebSocketServiceOptions = {}) {
    this.options = {
      url: options.url || import.meta.env.VITE_WS_URL || 'ws://localhost:3002',
      token: options.token || '',
      autoReconnect: options.autoReconnect ?? true,
      reconnectAttempts: options.reconnectAttempts ?? 5,
      reconnectDelay: options.reconnectDelay ?? 3000,
    };
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      try {
        this.socket = io(this.options.url, {
          auth: {
            token: this.options.token,
          },
          transports: ['websocket'],
          upgrade: false,
        });

        this.socket.on('connect', () => {
          console.log('WebSocket connected');
          this.reconnectCount = 0;
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('WebSocket disconnected:', reason);
          
          if (this.options.autoReconnect && reason !== 'io client disconnect') {
            this.handleReconnect();
          }
        });

        this.socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          reject(error);
        });

        // Default message handlers
        this.socket.on('message', this.handleMessage);
        this.socket.on('workflow.update', this.handleWorkflowUpdate);
        this.socket.on('node.status', this.handleNodeStatus);
        this.socket.on('node.output', this.handleNodeOutput);
        this.socket.on('node.error', this.handleNodeError);
        this.socket.on('workflow.execution', this.handleWorkflowExecution);

      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private handleReconnect(): void {
    if (this.reconnectCount >= this.options.reconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectCount++;
    console.log(`Attempting to reconnect (${this.reconnectCount}/${this.options.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
        if (this.options.autoReconnect) {
          this.handleReconnect();
        }
      });
    }, this.options.reconnectDelay * this.reconnectCount);
  }

  private handleMessage = (message: WebSocketMessage): void => {
    console.log('WebSocket message:', message);
    // This would be handled by the store or components that subscribe
  };

  private handleWorkflowUpdate = (data: any): void => {
    console.log('Workflow update:', data);
  };

  private handleNodeStatus = (data: { nodeId: string; status: string }): void => {
    console.log('Node status update:', data);
  };

  private handleNodeOutput = (data: { nodeId: string; output: any }): void => {
    console.log('Node output:', data);
  };

  private handleNodeError = (data: { nodeId: string; error: string }): void => {
    console.log('Node error:', data);
  };

  private handleWorkflowExecution = (data: WorkflowExecution): void => {
    console.log('Workflow execution:', data);
  };

  // Message sending methods
  send(type: string, payload: any): void {
    if (!this.socket?.connected) {
      console.warn('WebSocket not connected, message not sent:', { type, payload });
      return;
    }

    this.socket.emit('message', {
      type,
      payload,
      timestamp: new Date(),
    });
  }

  // Workflow specific methods
  subscribeToWorkflow(workflowId: string): void {
    this.send('workflow.subscribe', { workflowId });
  }

  unsubscribeFromWorkflow(workflowId: string): void {
    this.send('workflow.unsubscribe', { workflowId });
  }

  executeWorkflow(workflowId: string, inputs: Record<string, any>): void {
    this.send('workflow.execute', { workflowId, inputs });
  }

  stopWorkflowExecution(executionId: string): void {
    this.send('workflow.stop', { executionId });
  }

  // Node specific methods
  executeNode(nodeId: string, inputs: Record<string, any>): void {
    this.send('node.execute', { nodeId, inputs });
  }

  updateNodeConfig(nodeId: string, config: Record<string, any>): void {
    this.send('node.update', { nodeId, config });
  }

  // Event subscription methods
  onWorkflowUpdate(callback: (data: any) => void): () => void {
    if (!this.socket) return () => {};

    const handler = callback;
    this.socket.on('workflow.update', handler);
    
    return () => {
      this.socket?.off('workflow.update', handler);
    };
  }

  onNodeStatus(callback: (data: { nodeId: string; status: string; result?: any }) => void): () => void {
    if (!this.socket) return () => {};

    const handler = callback;
    this.socket.on('node.status', handler);
    
    return () => {
      this.socket?.off('node.status', handler);
    };
  }

  onNodeOutput(callback: (data: { nodeId: string; output: any }) => void): () => void {
    if (!this.socket) return () => {};

    const handler = callback;
    this.socket.on('node.output', handler);
    
    return () => {
      this.socket?.off('node.output', handler);
    };
  }

  onNodeError(callback: (data: { nodeId: string; error: string }) => void): () => void {
    if (!this.socket) return () => {};

    const handler = callback;
    this.socket.on('node.error', handler);
    
    return () => {
      this.socket?.off('node.error', handler);
    };
  }

  onWorkflowExecution(callback: (data: WorkflowExecution) => void): () => void {
    if (!this.socket) return () => {};

    const handler = callback;
    this.socket.on('workflow.execution', handler);
    
    return () => {
      this.socket?.off('workflow.execution', handler);
    };
  }

  // Connection status
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

// Create singleton instance
let wsServiceInstance: WebSocketService | null = null;

export const getWebSocketService = (options?: WebSocketServiceOptions): WebSocketService => {
  if (!wsServiceInstance) {
    wsServiceInstance = new WebSocketService(options);
  }
  return wsServiceInstance;
};

