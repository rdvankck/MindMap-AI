import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Eye, 
  Settings, 
  Download, 
  Maximize2, 
  RotateCcw,
  Grid,
  Layers,
  Filter,
  RefreshCw
} from 'lucide-react';
import { BranchVisualization } from '../shared';
import { cn } from '@/utils';

interface BranchVisualizationPanelProps {
  visualization: BranchVisualization | null;
  loading: boolean;
  error: string | null;
  onRegenerate: (options: any) => Promise<void>;
  onClose: () => void;
}

const layoutTypes = [
  { value: 'tree', label: 'Tree', icon: '🌳' },
  { value: 'radial', label: 'Radial', icon: '☀️' },
  { value: 'force', label: 'Force', icon: '🧲' },
  { value: 'hierarchical', label: 'Hierarchical', icon: '📊' },
  { value: 'circular', label: 'Circular', icon: '⭕' },
];

const colorSchemes = [
  { value: 'rainbow', label: 'Rainbow', preview: 'linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)' },
  { value: 'ocean', label: 'Ocean', preview: 'linear-gradient(to right, #0077be, #00a8cc, #74c0fc)' },
  { value: 'sunset', label: 'Sunset', preview: 'linear-gradient(to right, #ff6b6b, #feca57, #ff9ff3)' },
  { value: 'forest', label: 'Forest', preview: 'linear-gradient(to right, #27ae60, #2ecc71, #82e0aa)' },
  { value: 'monochrome', label: 'Monochrome', preview: 'linear-gradient(to right, #2c3e50, #34495e, #7f8c8d)' },
];

const BranchVisualizationPanel: React.FC<BranchVisualizationPanelProps> = ({
  visualization,
  loading,
  error,
  onRegenerate,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [layoutType, setLayoutType] = useState('tree');
  const [colorScheme, setColorScheme] = useState('rainbow');
  const [nodeSize, setNodeSize] = useState('byDepth');
  const [showGrid, setShowGrid] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    if (visualization && canvasRef.current) {
      drawVisualization();
    }
  }, [visualization, layoutType, colorScheme, nodeSize, showGrid]);

  const drawVisualization = () => {
    const canvas = canvasRef.current;
    if (!canvas || !visualization) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid if enabled
    if (showGrid) {
      drawGrid(ctx, canvas.width, canvas.height);
    }

    // Draw edges
    visualization.edges.forEach(edge => {
      drawEdge(ctx, edge, visualization.nodes);
    });

    // Draw nodes
    visualization.nodes.forEach(node => {
      drawNode(ctx, node);
    });
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);

    const gridSize = 50;
    
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  };

  const drawNode = (ctx: CanvasRenderingContext2D, node: any) => {
    const { x, y, data, style, type } = node;
    
    // Node styling based on type
    let nodeColor = style?.backgroundColor || '#3b82f6';
    let nodeSize = getNodeSize(node);
    
    // Draw node shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Draw node
    ctx.fillStyle = nodeColor;
    ctx.strokeStyle = style?.borderColor || '#1f2937';
    ctx.lineWidth = 2;

    if (type === 'branch') {
      // Draw circular nodes for branches
      ctx.beginPath();
      ctx.arc(x, y, nodeSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // Draw rectangular nodes for messages
      const width = nodeSize * 2;
      const height = nodeSize;
      ctx.beginPath();
      ctx.roundRect(x - width / 2, y - height / 2, width, height, 5);
      ctx.fill();
      ctx.stroke();
    }

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw label
    if (data.label) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.max(10, nodeSize / 3)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Truncate label if too long
      let label = data.label;
      if (label.length > 15) {
        label = label.substring(0, 12) + '...';
      }
      
      ctx.fillText(label, x, y);
    }
  };

  const drawEdge = (ctx: CanvasRenderingContext2D, edge: any, nodes: any[]) => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode) return;

    const { x: x1, y: y1 } = sourceNode;
    const { x: x2, y: y2 } = targetNode;

    ctx.strokeStyle = edge.style?.strokeColor || '#9ca3af';
    ctx.lineWidth = edge.style?.strokeWidth || 2;
    
    if (edge.style?.strokeStyle === 'dashed') {
      ctx.setLineDash([5, 5]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Draw arrow
    if (edge.type === 'branch') {
      drawArrow(ctx, x1, y1, x2, y2);
    }

    ctx.setLineDash([]);
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) => {
    const headlen = 10;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  };

  const getNodeSize = (node: any) => {
    switch (nodeSize) {
      case 'uniform':
        return 20;
      case 'byDepth':
        return Math.max(15, 30 - (node.data.depth || 0) * 5);
      case 'byActivity':
        return Math.max(15, Math.min(30, (node.data.messageCount || 1) * 3));
      default:
        return 20;
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await onRegenerate({
        layoutType,
        style: {
          colorScheme,
          nodeSize,
        },
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `branch-visualization-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn(
          "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50",
          isFullscreen && "inset-0"
        )}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "bg-white rounded-xl shadow-xl w-full mx-4 overflow-hidden",
            isFullscreen ? "h-screen rounded-none" : "max-w-6xl max-h-[90vh]"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Eye className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Branch Visualization</h2>
                <p className="text-sm text-gray-500">
                  {visualization ? `${visualization.nodes.length} nodes, ${visualization.edges.length} connections` : 'Loading...'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
              
              <button
                onClick={handleExport}
                disabled={!visualization}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Export image"
              >
                <Download className="w-5 h-5 text-gray-600" />
              </button>
              
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Toggle fullscreen"
              >
                <Maximize2 className="w-5 h-5 text-gray-600" />
              </button>
              
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Regenerate"
              >
                <RefreshCw className={cn("w-5 h-5 text-gray-600", isRegenerating && "animate-spin")} />
              </button>
              
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          <div className="flex" style={{ height: isFullscreen ? 'calc(100vh - 73px)' : '60vh' }}>
            {/* Settings Panel */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 300, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto"
                >
                  <h3 className="font-medium text-gray-900 mb-4">Visualization Settings</h3>
                  
                  {/* Layout Type */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Layout</label>
                    <div className="grid grid-cols-2 gap-2">
                      {layoutTypes.map((layout) => (
                        <button
                          key={layout.value}
                          onClick={() => setLayoutType(layout.value)}
                          className={cn(
                            "p-3 border-2 rounded-lg text-center transition-all",
                            layoutType === layout.value
                              ? "border-purple-500 bg-purple-50"
                              : "border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <div className="text-2xl mb-1">{layout.icon}</div>
                          <div className="text-xs font-medium">{layout.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Scheme */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Color Scheme</label>
                    <div className="space-y-2">
                      {colorSchemes.map((scheme) => (
                        <button
                          key={scheme.value}
                          onClick={() => setColorScheme(scheme.value)}
                          className={cn(
                            "w-full p-3 border-2 rounded-lg text-left transition-all flex items-center gap-3",
                            colorScheme === scheme.value
                              ? "border-purple-500 bg-purple-50"
                              : "border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <div
                            className="w-8 h-8 rounded-full border-2 border-gray-300"
                            style={{ background: scheme.preview }}
                          />
                          <span className="text-sm font-medium">{scheme.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Node Size */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Node Size</label>
                    <select
                      value={nodeSize}
                      onChange={(e) => setNodeSize(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="uniform">Uniform</option>
                      <option value="byDepth">By Depth</option>
                      <option value="byActivity">By Activity</option>
                    </select>
                  </div>

                  {/* Display Options */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Display Options</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showGrid}
                          onChange={(e) => setShowGrid(e.target.checked)}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Show grid</span>
                      </label>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Visualization Canvas */}
            <div className="flex-1 bg-gray-50 p-4">
              {loading || isRegenerating ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Generating visualization...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md">
                    <div className="text-red-600 mb-4">
                      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Visualization Error</h3>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                      onClick={handleRegenerate}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              ) : visualization ? (
                <canvas
                  ref={canvasRef}
                  className="w-full h-full bg-white rounded-lg shadow-sm"
                  style={{ minHeight: '400px' }}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No visualization available</p>
                    <button
                      onClick={handleRegenerate}
                      className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Generate Visualization
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BranchVisualizationPanel;