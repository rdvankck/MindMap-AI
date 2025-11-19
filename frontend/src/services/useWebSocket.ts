import { useState, useEffect } from 'react';

export const useWebSocket = (options?: { url?: string; token?: string }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simplified mock WebSocket service for demo
  useEffect(() => {
    // Simulate connection delay
    const timer = setTimeout(() => {
      setError('WebSocket disabled in demo mode');
      setIsConnected(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const mockService = {
    connect: async () => {
      throw new Error('WebSocket disabled in demo mode');
    },
    disconnect: () => {},
    getSocket: () => null,
    onNodeStatus: () => () => {},
    onNodeOutput: () => () => {},
    onNodeError: () => () => {},
    sendNodeExecution: () => {},
  };

  return {
    service: mockService,
    isConnected,
    error,
    reconnect: () => {},
    disconnect: () => {},
  };
};