import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Info, 
  Loader2, 
  Zap,
  AlertTriangle,
  TrendingUp,
  Clock,
  Target,
  Activity
} from 'lucide-react';
import { cn } from '../../utils/cn';

// Types for visual feedback
export type FeedbackType = 
  | 'success' 
  | 'error' 
  | 'warning' 
  | 'info' 
  | 'loading' 
  | 'progress' 
  | 'validation';

export type FeedbackPosition = 
  | 'top-right' 
  | 'top-left' 
  | 'top-center'
  | 'bottom-right' 
  | 'bottom-left' 
  | 'bottom-center'
  | 'center';

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  progress?: number;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
  }>;
  metadata?: Record<string, any>;
  timestamp: number;
}

interface VisualFeedbackContextType {
  addFeedback: (feedback: Omit<FeedbackItem, 'id' | 'timestamp'>) => string;
  removeFeedback: (id: string) => void;
  clearAllFeedback: () => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
  showLoading: (title: string, message?: string) => void;
  showProgress: (title: string, progress: number) => void;
  updateProgress: (id: string, progress: number) => void;
}

const VisualFeedbackContext = createContext<VisualFeedbackContextType | null>(null);

// Hook for using visual feedback
export const useVisualFeedback = () => {
  const context = useContext(VisualFeedbackContext);
  if (!context) {
    throw new Error('useVisualFeedback must be used within VisualFeedbackProvider');
  }
  return context;
};

// Provider component
export const VisualFeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);

  const addFeedback = useCallback((feedbackItem: Omit<FeedbackItem, 'id' | 'timestamp'>) => {
    const id = `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newFeedback: FeedbackItem = {
      ...feedbackItem,
      id,
      timestamp: Date.now(),
    };
    
    setFeedback((prev) => [...prev, newFeedback]);
    
    // Auto-remove if not persistent and has duration
    if (!feedbackItem.persistent && feedbackItem.duration) {
      setTimeout(() => {
        removeFeedback(id);
      }, feedbackItem.duration);
    }
    
    return id;
  }, []);

  const removeFeedback = useCallback((id: string) => {
    setFeedback((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearAllFeedback = useCallback(() => {
    setFeedback([]);
  }, []);

  // Convenience methods
  const showSuccess = useCallback((title: string, message?: string) => {
    return addFeedback({
      type: 'success',
      title,
      message,
      duration: 3000,
    });
  }, [addFeedback]);

  const showError = useCallback((title: string, message?: string) => {
    return addFeedback({
      type: 'error',
      title,
      message,
      duration: 5000,
      persistent: true,
    });
  }, [addFeedback]);

  const showWarning = useCallback((title: string, message?: string) => {
    return addFeedback({
      type: 'warning',
      title,
      message,
      duration: 4000,
    });
  }, [addFeedback]);

  const showInfo = useCallback((title: string, message?: string) => {
    return addFeedback({
      type: 'info',
      title,
      message,
      duration: 3000,
    });
  }, [addFeedback]);

  const showLoading = useCallback((title: string, message?: string) => {
    return addFeedback({
      type: 'loading',
      title,
      message,
      persistent: true,
    });
  }, [addFeedback]);

  const showProgress = useCallback((title: string, progress: number) => {
    return addFeedback({
      type: 'progress',
      title,
      progress,
      persistent: true,
    });
  }, [addFeedback]);

  const updateProgress = useCallback((id: string, progress: number) => {
    setFeedback((prev) =>
      prev.map((item) =>
        item.id === id && item.type === 'progress'
          ? { ...item, progress, title: `${item.title.split('(')[0]} (${progress}%)` }
          : item
      )
    );
  }, []);

  const value: VisualFeedbackContextType = {
    addFeedback,
    removeFeedback,
    clearAllFeedback,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoading,
    showProgress,
    updateProgress,
  };

  return (
    <VisualFeedbackContext.Provider value={value}>
      {children}
      <FeedbackContainer feedback={feedback} onRemove={removeFeedback} />
    </VisualFeedbackContext.Provider>
  );
};

// Individual feedback item component
const FeedbackItemComponent: React.FC<{
  item: FeedbackItem;
  onRemove: (id: string) => void;
  position?: FeedbackPosition;
}> = ({ item, onRemove, position = 'top-right' }) => {
  const getIcon = () => {
    switch (item.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5" />;
      case 'error':
        return <XCircle className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'info':
        return <Info className="w-5 h-5" />;
      case 'loading':
        return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'progress':
        return <Activity className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getStyles = () => {
    switch (item.type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'loading':
        return 'bg-gray-50 border-gray-200 text-gray-800';
      case 'progress':
        return 'bg-purple-50 border-purple-200 text-purple-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getIconColor = () => {
    switch (item.type) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      case 'info':
        return 'text-blue-600';
      case 'loading':
        return 'text-gray-600';
      case 'progress':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex items-start space-x-3 p-4 rounded-lg border shadow-lg max-w-sm cursor-pointer',
        getStyles()
      )}
      onClick={() => onRemove(item.id)}
    >
      <div className={cn('flex-shrink-0', getIconColor())}>
        {getIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{item.title}</div>
        {item.message && (
          <div className="mt-1 text-sm opacity-90">{item.message}</div>
        )}
        
        {/* Progress bar for progress feedback */}
        {item.type === 'progress' && item.progress !== undefined && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <motion.div
                className="bg-purple-600 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${item.progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}
        
        {/* Actions */}
        {item.actions && item.actions.length > 0 && (
          <div className="mt-3 flex space-x-2">
            {item.actions.map((action, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                }}
                className={cn(
                  'px-3 py-1 text-xs rounded font-medium transition-colors',
                  action.variant === 'primary' && 'bg-blue-600 text-white hover:bg-blue-700',
                  action.variant === 'secondary' && 'bg-gray-200 text-gray-800 hover:bg-gray-300',
                  action.variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
                  !action.variant && 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Close button */}
      {!item.persistent && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.id);
          }}
          className="flex-shrink-0 p-1 hover:bg-black/10 rounded transition-colors"
        >
          <XCircle className="w-4 h-4 opacity-60" />
        </button>
      )}
    </motion.div>
  );
};

// Container for all feedback items
const FeedbackContainer: React.FC<{
  feedback: FeedbackItem[];
  onRemove: (id: string) => void;
}> = ({ feedback, onRemove }) => {
  // Group feedback by position
  const groupedFeedback = feedback.reduce((groups, item) => {
    const position = item.metadata?.position || 'top-right';
    if (!groups[position]) {
      groups[position] = [];
    }
    groups[position].push(item);
    return groups;
  }, {} as Record<FeedbackPosition, FeedbackItem[]>);

  const getPositionStyles = (position: FeedbackPosition) => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-center':
        return 'bottom-4 left-1/2 transform -translate-x-1/2';
      case 'center':
        return 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2';
      default:
        return 'top-4 right-4';
    }
  };

  return createPortal(
    <>
      {Object.entries(groupedFeedback).map(([position, items]) => (
        <div
          key={position}
          className={cn(
            'fixed z-50 space-y-2 max-h-screen overflow-hidden',
            getPositionStyles(position as FeedbackPosition)
          )}
        >
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <FeedbackItemComponent
                key={item.id}
                item={item}
                onRemove={onRemove}
                position={position as FeedbackPosition}
              />
            ))}
          </AnimatePresence>
        </div>
      ))}
    </>,
    document.body
  );
};

// Node-specific feedback indicators
export const NodeFeedbackIndicator: React.FC<{
  nodeId: string;
  status: 'idle' | 'running' | 'completed' | 'error' | 'skipped';
  message?: string;
  progress?: number;
}> = ({ nodeId, status, message, progress }) => {
  const { addFeedback, updateProgress, removeFeedback } = useVisualFeedback();
  const feedbackIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    // Remove existing feedback if any
    if (feedbackIdRef.current) {
      removeFeedback(feedbackIdRef.current);
      feedbackIdRef.current = null;
    }

    // Add new feedback based on status
    if (status === 'running') {
      feedbackIdRef.current = addFeedback({
        type: 'loading',
        title: `Processing ${nodeId}`,
        message,
        persistent: true,
      });
    } else if (status === 'error') {
      feedbackIdRef.current = addFeedback({
        type: 'error',
        title: `Error in ${nodeId}`,
        message,
        persistent: true,
      });
    } else if (status === 'completed') {
      feedbackIdRef.current = addFeedback({
        type: 'success',
        title: `${nodeId} completed`,
        message,
        duration: 2000,
      });
    }

    return () => {
      if (feedbackIdRef.current) {
        removeFeedback(feedbackIdRef.current);
      }
    };
  }, [nodeId, status, message, addFeedback, removeFeedback]);

  // Update progress if provided
  useEffect(() => {
    if (progress !== undefined && feedbackIdRef.current) {
      updateProgress(feedbackIdRef.current, progress);
    }
  }, [progress, updateProgress]);

  return null;
};

// Connection-specific feedback
export const ConnectionFeedbackIndicator: React.FC<{
  connectionId: string;
  status: 'idle' | 'transferring' | 'completed' | 'error';
  dataSize?: string;
}> = ({ connectionId, status, dataSize }) => {
  const { addFeedback, removeFeedback } = useVisualFeedback();

  useEffect(() => {
    if (status === 'transferring') {
      const id = addFeedback({
        type: 'info',
        title: `Transferring data via ${connectionId}`,
        message: dataSize ? `Size: ${dataSize}` : undefined,
        persistent: true,
      });

      return () => removeFeedback(id);
    }
  }, [connectionId, status, dataSize, addFeedback, removeFeedback]);

  return null;
};