export enum ConnectionType {
  DATA = 'data',
  CONTROL = 'control',
  ASYNC = 'async',
  ERROR = 'error',
  SUCCESS = 'success',
}

export enum DataType {
  TEXT = 'text',
  JSON = 'json',
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
}

export interface ConnectionData {
  connectionType?: ConnectionType;
  dataType?: DataType;
  label?: string;
  animated?: boolean;
  strength?: number;
  isActive?: boolean;
  sourceNode?: string;
  targetNode?: string;
  metadata?: Record<string, any>;
}

export interface VisualConnection {
  id: string;
  source: string;
  target: string;
  data: ConnectionData;
  path?: string;
  particles?: ParticleData[];
}

export interface ParticleData {
  id: string;
  position: { x: number; y: number };
  progress: number;
  speed: number;
  size: number;
  color: string;
}

export const CONNECTION_COLORS = {
  [ConnectionType.DATA]: '#6b7280',
  [ConnectionType.CONTROL]: '#6366f1',
  [ConnectionType.ASYNC]: '#8b5cf6',
  [ConnectionType.ERROR]: '#ef4444',
  [ConnectionType.SUCCESS]: '#10b981',
} as const;

export const CONNECTION_STYLES = {
  [ConnectionType.DATA]: {
    strokeDasharray: '0',
    animationDuration: '0s',
    strokeWidth: 2,
  },
  [ConnectionType.CONTROL]: {
    strokeDasharray: '5, 5',
    animationDuration: '1s',
    strokeWidth: 2,
  },
  [ConnectionType.ASYNC]: {
    strokeDasharray: '10, 5',
    animationDuration: '0.5s',
    strokeWidth: 2,
  },
  [ConnectionType.ERROR]: {
    strokeDasharray: '3, 3',
    animationDuration: '0.3s',
    strokeWidth: 3,
  },
  [ConnectionType.SUCCESS]: {
    strokeDasharray: '0',
    animationDuration: '0s',
    strokeWidth: 3,
  },
} as const;