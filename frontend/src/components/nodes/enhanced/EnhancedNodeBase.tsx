import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { 
  GripVertical,
  Settings,
  Copy,
  Trash2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Play,
  Pause,
  Square,
  CheckCircle,
  AlertCircle,
  Loader2,
  Zap,
  Eye,
  EyeOff,
  Lock,
  Unlock,
} from 'lucide-react';
import { Node as FlowNode, NodeStatus } from '../shared';
import { useFlowStore } from '../../store';
import { cn } from '../../utils/cn';

interface EnhancedNodeBaseProps extends NodeProps {
  data: {
    label: string;
    status: NodeStatus;
    error?: string;
    result?: any;
    isLocked?: boolean;
    isCollapsed?: boolean;
    isDisabled?: boolean;
    metadata?: Record<string, any>;
    [key: string]: any;
  };
  children: React.ReactNode;
  nodeType?: string;
  icon?: React.ReactNode;
  statusColors?: Record<NodeStatus, string>;
  customHandles?: {
    input?: Array<{ id: string; type: string; position: Position; style?: React.CSSProperties }>;
    output?: Array<{ id: string; type: string; position: Position; style?: React.CSSProperties }>;
  };
}

export const EnhancedNodeBase = memo<EnhancedNodeBaseProps>(({
  id,
  data,
  selected,
  children,
  nodeType = 'default',
  icon,
  statusColors,
  customHandles,
  ...props
}) => {
  const { 
    updateNode, 
    deleteNode, 
    setNodeStatus, 
    setSelection,
    copyNodes,
    duplicateNode,
    startNodeExecution,
    stopNodeExecution,
    toggleNodeLock,
    toggleNodeCollapse
  } = useFlowStore();

  const [isHovered, setIsHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 280, height: 'auto' });
  const nodeRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  const defaultStatusColors = {
    idle: 'border-gray-300 bg-white',
    running: 'border-blue-500 bg-blue-50',
    completed: 'border-green-500 bg-green-50',
    error: 'border-red-500 bg-red-50',
    skipped: 'border-gray-400 bg-gray-50',
  };

  const colors = statusColors || defaultStatusColors;

  // Handle drag start
  const handleDragStart = useCallback((event: React.MouseEvent) => {
    if (data.isLocked) return;
    setIsDragging(true);
    setDragStart({ x: event.clientX, y: event.clientY });
  }, [data.isLocked]);

  // Handle drag end
  const handleDragEnd = useCallback((event: MouseEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const deltaX = event.clientX - dragStart.x;
    const deltaY = event.clientY - dragStart.y;
    
    if (Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) {
      // It was a click, not a drag
      setSelection([id], []);
    }
  }, [isDragging, dragStart, id, setSelection]);

  // Handle resize
  const handleResizeStart = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (data.isLocked) return;
    setIsResizing(true);
  }, [data.isLocked]);

  const handleResize = useCallback((info: PanInfo) => {
    if (!isResizing) return;
    const newWidth = Math.max(200, size.width + info.delta.x);
    const newHeight = Math.max(150, (size.height as number) + info.delta.y);
    setSize({ width: newWidth, height: newHeight });
  }, [isResizing, size]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    updateNode(id, { 
      style: { 
        width: size.width, 
        height: size.height,
        minWidth: size.width,
        minHeight: size.height 
      } 
    });
  }, [id, size.width, size.height, updateNode]);

  // Handle actions
  const handleCopy = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    duplicateNode(id);
  }, [id, duplicateNode]);

  const handleDelete = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    deleteNode(id);
  }, [id, deleteNode]);

  const handleToggleLock = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    toggleNodeLock(id);
  }, [id, toggleNodeLock]);

  const handleToggleCollapse = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    toggleNodeCollapse(id);
  }, [id, toggleNodeCollapse]);

  const handleExecute = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    startNodeExecution(id);
  }, [id, startNodeExecution]);

  const handleStop = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    stopNodeExecution(id);
  }, [id, stopNodeExecution]);

  // Get status icon
  const getStatusIcon = useCallback(() => {
    switch (data.status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-600" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'skipped':
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
      default:
        return <Zap className="w-4 h-4 text-gray-600" />;
    }
  }, [data.status]);

  // Setup event listeners
  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => handleDragEnd(e);
      const handleMouseUp = () => setIsDragging(false);
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleDragEnd]);

  return (
    <motion.div
      ref={nodeRef}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ 
        scale: data.isCollapsed ? 0.95 : 1, 
        opacity: data.isDisabled ? 0.5 : 1 
      }}
      exit={{ scale: 0.8, opacity: 0 }}
      whileHover={{ scale: data.isLocked ? 1 : 1.02 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative rounded-lg border-2 shadow-lg transition-all duration-200 group',
        colors[data.status],
        selected && 'ring-2 ring-blue-500 ring-offset-2',
        data.isLocked && 'opacity-90',
        data.isDisabled && 'opacity-50 pointer-events-none',
        isHovered && 'shadow-xl',
        'cursor-move'
      )}
      style={{
        width: size.width,
        height: data.isCollapsed ? 'auto' : size.height,
        minWidth: 200,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={handleDragStart}
      onClick={() => setSelection([id], [])}
    >
      {/* Custom handles */}
      {customHandles?.input?.map((handle) => (
        <Handle
          key={handle.id}
          type="target"
          position={handle.position}
          id={handle.id}
          className={cn(
            'w-3 h-3 bg-gray-400 border-2 border-white transition-all duration-200',
            isHovered && 'w-4 h-4 bg-blue-500'
          )}
          style={handle.style}
        />
      ))}

      {customHandles?.output?.map((handle) => (
        <Handle
          key={handle.id}
          type="source"
          position={handle.position}
          id={handle.id}
          className={cn(
            'w-3 h-3 bg-gray-400 border-2 border-white transition-all duration-200',
            isHovered && 'w-4 h-4 bg-blue-500'
          )}
          style={handle.style}
        />
      ))}

      {/* Default handles if no custom handles */}
      {!customHandles && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            className={cn(
              'w-3 h-3 bg-gray-400 border-2 border-white transition-all duration-200',
              isHovered && 'w-4 h-4 bg-blue-500'
            )}
          />
          <Handle
            type="source"
            position={Position.Right}
            className={cn(
              'w-3 h-3 bg-gray-400 border-2 border-white transition-all duration-200',
              isHovered && 'w-4 h-4 bg-blue-500'
            )}
          />
        </>
      )}

      {/* Drag handle */}
      <div className="absolute top-0 left-0 w-full h-4 cursor-move bg-gray-100 rounded-t-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
        <GripVertical className="w-3 h-3 text-gray-500" />
      </div>

      {/* Node Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-white/50 backdrop-blur-sm rounded-t-lg">
        <div className="flex items-center space-x-2">
          {icon}
          <span className="font-medium text-sm text-gray-900 truncate max-w-[150px]">
            {data.label}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          {getStatusIcon()}
          
          {/* Action buttons - shown on hover */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center space-x-1"
              >
                {data.status === 'idle' ? (
                  <button
                    onClick={handleExecute}
                    className="p-1 hover:bg-green-100 rounded text-green-600"
                    title="Execute"
                  >
                    <Play className="w-3 h-3" />
                  </button>
                ) : data.status === 'running' ? (
                  <button
                    onClick={handleStop}
                    className="p-1 hover:bg-red-100 rounded text-red-600"
                    title="Stop"
                  >
                    <Square className="w-3 h-3" />
                  </button>
                ) : (
                  <button
                    onClick={handleExecute}
                    className="p-1 hover:bg-blue-100 rounded text-blue-600"
                    title="Re-execute"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
                
                <button
                  onClick={handleToggleCollapse}
                  className="p-1 hover:bg-gray-100 rounded text-gray-600"
                  title={data.isCollapsed ? 'Expand' : 'Collapse'}
                >
                  {data.isCollapsed ? (
                    <Maximize2 className="w-3 h-3" />
                  ) : (
                    <Minimize2 className="w-3 h-3" />
                  )}
                </button>
                
                <button
                  onClick={handleToggleLock}
                  className={cn(
                    'p-1 hover:bg-gray-100 rounded',
                    data.isLocked ? 'text-yellow-600' : 'text-gray-600'
                  )}
                  title={data.isLocked ? 'Unlock' : 'Lock'}
                >
                  {data.isLocked ? (
                    <Lock className="w-3 h-3" />
                  ) : (
                    <Unlock className="w-3 h-3" />
                  )}
                </button>
                
                <button
                  onClick={handleCopy}
                  className="p-1 hover:bg-blue-100 rounded text-blue-600"
                  title="Duplicate"
                >
                  <Copy className="w-3 h-3" />
                </button>
                
                <button
                  onClick={handleDelete}
                  className="p-1 hover:bg-red-100 rounded text-red-600"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Node Content */}
      <AnimatePresence mode="wait">
        {!data.isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3">
              {children}
              
              {/* Error display */}
              {data.error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-700"
                >
                  <div className="flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span className="font-medium">Error:</span>
                  </div>
                  <div className="mt-1">{data.error}</div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resize handle */}
      {!data.isLocked && (
        <motion.div
          ref={resizeHandleRef}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          onMouseDown={handleResizeStart}
          drag="x"
          dragConstraints={{ left: 0, top: 0 }}
          dragElastic={0}
          onDrag={handleResize}
          onDragEnd={handleResizeEnd}
          whileHover={{ scale: 1.2 }}
        >
          <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-gray-400 transform rotate-45" />
        </motion.div>
      )}

      {/* Selection indicator */}
      {selected && (
        <motion.div
          className="absolute inset-0 rounded-lg border-2 border-blue-500 pointer-events-none"
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.95 }}
        />
      )}

      {/* Loading overlay */}
      {data.status === 'running' && (
        <motion.div
          className="absolute inset-0 bg-blue-50/80 rounded-lg flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex items-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-sm text-blue-600 font-medium">Processing...</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
});

EnhancedNodeBase.displayName = 'EnhancedNodeBase';