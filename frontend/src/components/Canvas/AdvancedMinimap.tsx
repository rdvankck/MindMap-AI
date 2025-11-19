import React, { memo, useCallback, useRef, useEffect, useState } from 'react';
import { useReactFlow, useStore, ReactFlowState } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Move, 
  Eye, 
  EyeOff,
  Navigation,
  Layers,
  Activity
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface AdvancedMinimapProps {
  className?: string;
  nodeColor?: (node: any) => string;
  nodeStrokeWidth?: number;
  nodeBorderRadius?: number;
  pannable?: boolean;
  zoomable?: boolean;
  ariaLabel?: string;
  style?: React.CSSProperties;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showControls?: boolean;
  showLabels?: boolean;
  backgroundColor?: string;
  maskColor?: string;
}

const selector = (state: ReactFlowState) => ({
  width: state.width,
  height: state.height,
  transform: state.transform,
  nodes: state.nodes,
  edges: state.edges,
  viewBounds: state.viewBounds,
});

export const AdvancedMinimap = memo<AdvancedMinimapProps>(({
  className,
  nodeColor = () => '#e2e8f0',
  nodeStrokeWidth = 2,
  nodeBorderRadius = 4,
  pannable = true,
  zoomable = true,
  ariaLabel = 'React Flow minimap',
  style,
  position = 'bottom-right',
  showControls = true,
  showLabels = false,
  backgroundColor = '#ffffff',
  maskColor = 'rgba(240, 240, 240, 0.6)',
}) => {
  const { zoomIn, zoomOut, fitView, setCenter } = useReactFlow();
  const { width, height, transform, nodes, edges, viewBounds } = useStore(selector);
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showLabelsState, setShowLabelsState] = useState(showLabels);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  // Calculate bounds
  const bounds = React.useMemo(() => {
    if (nodes.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((node) => {
      const { width: nodeWidth = 0, height: nodeHeight = 0 } = node;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + nodeWidth);
      maxY = Math.max(maxY, node.position.y + nodeHeight);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [nodes]);

  // Calculate scale
  const scale = React.useMemo(() => {
    if (bounds.width === 0 || bounds.height === 0) return 1;
    
    const widthScale = 150 / bounds.width;
    const heightScale = 100 / bounds.height;
    
    return Math.min(widthScale, heightScale);
  }, [bounds]);

  // Calculate viewport position in minimap
  const viewportPosition = React.useMemo(() => {
    const [x, y, zoom] = transform;
    const minimapX = (-x / zoom) * scale;
    const minimapY = (-y / zoom) * scale;
    const minimapWidth = (width / zoom) * scale;
    const minimapHeight = (height / zoom) * scale;
    
    return {
      x: minimapX,
      y: minimapY,
      width: minimapWidth,
      height: minimapHeight,
    };
  }, [transform, width, height, scale]);

  // Handle minimap click
  const handleMinimapClick = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!pannable || isDragging) return;
    
    const svg = svgRef.current;
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const flowX = (x / scale) + bounds.x;
    const flowY = (y / scale) + bounds.y;
    
    setCenter(flowX, flowY, { zoom: 1 });
  }, [pannable, isDragging, scale, bounds.x, bounds.y, setCenter]);

  // Handle minimap drag
  const handleMinimapDragStart = useCallback((event: React.MouseEvent<SVGRectElement>) => {
    if (!pannable) return;
    setIsDragging(true);
    event.preventDefault();
  }, [pannable]);

  const handleMinimapDrag = useCallback((event: React.MouseEvent) => {
    if (!isDragging || !svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const flowX = (x / scale) + bounds.x;
    const flowY = (y / scale) + bounds.y;
    
    setCenter(flowX, flowY, { zoom: transform[2] });
  }, [isDragging, scale, bounds.x, bounds.y, setCenter, transform]);

  const handleMinimapDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle zoom controls
  const handleZoomIn = useCallback(() => {
    zoomIn();
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut();
  }, [zoomOut]);

  const handleFitView = useCallback(() => {
    fitView();
  }, [fitView]);

  // Handle label toggle
  const handleToggleLabels = useCallback(() => {
    setShowLabelsState(!showLabelsState);
  }, [showLabelsState]);

  // Position classes
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'absolute z-10 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden',
        positionClasses[position],
        className
      )}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative">
        {/* Main minimap */}
        <svg
          ref={svgRef}
          width={200}
          height={150}
          viewBox={`${bounds.x} ${bounds.y} ${bounds.width || 1} ${bounds.height || 1}`}
          className={cn(
            'cursor-crosshair',
            pannable && 'cursor-move'
          )}
          onClick={handleMinimapClick}
          aria-label={ariaLabel}
        >
          {/* Background */}
          <rect
            x={bounds.x}
            y={bounds.y}
            width={bounds.width || 1}
            height={bounds.height || 1}
            fill={backgroundColor}
            className="pointer-events-none"
          />
          
          {/* Edges */}
          {edges.map((edge) => {
            const sourceNode = nodes.find((n) => n.id === edge.source);
            const targetNode = nodes.find((n) => n.id === edge.target);
            
            if (!sourceNode || !targetNode) return null;
            
            const sourceX = sourceNode.position.x + (sourceNode.width || 0) / 2;
            const sourceY = sourceNode.position.y + (sourceNode.height || 0) / 2;
            const targetX = targetNode.position.x + (targetNode.width || 0) / 2;
            const targetY = targetNode.position.y + (targetNode.height || 0) / 2;
            
            return (
              <line
                key={edge.id}
                x1={sourceX}
                y1={sourceY}
                x2={targetX}
                y2={targetY}
                stroke="#e2e8f0"
                strokeWidth={1}
                className="pointer-events-none"
              />
            );
          })}
          
          {/* Nodes */}
          {nodes.map((node) => {
            const color = nodeColor(node);
            return (
              <g key={node.id}>
                <rect
                  x={node.position.x}
                  y={node.position.y}
                  width={node.width || 0}
                  height={node.height || 0}
                  fill={color}
                  stroke="#fff"
                  strokeWidth={nodeStrokeWidth}
                  rx={nodeBorderRadius}
                  className="pointer-events-none transition-all duration-200 hover:opacity-80"
                />
                {showLabelsState && (
                  <text
                    x={node.position.x + (node.width || 0) / 2}
                    y={node.position.y + (node.height || 0) / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={8}
                    fill="#374151"
                    className="pointer-events-none select-none"
                  >
                    {node.data.label?.substring(0, 8) || ''}
                  </text>
                )}
              </g>
            );
          })}
          
          {/* Viewport indicator */}
          <rect
            x={viewportPosition.x}
            y={viewportPosition.y}
            width={viewportPosition.width}
            height={viewportPosition.height}
            fill={maskColor}
            stroke="#3b82f6"
            strokeWidth={1}
            className={cn(
              'transition-all duration-200',
              pannable && 'cursor-move'
            )}
            onMouseDown={handleMinimapDragStart}
            onMouseMove={handleMinimapDrag}
            onMouseUp={handleMinimapDragEnd}
            onMouseLeave={handleMinimapDragEnd}
          />
        </svg>
        
        {/* Controls overlay */}
        <AnimatePresence>
          {(isHovered || showControls) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-2 right-2 flex flex-col space-y-1"
            >
              {/* Zoom controls */}
              <div className="flex flex-col space-y-1">
                <button
                  onClick={handleZoomIn}
                  className="p-1 bg-white hover:bg-gray-100 rounded border border-gray-200 shadow-sm"
                  title="Zoom in"
                >
                  <ZoomIn className="w-3 h-3 text-gray-600" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="p-1 bg-white hover:bg-gray-100 rounded border border-gray-200 shadow-sm"
                  title="Zoom out"
                >
                  <ZoomOut className="w-3 h-3 text-gray-600" />
                </button>
                <button
                  onClick={handleFitView}
                  className="p-1 bg-white hover:bg-gray-100 rounded border border-gray-200 shadow-sm"
                  title="Fit view"
                >
                  <Maximize className="w-3 h-3 text-gray-600" />
                </button>
              </div>
              
              {/* Toggle controls */}
              <div className="flex flex-col space-y-1 mt-1">
                <button
                  onClick={handleToggleLabels}
                  className="p-1 bg-white hover:bg-gray-100 rounded border border-gray-200 shadow-sm"
                  title={showLabelsState ? 'Hide labels' : 'Show labels'}
                >
                  {showLabelsState ? (
                    <EyeOff className="w-3 h-3 text-gray-600" />
                  ) : (
                    <Eye className="w-3 h-3 text-gray-600" />
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Status indicator */}
        <div className="absolute bottom-2 left-2 flex items-center space-x-1">
          <Activity className="w-3 h-3 text-green-500" />
          <span className="text-xs text-gray-600">
            {nodes.length} nodes, {edges.length} edges
          </span>
        </div>
        
        {/* Zoom indicator */}
        <div className="absolute bottom-2 right-2">
          <span className="text-xs text-gray-600 bg-white px-1 rounded border border-gray-200">
            {Math.round(transform[2] * 100)}%
          </span>
        </div>
      </div>
    </motion.div>
  );
});

AdvancedMinimap.displayName = 'AdvancedMinimap';