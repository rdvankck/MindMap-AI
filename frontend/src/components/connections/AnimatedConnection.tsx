import React, { memo, useEffect, useRef, useState } from 'react';
import { BaseEdge, EdgeProps, getBezierPath, getMarkerEnd } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';

interface AnimatedConnectionProps extends EdgeProps {
  data?: {
    connectionType?: 'data' | 'control' | 'async' | 'error' | 'success';
    dataType?: 'text' | 'json' | 'image' | 'audio' | 'video';
    label?: string;
    animated?: boolean;
    strength?: number;
    isActive?: boolean;
  };
}

interface Particle {
  id: number;
  x: number;
  y: number;
  progress: number;
}

export const AnimatedConnection = memo<AnimatedConnectionProps>(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const pathRef = useRef<SVGPathElement>(null);
  const animationRef = useRef<number>();
  
  // Calculate bezier path
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
  });

  // Get connection styles based on type
  const getConnectionStyles = () => {
    const connectionType = data?.connectionType || 'data';
    const isActive = data?.isActive || false;
    
    const baseStyles = {
      strokeWidth: selected ? 3 : 2,
      filter: isActive ? 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.5))' : 'none',
    };

    switch (connectionType) {
      case 'control':
        return {
          ...baseStyles,
          stroke: '#6366f1',
          strokeDasharray: '5, 5',
        };
      case 'async':
        return {
          ...baseStyles,
          stroke: '#8b5cf6',
          strokeDasharray: '10, 5',
        };
      case 'error':
        return {
          ...baseStyles,
          stroke: '#ef4444',
          strokeDasharray: '3, 3',
        };
      case 'success':
        return {
          ...baseStyles,
          stroke: '#10b981',
        };
      default:
        return {
          ...baseStyles,
          stroke: '#6b7280',
        };
    }
  };

  // Get marker styles based on type
  const getMarkerId = () => {
    const connectionType = data?.connectionType || 'data';
    const dataType = data?.dataType || 'text';
    return `marker-${connectionType}-${dataType}`;
  };

  // Particle animation
  useEffect(() => {
    if (data?.animated && !animationRef.current) {
      const particles: Particle[] = Array.from({ length: 3 }, (_, i) => ({
        id: Date.now() + i,
        x: sourceX,
        y: sourceY,
        progress: (i * 33) / 100,
      }));

      setParticles(particles);

      const animate = () => {
        setParticles((prevParticles) =>
          prevParticles.map((particle) => ({
            ...particle,
            progress: particle.progress >= 1 ? 0 : particle.progress + 0.01,
          }))
        );
        animationRef.current = requestAnimationFrame(animate);
      };

      animate();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
    };
  }, [data?.animated, sourceX, sourceY]);

  // Get particle position along path
  const getParticlePosition = (progress: number) => {
    if (!pathRef.current) return { x: 0, y: 0 };
    
    const path = pathRef.current;
    const length = path.getTotalLength();
    const point = path.getPointAtLength(length * progress);
    
    return { x: point.x, y: point.y };
  };

  const connectionStyles = getConnectionStyles();
  const showLabel = data?.label || data?.dataType;

  return (
    <g
      className={cn(
        'connection-group transition-all duration-200',
        selected && 'connection-selected',
        isHovered && 'connection-hovered'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Define arrow markers */}
      <defs>
        <marker
          id={getMarkerId()}
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d="M0,0 L0,6 L9,3 z"
            fill={connectionStyles.stroke as string}
            className="transition-colors duration-200"
          />
        </marker>
        
        {/* Glow filter */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Main connection line */}
      <motion.path
        ref={pathRef}
        id={id}
        d={edgePath}
        className={cn(
          'react-flow__edge-path',
          data?.animated && 'animated-path'
        )}
        style={{
          ...connectionStyles,
          ...style,
          cursor: 'pointer',
        }}
        markerEnd={getMarkerEnd(markerEnd)}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        whileHover={{ strokeWidth: selected ? 4 : 3 }}
      />

      {/* Animated particles */}
      <AnimatePresence>
        {data?.animated && particles.map((particle) => {
          const position = getParticlePosition(particle.progress);
          return (
            <motion.circle
              key={particle.id}
              r={3}
              fill={connectionStyles.stroke as string}
              filter="url(#glow)"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: [0, 1.2, 1], 
                opacity: [0, 1, 0.8],
                cx: position.x,
                cy: position.y,
              }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          );
        })}
      </AnimatePresence>

      {/* Connection label */}
      <AnimatePresence>
        {(showLabel || isHovered) && (
          <motion.g
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          >
            <rect
              x={labelX - 40}
              y={labelY - 10}
              width="80"
              height="20"
              rx="4"
              fill="white"
              stroke={connectionStyles.stroke as string}
              strokeWidth="1"
              className="drop-shadow-sm"
            />
            <text
              x={labelX}
              y={labelY + 3}
              textAnchor="middle"
              fontSize="10"
              fill="#374151"
              className="pointer-events-none select-none font-medium"
            >
              {data?.label || data?.dataType?.toUpperCase() || ''}
            </text>
          </motion.g>
        )}
      </AnimatePresence>

      {/* Hover indicator */}
      {isHovered && (
        <motion.path
          d={edgePath}
          fill="none"
          stroke={connectionStyles.stroke as string}
          strokeWidth={connectionStyles.strokeWidth as number + 2}
          opacity={0.3}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.2 }}
          pointerEvents="none"
        />
      )}

      {/* Selection indicator */}
      {selected && (
        <motion.path
          d={edgePath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={connectionStyles.strokeWidth as number + 4}
          opacity={0.5}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.2 }}
          pointerEvents="none"
        />
      )}
    </g>
  );
});

AnimatedConnection.displayName = 'AnimatedConnection';