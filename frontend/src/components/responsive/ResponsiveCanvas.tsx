import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
import { useReactFlow, useStore } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Smartphone, 
  Tablet, 
  Monitor, 
  Maximize2,
  Minimize2,
  TouchHand,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move
} from 'lucide-react';
import { cn } from '../../utils/cn';

// Breakpoints for responsive behavior
export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1280,
} as const;

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type InteractionMode = 'touch' | 'mouse' | 'hybrid';

interface ResponsiveCanvasProps {
  className?: string;
  onDeviceChange?: (device: DeviceType) => void;
  onInteractionModeChange?: (mode: InteractionMode) => void;
  enableAdaptiveControls?: boolean;
  enableTouchGestures?: boolean;
  enableMobileOptimization?: boolean;
  children: React.ReactNode;
}

export const ResponsiveCanvas: React.FC<ResponsiveCanvasProps> = memo(({
  className,
  onDeviceChange,
  onInteractionModeChange,
  enableAdaptiveControls = true,
  enableTouchGestures = true,
  enableMobileOptimization = true,
  children,
}) => {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('mouse');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [touchState, setTouchState] = useState({
    isZooming: false,
    isPanning: false,
    lastTouchDistance: 0,
    lastTouchCenter: { x: 0, y: 0 },
  });

  // Detect device type
  const detectDeviceType = useCallback(() => {
    const width = window.innerWidth;
    let detectedDevice: DeviceType = 'desktop';
    
    if (width < BREAKPOINTS.mobile) {
      detectedDevice = 'mobile';
    } else if (width < BREAKPOINTS.tablet) {
      detectedDevice = 'tablet';
    }
    
    setDeviceType(detectedDevice);
    onDeviceChange?.(detectedDevice);
    
    return detectedDevice;
  }, [onDeviceChange]);

  // Detect interaction mode
  const detectInteractionMode = useCallback(() => {
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const hasMouse = matchMedia('(pointer: fine)').matches;
    
    let detectedMode: InteractionMode = 'mouse';
    if (hasTouch && hasMouse) {
      detectedMode = 'hybrid';
    } else if (hasTouch) {
      detectedMode = 'touch';
    }
    
    setInteractionMode(detectedMode);
    onInteractionModeChange?.(detectedMode);
    
    return detectedMode;
  }, [onInteractionModeChange]);

  // Initialize detection
  useEffect(() => {
    const device = detectDeviceType();
    const mode = detectInteractionMode();
    
    // Auto-hide controls on mobile
    if (device === 'mobile' && enableMobileOptimization) {
      setShowControls(false);
    }
  }, [detectDeviceType, detectInteractionMode, enableMobileOptimization]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      detectDeviceType();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [detectDeviceType]);

  // Touch gesture handling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enableTouchGestures) return;
    
    const touches = e.touches;
    if (touches.length === 2) {
      // Pinch to zoom
      const distance = Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
      );
      const center = {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
      };
      
      setTouchState(prev => ({
        ...prev,
        isZooming: true,
        lastTouchDistance: distance,
        lastTouchCenter: center,
      }));
    } else if (touches.length === 1) {
      // Single touch for panning
      setTouchState(prev => ({
        ...prev,
        isPanning: true,
        lastTouchCenter: {
          x: touches[0].clientX,
          y: touches[0].clientY,
        },
      }));
    }
  }, [enableTouchGestures]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enableTouchGestures) return;
    
    const touches = e.touches;
    if (touches.length === 2 && touchState.isZooming) {
      e.preventDefault();
      
      const currentDistance = Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
      );
      
      const scaleFactor = currentDistance / touchState.lastTouchDistance;
      
      if (scaleFactor > 1.1) {
        zoomIn();
      } else if (scaleFactor < 0.9) {
        zoomOut();
      }
      
      setTouchState(prev => ({
        ...prev,
        lastTouchDistance: currentDistance,
      }));
    } else if (touches.length === 1 && touchState.isPanning) {
      // Panning would be handled by ReactFlow's built-in touch support
      setTouchState(prev => ({
        ...prev,
        lastTouchCenter: {
          x: touches[0].clientX,
          y: touches[0].clientY,
        },
      }));
    }
  }, [enableTouchGestures, touchState.isZooming, touchState.lastTouchDistance, touchState.isPanning, zoomIn, zoomOut]);

  const handleTouchEnd = useCallback(() => {
    if (!enableTouchGestures) return;
    
    setTouchState({
      isZooming: false,
      isPanning: false,
      lastTouchDistance: 0,
      lastTouchCenter: { x: 0, y: 0 },
    });
  }, [enableTouchGestures]);

  // Fullscreen handling
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Adaptive controls
  const getControlVariant = useCallback(() => {
    if (!enableAdaptiveControls) return 'desktop';
    
    switch (deviceType) {
      case 'mobile':
        return 'mobile';
      case 'tablet':
        return 'tablet';
      case 'desktop':
      default:
        return 'desktop';
    }
  }, [deviceType, enableAdaptiveControls]);

  // Keyboard shortcuts for mobile
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (deviceType !== 'mobile') return;
      
      switch (e.key) {
        case 'Escape':
          setShowControls(!showControls);
          break;
        case 'f':
          toggleFullscreen();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deviceType, showControls, toggleFullscreen]);

  // Accessibility: Announce device changes
  useEffect(() => {
    const announcement = `Switched to ${deviceType} mode with ${interactionMode} interaction`;
    const announcementElement = document.createElement('div');
    announcementElement.setAttribute('aria-live', 'polite');
    announcementElement.setAttribute('aria-atomic', 'true');
    announcementElement.className = 'sr-only';
    announcementElement.textContent = announcement;
    
    document.body.appendChild(announcementElement);
    setTimeout(() => {
      document.body.removeChild(announcementElement);
    }, 1000);
  }, [deviceType, interactionMode]);

  const controlVariant = getControlVariant();

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-full overflow-hidden',
        'touch-manipulation', // Optimize for touch
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="application"
      aria-label="Node-based workflow canvas"
    >
      {children}
      
      {/* Responsive controls overlay */}
      <AnimatePresence>
        {(showControls || deviceType !== 'mobile') && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={cn(
              'absolute bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 z-10',
              {
                // Mobile controls
                'flex flex-col space-y-1': controlVariant === 'mobile',
                'bottom-4 left-4 right-4': controlVariant === 'mobile',
                
                // Tablet controls
                'flex items-center space-x-2': controlVariant === 'tablet',
                
                // Desktop controls
                'flex flex-col space-y-1': controlVariant === 'desktop',
              }
            )}
          >
            {/* Device indicator */}
            <div className="flex items-center space-x-2 px-2 py-1 text-xs text-gray-600 dark:text-gray-300">
              {deviceType === 'mobile' && <Smartphone className="w-3 h-3" />}
              {deviceType === 'tablet' && <Tablet className="w-3 h-3" />}
              {deviceType === 'desktop' && <Monitor className="w-3 h-3" />}
              <span className="capitalize">{deviceType}</span>
              {interactionMode === 'touch' && <TouchHand className="w-3 h-3" />}
              {interactionMode === 'mouse' && <MousePointer2 className="w-3 h-3" />}
            </div>
            
            {/* Control buttons */}
            <div className={cn(
              'flex',
              {
                'flex-col space-y-1': controlVariant === 'mobile',
                'space-x-1': controlVariant === 'tablet',
                'flex-col space-y-1': controlVariant === 'desktop',
              }
            )}>
              <button
                onClick={() => zoomIn()}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => zoomOut()}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => fitView()}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Fit view"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              
              <button
                onClick={toggleFullscreen}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Mobile-specific gesture hints */}
      {deviceType === 'mobile' && enableTouchGestures && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-2 rounded-lg text-xs max-w-[200px]"
        >
          <div className="font-medium mb-1">Touch Gestures</div>
          <div className="space-y-1 opacity-90">
            <div>• Single finger: Pan canvas</div>
            <div>• Two fingers: Pinch to zoom</div>
            <div>• Tap: Select nodes</div>
            <div>• Long press: Context menu</div>
          </div>
        </motion.div>
      )}
      
      {/* Loading overlay for mobile */}
      {deviceType === 'mobile' && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="sr-only" aria-live="polite">
            Mobile canvas interface loaded. Use touch gestures to interact with nodes.
          </div>
        </div>
      )}
      
      {/* Keyboard navigation hint for desktop */}
      {deviceType === 'desktop' && (
        <div className="sr-only" aria-live="polite">
          Desktop canvas interface loaded. Use keyboard shortcuts: Tab to navigate, Space to pan, F for fullscreen.
        </div>
      )}
    </div>
  );
});

ResponsiveCanvas.displayName = 'ResponsiveCanvas';