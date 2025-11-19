// Core Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: Date;
  updatedAt: Date;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  userId: string;
  isPublic: boolean;
  nodes: Node[];
  edges: Edge[];
  metadata: WorkflowMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowMetadata {
  version: string;
  tags: string[];
  category?: string;
  thumbnail?: string;
  author?: string;
  lastExecutedAt?: Date;
  executionCount: number;
}

// React Flow Types (Extended)
export interface Node {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
  className?: string;
  hidden?: boolean;
  draggable?: boolean;
  selectable?: boolean;
  connectable?: boolean;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  type?: EdgeType;
  data?: EdgeData;
  style?: React.CSSProperties;
  className?: string;
  animated?: boolean;
  selected?: boolean;
  hidden?: boolean;
  label?: string;
  labelStyle?: React.CSSProperties;
  labelShowBg?: boolean;
  labelBgStyle?: React.CSSProperties;
  labelBgPadding?: [number, number];
  labelBgBorderRadius?: number;
  markerEnd?: string;
  markerStart?: string;
  pathOptions?: any;
  interactionWidth?: number;
  zIndex?: number;
  ariaLabel?: string;
}

export interface NodeData {
  label: string;
  config: Record<string, any>;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  status: NodeStatus;
  error?: string;
  metadata?: Record<string, any>;
}

export interface EdgeData {
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  type?: string;
  condition?: string;
}

// Node Types
export type NodeType = 
  | 'llm'
  | 'promptTemplate'
  | 'condition'
  | 'code'
  | 'input'
  | 'output'
  | 'file'
  | 'http'
  | 'wait'
  | 'transform'
  | 'merge'
  | 'split'
  | 'webhook'
  | 'database'
  | 'cache'
  | 'email'
  | 'slack'
  | 'storage';

export type EdgeType = 'default' | 'straight' | 'step' | 'smoothstep';

export type NodeStatus = 'idle' | 'running' | 'completed' | 'error' | 'skipped';

// LLM Provider Types
export type LLMProvider = 'openai' | 'ollama' | 'anthropic' | 'cohere' | 'custom';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  responseFormat?: 'text' | 'json_object';
  timeout?: number;
  retries?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string | Array<{ type: string; text: string; image_url?: string }>;
  name?: string;
  function_call?: any;
}

// Execution Types
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  userId: string;
  status: ExecutionStatus;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  nodeExecutions: NodeExecution[];
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  metadata: Record<string, any>;
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface NodeExecution {
  id: string;
  workflowExecutionId: string;
  nodeId: string;
  nodeType: NodeType;
  status: ExecutionStatus;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  metrics: ExecutionMetrics;
}

export interface ExecutionMetrics {
  duration: number;
  tokenUsage?: TokenUsage;
  cost?: number;
  memoryUsage?: number;
  cacheHit?: boolean;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// Chat Types
export interface ChatMessage {
  id: string;
  workflowId?: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ChatSession {
  id: string;
  userId: string;
  workflowId?: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// File Types
export interface FileUpload {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  path: string;
  uploadedBy: string;
  uploadedAt: Date;
  metadata?: Record<string, any>;
}

// Template Types
export interface NodeTemplate {
  id: string;
  type: NodeType;
  name: string;
  description: string;
  category: string;
  icon: string;
  inputs: NodeTemplatePort[];
  outputs: NodeTemplatePort[];
  config: NodeTemplateConfig[];
  defaultConfig: Record<string, any>;
}

export interface NodeTemplatePort {
  id: string;
  name: string;
  type: PortType;
  required: boolean;
  description?: string;
}

export type PortType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file' | 'llm-response' | 'llm-messages';

export interface NodeTemplateConfig {
  key: string;
  label: string;
  type: ConfigType;
  required: boolean;
  default?: any;
  description?: string;
  validation?: ValidationRule[];
  options?: ConfigOption[];
}

export type ConfigType = 
  | 'text' 
  | 'textarea' 
  | 'number' 
  | 'boolean' 
  | 'select' 
  | 'multiselect' 
  | 'file' 
  | 'json' 
  | 'code';

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  message: string;
}

export interface ConfigOption {
  label: string;
  value: any;
}

// WebSocket Types
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
}

// API Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Auth Types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Settings Types
export interface UserSettings {
  id: string;
  userId: string;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: NotificationSettings;
  llm: LLMSettings;
  ui: UISettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  workflow: boolean;
  chat: boolean;
}

export interface LLMSettings {
  defaultProvider: LLMProvider;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
}

export interface UISettings {
  sidebarCollapsed: boolean;
  showMinimap: boolean;
  snapToGrid: boolean;
  gridSpacing: number;
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
}

export type ErrorCode = 
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_SERVER_ERROR'
  | 'WORKFLOW_EXECUTION_ERROR'
  | 'NODE_EXECUTION_ERROR'
  | 'LLM_PROVIDER_ERROR'
  | 'FILE_UPLOAD_ERROR';

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Conversation Branching Types
export interface ConversationBranch {
  id: string;
  threadId: string;
  branchPointId: string;
  branchName: string;
  branchType: BranchType;
  description?: string;
  color?: string;
  isActive: boolean;
  metadata: BranchMetadata;
  createdAt: Date;
  updatedAt: Date;
  parentBranchId?: string;
  childBranchIds: string[];
  depth: number;
  isMainBranch: boolean;
}

export type BranchType = 'question' | 'alternative' | 'clarification' | 'correction' | 'exploration' | 'summary';

export interface BranchMetadata {
  reasoning?: string;
  contextKeywords?: string[];
  tags?: string[];
  parentMessageId?: string;
  alternativePrompt?: string;
  expectedOutcome?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  confidence?: number;
  userIntent?: string;
}

export interface ConversationNode {
  id: string;
  threadId: string;
  branchId?: string;
  messageId: string;
  nodeType: 'message' | 'branch_point' | 'merge_point' | 'context_switch';
  position: { x: number; y: number };
  data: ConversationNodeData;
  parentNodeIds: string[];
  childNodeIds: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationNodeData {
  message?: ConversationMessage;
  branch?: ConversationBranch;
  metadata?: Record<string, any>;
  style?: NodeStyle;
  status: NodeStatus;
  error?: string;
}

export interface NodeStyle {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  opacity?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  borderWidth?: number;
}

export interface ConversationThread {
  id: string;
  workflowId: string;
  nodeId: string;
  userId: string;
  title: string;
  status: ConversationStatus;
  context: ConversationContext;
  settings: ConversationSettings;
  branches: ConversationBranch[];
  messages: ConversationMessage[];
  nodes: ConversationNode[];
  metadata: ThreadMetadata;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

export interface ConversationSettings {
  contextStrategy: ContextStrategy;
  maxTokens: number;
  temperature: number;
  allowBranching: boolean;
  autoSave: boolean;
  showBranchVisualization: boolean;
  branchColorScheme: ColorScheme;
  maxDepth: number;
  collapseThreshold: number;
}

export type ColorScheme = 'rainbow' | 'ocean' | 'sunset' | 'forest' | 'monochrome' | 'custom';

export interface ThreadMetadata {
  version: string;
  totalBranches: number;
  maxDepth: number;
  lastActivityAt: Date;
  exportFormats: string[];
  collaborators: string[];
  isPublic: boolean;
  tags: string[];
  category?: string;
}

export interface ConversationStatus {
  id: string;
  threadId: string;
  isActive: boolean;
  activeBranchIds: string[];
  currentBranchId?: string;
  lastActivityAt: Date;
  participantIds: string[];
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: Date;
}

export type ConversationStatusType = 'active' | 'paused' | 'closed' | 'archived';

export interface ContextStrategy {
  type: 'full' | 'sliding_window' | 'summarization' | 'selective' | 'hybrid';
  windowSize?: number;
  summaryModel?: string;
  includeSystemPrompt?: boolean;
  prioritizeBranches?: boolean;
  contextCompressionThreshold?: number;
}

export interface ConversationContext {
  messages: ConversationMessage[];
  systemPrompt?: string;
  totalTokens: number;
  contextWindow: number;
  strategy: ContextStrategy;
  nodeId: string;
  workflowId: string;
  threadId: string;
  branchId?: string;
  activeBranches?: string[];
  contextSnapshots?: ContextSnapshot[];
}

export interface ConversationMessage {
  id: string;
  threadId: string;
  nodeId: string;
  branchId?: string;
  parentMessageId?: string;
  role: ConversationRole;
  content: string;
  tokenCount: number;
  timestamp: Date;
  metadata: MessageMetadata;
  isSystem: boolean;
  isDeleted: boolean;
  version: number;
  editedAt?: Date;
  reactions?: MessageReaction[];
}

export type ConversationRole = 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL' | 'FUNCTION';

export interface MessageMetadata {
  model?: string;
  temperature?: number;
  promptTokens?: number;
  completionTokens?: number;
  processingTime?: number;
  cost?: number;
  branchPoint?: boolean;
  branchReason?: string;
  alternativeResponses?: string[];
  confidence?: number;
  sources?: string[];
  tools?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
  duration?: number;
  error?: string;
}

export interface MessageReaction {
  id: string;
  userId: string;
  emoji: string;
  timestamp: Date;
}

export interface ContextSnapshot {
  id: string;
  threadId: string;
  messageId?: string;
  branchId?: string;
  context: ConversationContext;
  tokenCount: number;
  contextStrategy: string;
  compressionRatio?: number;
  expiresAt: Date;
  createdAt: Date;
  metadata?: Record<string, any>;
}

// Branch Operations
export interface BranchOperation {
  type: 'create' | 'update' | 'delete' | 'merge' | 'split' | 'reorder';
  branchId: string;
  threadId: string;
  payload?: any;
  userId: string;
  timestamp: Date;
}

export interface BranchCreationOptions {
  branchName: string;
  branchType: BranchType;
  description?: string;
  color?: string;
  metadata?: Partial<BranchMetadata>;
  copyMessages?: boolean;
  copyContext?: boolean;
  position?: { x: number; y: number };
}

export interface BranchMergeOptions {
  sourceBranchId: string;
  targetBranchId: string;
  mergeStrategy: MergeStrategy;
  resolveConflicts?: ConflictResolution[];
  preserveHistory?: boolean;
}

export type MergeStrategy = 'append' | 'interleave' | 'selective' | 'summarize' | 'vote';

export interface ConflictResolution {
  messageId: string;
  resolution: 'keep_source' | 'keep_target' | 'merge' | 'manual';
  manualResolution?: string;
}

// Branch Visualization
export interface BranchVisualization {
  id: string;
  threadId: string;
  layout: LayoutType;
  nodes: VisualizedNode[];
  edges: VisualizedEdge[];
  groups: NodeGroup[];
  viewState: ViewState;
  filters: VisualizationFilters;
  style: VisualizationStyle;
}

export type LayoutType = 'tree' | 'radial' | 'force' | 'hierarchical' | 'circular';

export interface VisualizedNode {
  id: string;
  type: 'message' | 'branch' | 'merge' | 'context';
  position: { x: number; y: number };
  size: { width: number; height: number };
  style: NodeStyle;
  label: string;
  data: any;
  groupId?: string;
  parentId?: string;
  childIds: string[];
  isSelected: boolean;
  isHighlighted: boolean;
  isVisible: boolean;
}

export interface VisualizedEdge {
  id: string;
  source: string;
  target: string;
  type: 'conversation' | 'branch' | 'merge' | 'context';
  style: EdgeStyle;
  label?: string;
  weight?: number;
  isAnimated: boolean;
  isHighlighted: boolean;
  isVisible: boolean;
}

export interface EdgeStyle {
  color?: string;
  width?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
  arrowType?: 'arrow' | 'arrowclosed' | 'none';
}

export interface NodeGroup {
  id: string;
  name: string;
  type: 'branch' | 'topic' | 'time' | 'custom';
  nodeIds: string[];
  style: GroupStyle;
  metadata?: Record<string, any>;
}

export interface GroupStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
  padding?: number;
}

export interface ViewState {
  zoom: number;
  pan: { x: number; y: number };
  selectedNodeIds: string[];
  highlightedNodeIds: string[];
  focusedNodeId?: string;
  showMinimap: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
}

export interface VisualizationFilters {
  branchTypes: BranchType[];
  dateRange?: { start: Date; end: Date };
  participants: string[];
  tags: string[];
  depth: { min: number; max: number };
  status: NodeStatus[];
  searchTerm?: string;
}

export interface VisualizationStyle {
  colorScheme: ColorScheme;
  nodeStyle: NodeStyle;
  edgeStyle: EdgeStyle;
  font: {
    family: string;
    size: number;
    color: string;
  };
  animation: {
    enabled: boolean;
    duration: number;
    easing: string;
  };
}

// Branch Comparison
export interface BranchComparison {
  id: string;
  threadId: string;
  branchIds: string[];
  comparisonType: ComparisonType;
  metrics: ComparisonMetrics;
  differences: BranchDifference[];
  similarities: BranchSimilarity[];
  recommendations: ComparisonRecommendation[];
  createdAt: Date;
}

export type ComparisonType = 'content' | 'structure' | 'performance' | 'outcomes' | 'comprehensive';

export interface ComparisonMetrics {
  totalMessages: number[];
  tokenUsage: number[];
  responseTime: number[];
  userSatisfaction?: number[];
  goalCompletion?: number[];
  branchDepth: number[];
  conversationLength: number[];
}

export interface BranchDifference {
  type: 'content' | 'structure' | 'timing' | 'outcomes';
  description: string;
  severity: 'low' | 'medium' | 'high';
  branchId: string;
  details?: any;
}

export interface BranchSimilarity {
  type: 'content' | 'structure' | 'timing' | 'outcomes';
  description: string;
  confidence: number;
  details?: any;
}

export interface ComparisonRecommendation {
  type: 'merge' | 'continue' | 'switch' | 'explore';
  description: string;
  targetBranchId: string;
  reasoning: string;
  confidence: number;
}