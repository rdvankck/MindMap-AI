import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ConversationBranch, BranchTree, BranchVisualization, BranchComparison, BranchCreationOptions, BranchMergeOptions } from '../shared';

interface ConversationState {
  // Active conversation
  activeThreadId: string | null;
  activeBranchId: string | null;
  
  // Branch data
  branches: ConversationBranch[];
  branchTree: BranchTree | null;
  branchVisualization: BranchVisualization | null;
  branchComparison: BranchComparison | null;
  
  // UI state
  isCreatingBranch: boolean;
  isMergingBranches: boolean;
  showBranchPanel: boolean;
  showVisualization: boolean;
  showComparison: boolean;
  
  // Selected branches
  selectedBranchIds: string[];
  comparisonBranchIds: string[];
  
  // Loading states
  loadingBranches: boolean;
  loadingVisualization: boolean;
  loadingComparison: boolean;
  
  // Error states
  branchesError: string | null;
  visualizationError: string | null;
  comparisonError: string | null;
  
  // Branch creation state
  branchCreationOptions: Partial<BranchCreationOptions> | null;
  branchMergeOptions: Partial<BranchMergeOptions> | null;
  
  // Visualization options
  visualizationOptions: {
    layoutType: 'tree' | 'radial' | 'force' | 'hierarchical' | 'circular';
    filters?: {
      branchTypes?: string[];
      dateRange?: { start: Date; end: Date };
      participants?: string[];
      tags?: string[];
      depth?: { min: number; max: number };
    };
    style?: {
      colorScheme?: 'rainbow' | 'ocean' | 'sunset' | 'forest' | 'monochrome' | 'custom';
      nodeSize?: 'uniform' | 'byDepth' | 'byActivity';
      edgeWeight?: 'uniform' | 'byTime' | 'bySimilarity';
    };
  };
  
  // Actions
  setActiveThread: (threadId: string | null) => void;
  setActiveBranch: (branchId: string | null) => void;
  
  // Branch management
  setBranches: (branches: ConversationBranch[]) => void;
  addBranch: (branch: ConversationBranch) => void;
  updateBranch: (branchId: string, updates: Partial<ConversationBranch>) => void;
  removeBranch: (branchId: string) => void;
  
  // Branch tree
  setBranchTree: (tree: BranchTree) => void;
  clearBranchTree: () => void;
  
  // Visualization
  setBranchVisualization: (visualization: BranchVisualization) => void;
  updateVisualizationOptions: (options: Partial<ConversationState['visualizationOptions']>) => void;
  clearBranchVisualization: () => void;
  
  // Comparison
  setBranchComparison: (comparison: BranchComparison) => void;
  clearBranchComparison: () => void;
  
  // Selection management
  selectBranch: (branchId: string, multiSelect?: boolean) => void;
  deselectBranch: (branchId: string) => void;
  selectAllBranches: () => void;
  clearSelectedBranches: () => void;
  
  // Comparison branches
  addToComparison: (branchId: string) => void;
  removeFromComparison: (branchId: string) => void;
  clearComparisonBranches: () => void;
  
  // UI state
  toggleBranchPanel: () => void;
  toggleVisualization: () => void;
  toggleComparison: () => void;
  
  // Loading states
  setLoadingBranches: (loading: boolean) => void;
  setLoadingVisualization: (loading: boolean) => void;
  setLoadingComparison: (loading: boolean) => void;
  
  // Error states
  setBranchesError: (error: string | null) => void;
  setVisualizationError: (error: string | null) => void;
  setComparisonError: (error: string | null) => void;
  
  // Branch creation
  setCreatingBranch: (creating: boolean) => void;
  setBranchCreationOptions: (options: Partial<BranchCreationOptions> | null) => void;
  
  // Branch merging
  setMergingBranches: (merging: boolean) => void;
  setBranchMergeOptions: (options: Partial<BranchMergeOptions> | null) => void;
  
  // Reset state
  resetConversationState: () => void;
  
  // Computed values
  getActiveBranch: () => ConversationBranch | null;
  getSelectedBranches: () => ConversationBranch[];
  getComparisonBranches: () => ConversationBranch[];
  getMainBranch: () => ConversationBranch | null;
  getBranchDepth: (branchId: string) => number;
  getChildBranches: (branchId: string) => ConversationBranch[];
  getParentBranch: (branchId: string) => ConversationBranch | null;
  getBranchPath: (branchId: string) => ConversationBranch[];
  getBranchColor: (branchType: string) => string;
}

export const useConversationStore = create<ConversationState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    activeThreadId: null,
    activeBranchId: null,
    branches: [],
    branchTree: null,
    branchVisualization: null,
    branchComparison: null,
    isCreatingBranch: false,
    isMergingBranches: false,
    showBranchPanel: true,
    showVisualization: false,
    showComparison: false,
    selectedBranchIds: [],
    comparisonBranchIds: [],
    loadingBranches: false,
    loadingVisualization: false,
    loadingComparison: false,
    branchesError: null,
    visualizationError: null,
    comparisonError: null,
    branchCreationOptions: null,
    branchMergeOptions: null,
    visualizationOptions: {
      layoutType: 'tree',
      style: {
        colorScheme: 'rainbow',
        nodeSize: 'byDepth',
      },
    },

    // Active conversation management
    setActiveThread: (threadId) => {
      set({ activeThreadId: threadId });
      if (threadId) {
        get().clearSelectedBranches();
        get().clearComparisonBranches();
        get().clearBranchTree();
        get().clearBranchVisualization();
        get().clearBranchComparison();
      }
    },

    setActiveBranch: (branchId) => {
      set({ activeBranchId: branchId });
    },

    // Branch management
    setBranches: (branches) => {
      set({ branches });
      // Clear selected branches that no longer exist
      const state = get();
      const validSelectedIds = state.selectedBranches.filter(id => 
        branches.some(branch => branch.id === id)
      );
      const validComparisonIds = state.comparisonBranchIds.filter(id => 
        branches.some(branch => branch.id === id)
      );
      
      if (validSelectedIds.length !== state.selectedBranchIds.length) {
        set({ selectedBranchIds: validSelectedIds });
      }
      if (validComparisonIds.length !== state.comparisonBranchIds.length) {
        set({ comparisonBranchIds: validComparisonIds });
      }
    },

    addBranch: (branch) => {
      set((state) => ({
        branches: [...state.branches, branch],
      }));
    },

    updateBranch: (branchId, updates) => {
      set((state) => ({
        branches: state.branches.map((branch) =>
          branch.id === branchId ? { ...branch, ...updates } : branch
        ),
      }));
    },

    removeBranch: (branchId) => {
      set((state) => ({
        branches: state.branches.filter((branch) => branch.id !== branchId),
        selectedBranchIds: state.selectedBranchIds.filter(id => id !== branchId),
        comparisonBranchIds: state.comparisonBranchIds.filter(id => id !== branchId),
        activeBranchId: state.activeBranchId === branchId ? null : state.activeBranchId,
      }));
    },

    // Branch tree
    setBranchTree: (tree) => {
      set({ branchTree: tree });
    },

    clearBranchTree: () => {
      set({ branchTree: null });
    },

    // Visualization
    setBranchVisualization: (visualization) => {
      set({ branchVisualization: visualization });
    },

    updateVisualizationOptions: (options) => {
      set((state) => ({
        visualizationOptions: { ...state.visualizationOptions, ...options },
      }));
    },

    clearBranchVisualization: () => {
      set({ branchVisualization: null });
    },

    // Comparison
    setBranchComparison: (comparison) => {
      set({ branchComparison: comparison });
    },

    clearBranchComparison: () => {
      set({ branchComparison: null });
    },

    // Selection management
    selectBranch: (branchId, multiSelect = false) => {
      const state = get();
      if (multiSelect) {
        if (state.selectedBranchIds.includes(branchId)) {
          set({ selectedBranchIds: state.selectedBranchIds.filter(id => id !== branchId) });
        } else {
          set({ selectedBranchIds: [...state.selectedBranchIds, branchId] });
        }
      } else {
        set({ selectedBranchIds: [branchId] });
      }
    },

    deselectBranch: (branchId) => {
      set((state) => ({
        selectedBranchIds: state.selectedBranchIds.filter(id => id !== branchId),
      }));
    },

    selectAllBranches: () => {
      const { branches } = get();
      set({ selectedBranchIds: branches.map(branch => branch.id) });
    },

    clearSelectedBranches: () => {
      set({ selectedBranchIds: [] });
    },

    // Comparison branches
    addToComparison: (branchId) => {
      const state = get();
      if (!state.comparisonBranchIds.includes(branchId) && state.comparisonBranchIds.length < 5) {
        set({ comparisonBranchIds: [...state.comparisonBranchIds, branchId] });
      }
    },

    removeFromComparison: (branchId) => {
      set((state) => ({
        comparisonBranchIds: state.comparisonBranchIds.filter(id => id !== branchId),
      }));
    },

    clearComparisonBranches: () => {
      set({ comparisonBranchIds: [] });
    },

    // UI state
    toggleBranchPanel: () => {
      set((state) => ({ showBranchPanel: !state.showBranchPanel }));
    },

    toggleVisualization: () => {
      set((state) => ({ showVisualization: !state.showVisualization }));
    },

    toggleComparison: () => {
      set((state) => ({ showComparison: !state.showComparison }));
    },

    // Loading states
    setLoadingBranches: (loading) => {
      set({ loadingBranches: loading });
    },

    setLoadingVisualization: (loading) => {
      set({ loadingVisualization: loading });
    },

    setLoadingComparison: (loading) => {
      set({ loadingComparison: loading });
    },

    // Error states
    setBranchesError: (error) => {
      set({ branchesError: error });
    },

    setVisualizationError: (error) => {
      set({ visualizationError: error });
    },

    setComparisonError: (error) => {
      set({ comparisonError: error });
    },

    // Branch creation
    setCreatingBranch: (creating) => {
      set({ isCreatingBranch: creating });
    },

    setBranchCreationOptions: (options) => {
      set({ branchCreationOptions: options });
    },

    // Branch merging
    setMergingBranches: (merging) => {
      set({ isMergingBranches: merging });
    },

    setBranchMergeOptions: (options) => {
      set({ branchMergeOptions: options });
    },

    // Reset state
    resetConversationState: () => {
      set({
        activeThreadId: null,
        activeBranchId: null,
        branches: [],
        branchTree: null,
        branchVisualization: null,
        branchComparison: null,
        isCreatingBranch: false,
        isMergingBranches: false,
        showBranchPanel: true,
        showVisualization: false,
        showComparison: false,
        selectedBranchIds: [],
        comparisonBranchIds: [],
        loadingBranches: false,
        loadingVisualization: false,
        loadingComparison: false,
        branchesError: null,
        visualizationError: null,
        comparisonError: null,
        branchCreationOptions: null,
        branchMergeOptions: null,
      });
    },

    // Computed values (implemented as methods)
    getActiveBranch: () => {
      const { branches, activeBranchId } = get();
      return branches.find(branch => branch.id === activeBranchId) || null;
    },

    getSelectedBranches: () => {
      const { branches, selectedBranchIds } = get();
      return branches.filter(branch => selectedBranchIds.includes(branch.id));
    },

    getComparisonBranches: () => {
      const { branches, comparisonBranchIds } = get();
      return branches.filter(branch => comparisonBranchIds.includes(branch.id));
    },

    getMainBranch: () => {
      const { branches } = get();
      return branches.find(branch => branch.isMainBranch) || null;
    },

    getBranchDepth: (branchId) => {
      const { branches } = get();
      const branch = branches.find(b => b.id === branchId);
      return branch?.depth || 0;
    },

    getChildBranches: (branchId) => {
      const { branches } = get();
      return branches.filter(branch => branch.parentBranchId === branchId);
    },

    getParentBranch: (branchId) => {
      const { branches } = get();
      const branch = branches.find(b => b.id === branchId);
      if (!branch?.parentBranchId) return null;
      return branches.find(b => b.id === branch.parentBranchId) || null;
    },

    getBranchPath: (branchId) => {
      const { branches } = get();
      const path: ConversationBranch[] = [];
      let currentBranch = branches.find(b => b.id === branchId);
      
      while (currentBranch) {
        path.unshift(currentBranch);
        if (currentBranch.parentBranchId) {
          currentBranch = branches.find(b => b.id === currentBranch!.parentBranchId) || null;
        } else {
          break;
        }
      }
      
      return path;
    },

    getBranchColor: (branchType) => {
      const colorPalettes = {
        question: '#3b82f6',
        alternative: '#f97316',
        clarification: '#8b5cf6',
        correction: '#ef4444',
        exploration: '#10b981',
        summary: '#6b7280',
      };
      
      return colorPalettes[branchType as keyof typeof colorPalettes] || '#6b7280';
    },
  }))
);

// Subscribe to state changes and persist to localStorage
if (typeof window !== 'undefined') {
  useConversationStore.subscribe(
    (state) => ({
      activeThreadId: state.activeThreadId,
      activeBranchId: state.activeBranchId,
      showBranchPanel: state.showBranchPanel,
      showVisualization: state.showVisualization,
      showComparison: state.showComparison,
      visualizationOptions: state.visualizationOptions,
    }),
    (persistedState) => {
      localStorage.setItem(
        'conversation-state',
        JSON.stringify(persistedState)
      );
    }
  );
}

// Load persisted state on startup
const loadPersistedConversationState = () => {
  if (typeof window === 'undefined') return;

  try {
    const persisted = localStorage.getItem('conversation-state');
    if (persisted) {
      const state = JSON.parse(persisted);
      const store = useConversationStore.getState();
      
      if (state.activeThreadId) store.setActiveThread(state.activeThreadId);
      if (state.activeBranchId) store.setActiveBranch(state.activeBranchId);
      if (state.showBranchPanel !== undefined) {
        store.set({ showBranchPanel: state.showBranchPanel });
      }
      if (state.showVisualization !== undefined) {
        store.set({ showVisualization: state.showVisualization });
      }
      if (state.showComparison !== undefined) {
        store.set({ showComparison: state.showComparison });
      }
      if (state.visualizationOptions) {
        store.updateVisualizationOptions(state.visualizationOptions);
      }
    }
  } catch (error) {
    console.warn('Failed to load persisted conversation state:', error);
  }
};

// Initialize persisted state
if (typeof window !== 'undefined') {
  loadPersistedConversationState();
}