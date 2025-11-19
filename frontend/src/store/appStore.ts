import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Workflow, UserSettings, FileUpload, ChatSession } from '../shared';

interface AppState {
  // User and auth
  user: any | null;
  isAuthenticated: boolean;
  
  // Settings
  settings: UserSettings | null;
  
  // Current workflow
  currentWorkflow: Workflow | null;
  recentWorkflows: Workflow[];
  
  // Chat sessions
  chatSessions: ChatSession[];
  currentChatSession: ChatSession | null;
  
  // File management
  uploadedFiles: FileUpload[];
  
  // UI state
  sidebarCollapsed: boolean;
  activeTab: 'flow' | 'chat' | 'settings' | 'templates';
  
  // Loading states
  isLoading: boolean;
  loadingMessage: string;
  
  // Actions
  setUser: (user: any) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  logout: () => void;
  
  setSettings: (settings: UserSettings) => void;
  updateSettings: (updates: Partial<UserSettings>) => void;
  
  setCurrentWorkflow: (workflow: Workflow | null) => void;
  addRecentWorkflow: (workflow: Workflow) => void;
  removeRecentWorkflow: (workflowId: string) => void;
  
  setCurrentChatSession: (session: ChatSession | null) => void;
  addChatSession: (session: ChatSession) => void;
  updateChatSession: (sessionId: string, updates: Partial<ChatSession>) => void;
  
  addUploadedFile: (file: FileUpload) => void;
  removeUploadedFile: (fileId: string) => void;
  
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveTab: (tab: 'flow' | 'chat' | 'settings' | 'templates') => void;
  
  setLoading: (isLoading: boolean, message?: string) => void;
  
  // Utility
  reset: () => void;
}

const defaultSettings: UserSettings = {
  id: 'default',
  userId: 'default',
  theme: 'light',
  language: 'en',
  notifications: {
    email: true,
    push: true,
    workflow: true,
    chat: false,
  },
  llm: {
    defaultProvider: 'openai',
    defaultModel: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 1000,
  },
  ui: {
    sidebarCollapsed: false,
    showMinimap: true,
    snapToGrid: false,
    gridSpacing: 20,
  },
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      settings: defaultSettings,
      currentWorkflow: null,
      recentWorkflows: [],
      chatSessions: [],
      currentChatSession: null,
      uploadedFiles: [],
      sidebarCollapsed: false,
      activeTab: 'flow',
      isLoading: false,
      loadingMessage: '',

      // Auth actions
      setUser: (user) => set({ user }),
      
      setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      
      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          currentWorkflow: null,
          recentWorkflows: [],
          currentChatSession: null,
        });
      },

      // Settings actions
      setSettings: (settings) => set({ settings }),
      
      updateSettings: (updates) => {
        const currentSettings = get().settings;
        if (currentSettings) {
          set({
            settings: { ...currentSettings, ...updates },
          });
        }
      },

      // Workflow actions
      setCurrentWorkflow: (workflow) => set({ currentWorkflow: workflow }),
      
      addRecentWorkflow: (workflow) => {
        set((state) => {
          const filtered = state.recentWorkflows.filter((w) => w.id !== workflow.id);
          return {
            recentWorkflows: [workflow, ...filtered].slice(0, 10), // Keep only 10 recent
          };
        });
      },
      
      removeRecentWorkflow: (workflowId) => {
        set((state) => ({
          recentWorkflows: state.recentWorkflows.filter((w) => w.id !== workflowId),
        }));
      },

      // Chat actions
      setCurrentChatSession: (session) => set({ currentChatSession: session }),
      
      addChatSession: (session) => {
        set((state) => ({
          chatSessions: [...state.chatSessions, session],
        }));
      },
      
      updateChatSession: (sessionId, updates) => {
        set((state) => ({
          chatSessions: state.chatSessions.map((session) =>
            session.id === sessionId ? { ...session, ...updates } : session
          ),
          currentChatSession:
            state.currentChatSession?.id === sessionId
              ? { ...state.currentChatSession, ...updates }
              : state.currentChatSession,
        }));
      },

      // File actions
      addUploadedFile: (file) => {
        set((state) => ({
          uploadedFiles: [...state.uploadedFiles, file],
        }));
      },
      
      removeUploadedFile: (fileId) => {
        set((state) => ({
          uploadedFiles: state.uploadedFiles.filter((file) => file.id !== fileId),
        }));
      },

      // UI actions
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      setLoading: (isLoading, message = '') => {
        set({ isLoading, loadingMessage: message });
      },

      // Utility
      reset: () => {
        set({
          user: null,
          isAuthenticated: false,
          currentWorkflow: null,
          recentWorkflows: [],
          currentChatSession: null,
          uploadedFiles: [],
          isLoading: false,
          loadingMessage: '',
        });
      },
    }),
    {
      name: 'app-store',
      partialize: (state) => ({
        settings: state.settings,
        recentWorkflows: state.recentWorkflows,
        chatSessions: state.chatSessions,
        uploadedFiles: state.uploadedFiles,
        sidebarCollapsed: state.sidebarCollapsed,
        activeTab: state.activeTab,
      }),
    }
  )
);

// Initialize store from persisted data
if (typeof window !== 'undefined') {
  const persistedState = localStorage.getItem('app-store');
  if (persistedState) {
    try {
      const parsed = JSON.parse(persistedState);
      useAppStore.setState(parsed.state);
    } catch (error) {
      console.warn('Failed to load persisted app state:', error);
    }
  }
}