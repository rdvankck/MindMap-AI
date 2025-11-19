import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, 
  EyeOff, 
  Keyboard, 
  Volume2, 
  VolumeX, 
  Type, 
  Zap,
  Moon,
  Sun,
  ChevronUp,
  ChevronDown,
  Info
} from 'lucide-react';
import { cn } from '../../utils/cn';

// Types for accessibility settings
export type ContrastMode = 'normal' | 'high' | 'increased';
export type ReducedMotion = 'off' | 'on';
export type FocusVisible = 'always' | 'keyboard' | 'never';
export type ScreenReaderMode = 'off' | 'on';

export interface AccessibilitySettings {
  contrastMode: ContrastMode;
  reducedMotion: ReducedMotion;
  focusVisible: FocusVisible;
  screenReaderMode: ScreenReaderMode;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  announcements: boolean;
  keyboardShortcuts: boolean;
  visualIndicators: boolean;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (updates: Partial<AccessibilitySettings>) => void;
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  setFocus: (element: HTMLElement | null) => void;
  trapFocus: (container: HTMLElement | null) => void;
  releaseFocus: () => void;
}

const defaultSettings: AccessibilitySettings = {
  contrastMode: 'normal',
  reducedMotion: 'off',
  focusVisible: 'keyboard',
  screenReaderMode: 'off',
  fontSize: 'medium',
  announcements: true,
  keyboardShortcuts: true,
  visualIndicators: true,
};

const AccessibilityContext = createContext<AccessibilityContextType | null>(null);

// Hook for using accessibility features
export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
};

// Provider component
export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    // Load settings from localStorage
    const saved = localStorage.getItem('accessibility-settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });
  const [announcementQueue, setAnnouncementQueue] = useState<Array<{
    message: string;
    priority: 'polite' | 'assertive';
    id: string;
  }>>([]);
  const [showPanel, setShowPanel] = useState(false);
  const focusTrapRef = useRef<{ container: HTMLElement | null; previousFocus: HTMLElement | null }>({
    container: null,
    previousFocus: null,
  });

  // Apply settings to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply contrast mode
    root.setAttribute('data-contrast', settings.contrastMode);
    
    // Apply reduced motion
    root.setAttribute('data-reduced-motion', settings.reducedMotion);
    
    // Apply focus visible setting
    root.setAttribute('data-focus-visible', settings.focusVisible);
    
    // Apply screen reader mode
    root.setAttribute('data-screen-reader', settings.screenReaderMode);
    
    // Apply font size
    root.setAttribute('data-font-size', settings.fontSize);
    
    // Apply visual indicators
    root.setAttribute('data-visual-indicators', settings.visualIndicators.toString());
    
    // Save settings to localStorage
    localStorage.setItem('accessibility-settings', JSON.stringify(settings));
  }, [settings]);

  // Detect system preferences
  useEffect(() => {
    const mediaQueries = {
      prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'),
      prefersHighContrast: window.matchMedia('(prefers-contrast: high)'),
      prefersDarkMode: window.matchMedia('(prefers-color-scheme: dark)'),
    };

    const updateSettingsFromPreferences = () => {
      const updates: Partial<AccessibilitySettings> = {};
      
      if (mediaQueries.prefersReducedMotion.matches && settings.reducedMotion === 'off') {
        updates.reducedMotion = 'on';
      }
      
      if (mediaQueries.prefersHighContrast.matches && settings.contrastMode === 'normal') {
        updates.contrastMode = 'high';
      }
      
      if (Object.keys(updates).length > 0) {
        updateSettings(updates);
      }
    };

    // Initial check
    updateSettingsFromPreferences();

    // Listen for changes
    Object.values(mediaQueries).forEach(mq => {
      mq.addEventListener('change', updateSettingsFromPreferences);
    });

    return () => {
      Object.values(mediaQueries).forEach(mq => {
        mq.removeEventListener('change', updateSettingsFromPreferences);
      });
    };
  }, [settings.reducedMotion, settings.contrastMode]);

  const updateSettings = useCallback((updates: Partial<AccessibilitySettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!settings.announcements) return;
    
    const id = `announcement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    setAnnouncementQueue(prev => [...prev, { message, priority, id }]);
    
    // Remove announcement after it's been read
    setTimeout(() => {
      setAnnouncementQueue(prev => prev.filter(a => a.id !== id));
    }, 1000);
  }, [settings.announcements]);

  const setFocus = useCallback((element: HTMLElement | null) => {
    if (element) {
      element.focus();
    }
  }, []);

  const trapFocus = useCallback((container: HTMLElement | null) => {
    if (!container) return;
    
    const previousFocus = document.activeElement as HTMLElement;
    
    focusTrapRef.current = {
      container,
      previousFocus,
    };
    
    // Trap focus within container
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;
    
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }, []);

  const releaseFocus = useCallback(() => {
    const { previousFocus } = focusTrapRef.current;
    
    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
    }
    
    focusTrapRef.current = { container: null, previousFocus: null };
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!settings.keyboardShortcuts) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + A: Toggle accessibility panel
      if (e.altKey && e.key === 'a') {
        e.preventDefault();
        setShowPanel(!showPanel);
      }
      
      // Alt + C: Cycle contrast mode
      if (e.altKey && e.key === 'c') {
        e.preventDefault();
        const modes: ContrastMode[] = ['normal', 'high', 'increased'];
        const currentIndex = modes.indexOf(settings.contrastMode);
        const nextMode = modes[(currentIndex + 1) % modes.length];
        updateSettings({ contrastMode: nextMode });
        announce(`Contrast mode changed to ${nextMode}`);
      }
      
      // Alt + M: Toggle reduced motion
      if (e.altKey && e.key === 'm') {
        e.preventDefault();
        const newMotion = settings.reducedMotion === 'off' ? 'on' : 'off';
        updateSettings({ reducedMotion: newMotion });
        announce(`Reduced motion ${newMotion === 'on' ? 'enabled' : 'disabled'}`);
      }
      
      // Alt + F: Cycle font size
      if (e.altKey && e.key === 'f') {
        e.preventDefault();
        const sizes: Array<'small' | 'medium' | 'large' | 'extra-large'> = ['small', 'medium', 'large', 'extra-large'];
        const currentIndex = sizes.indexOf(settings.fontSize);
        const nextSize = sizes[(currentIndex + 1) % sizes.length];
        updateSettings({ fontSize: nextSize });
        announce(`Font size changed to ${nextSize}`);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [settings.keyboardShortcuts, settings.contrastMode, settings.reducedMotion, settings.fontSize, showPanel, updateSettings, announce]);

  const value: AccessibilityContextType = {
    settings,
    updateSettings,
    announce,
    setFocus,
    trapFocus,
    releaseFocus,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
      
      {/* Accessibility Panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed top-4 right-4 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Accessibility</h3>
              <button
                onClick={() => setShowPanel(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                aria-label="Close accessibility panel"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
              {/* Contrast Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Contrast Mode
                </label>
                <select
                  value={settings.contrastMode}
                  onChange={(e) => updateSettings({ contrastMode: e.target.value as ContrastMode })}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High Contrast</option>
                  <option value="increased">Increased Contrast</option>
                </select>
              </div>
              
              {/* Reduced Motion */}
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.reducedMotion === 'on'}
                    onChange={(e) => updateSettings({ reducedMotion: e.target.checked ? 'on' : 'off' })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Reduce Motion
                  </span>
                </label>
              </div>
              
              {/* Font Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Font Size
                </label>
                <select
                  value={settings.fontSize}
                  onChange={(e) => updateSettings({ fontSize: e.target.value as any })}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="extra-large">Extra Large</option>
                </select>
              </div>
              
              {/* Announcements */}
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.announcements}
                    onChange={(e) => updateSettings({ announcements: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Screen Reader Announcements
                  </span>
                </label>
              </div>
              
              {/* Visual Indicators */}
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.visualIndicators}
                    onChange={(e) => updateSettings({ visualIndicators: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Enhanced Visual Indicators
                  </span>
                </label>
              </div>
              
              {/* Keyboard Shortcuts */}
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.keyboardShortcuts}
                    onChange={(e) => updateSettings({ keyboardShortcuts: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Keyboard Shortcuts
                  </span>
                </label>
              </div>
              
              {/* Keyboard shortcuts info */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Keyboard Shortcuts
                </h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div>Alt + A: Toggle accessibility panel</div>
                  <div>Alt + C: Cycle contrast mode</div>
                  <div>Alt + M: Toggle reduced motion</div>
                  <div>Alt + F: Cycle font size</div>
                  <div>Tab: Navigate between elements</div>
                  <div>Enter/Space: Activate elements</div>
                  <div>Escape: Close dialogs/menus</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Accessibility toggle button */}
      {!showPanel && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => setShowPanel(true)}
          className="fixed bottom-4 right-4 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 z-40"
          aria-label="Open accessibility settings"
        >
          <Type className="w-5 h-5" />
        </motion.button>
      )}
      
      {/* Screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcementQueue.map(({ message, id }) => (
          <div key={id}>{message}</div>
        ))}
      </div>
    </AccessibilityContext.Provider>
  );
};

// Focus management hook
export const useFocusManagement = () => {
  const { setFocus, trapFocus, releaseFocus } = useAccessibility();
  
  return { setFocus, trapFocus, releaseFocus };
};

// Keyboard navigation hook
export const useKeyboardNavigation = (
  items: Array<{ id: string; element: HTMLElement | null }>,
  onSelect?: (id: string) => void
) => {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => {
            const next = prev + 1;
            return next >= items.length ? 0 : next;
          });
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => {
            const next = prev - 1;
            return next < 0 ? items.length - 1 : next;
          });
          break;
          
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < items.length) {
            onSelect?.(items[selectedIndex].id);
          }
          break;
          
        case 'Escape':
          setSelectedIndex(-1);
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedIndex, onSelect]);
  
  // Focus selected item
  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex < items.length) {
      items[selectedIndex].element?.focus();
    }
  }, [selectedIndex, items]);
  
  return { selectedIndex, setSelectedIndex };
};

// ARIA live region component
export const AriaLiveRegion: React.FC<{
  announcements: Array<{ message: string; priority: 'polite' | 'assertive' }>;
}> = ({ announcements }) => {
  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcements
          .filter(a => a.priority === 'polite')
          .map((a, index) => (
            <div key={`polite-${index}`}>{a.message}</div>
          ))}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {announcements
          .filter(a => a.priority === 'assertive')
          .map((a, index) => (
            <div key={`assertive-${index}`}>{a.message}</div>
          ))}
      </div>
    </>
  );
};