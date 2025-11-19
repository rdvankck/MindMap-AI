// Enhanced visual node connections and interactions for the node-based LLM interface

// Connection components
export { AnimatedConnection } from '../connections/AnimatedConnection';
export { ConnectionType, DataType, type ConnectionData, type VisualConnection, CONNECTION_COLORS, CONNECTION_STYLES } from '../connections/ConnectionTypes';

// Enhanced node components
export { EnhancedNodeBase } from '../nodes/enhanced/EnhancedNodeBase';
export { EnhancedPromptNode } from '../nodes/enhanced/EnhancedPromptNode';

// Canvas components
export { EnhancedCanvasProvider, EnhancedCanvas } from '../canvas/EnhancedCanvas';
export { AdvancedMinimap } from '../canvas/AdvancedMinimap';

// Visual feedback system
export { 
  VisualFeedbackProvider, 
  useVisualFeedback, 
  NodeFeedbackIndicator, 
  ConnectionFeedbackIndicator,
  type FeedbackType,
  type FeedbackPosition,
  type FeedbackItem,
  type VisualFeedbackContextType
} from '../feedback/VisualFeedbackSystem';

// Responsive components
export { ResponsiveCanvas, BREAKPOINTS, type DeviceType, type InteractionMode } from '../responsive/ResponsiveCanvas';

// Accessibility features
export { 
  AccessibilityProvider,
  useAccessibility,
  useFocusManagement,
  useKeyboardNavigation,
  AriaLiveRegion,
  type AccessibilitySettings,
  type ContrastMode,
  type ReducedMotion,
  type FocusVisible,
  type ScreenReaderMode
} from '../accessibility/AccessibilityFeatures';

// Demo component
export { EnhancedWorkflowDemo } from '../demo/EnhancedWorkflowDemo';

// Styles
import '../../styles/enhanced-animations.css';