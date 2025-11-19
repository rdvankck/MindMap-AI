import React from 'react';
import WorkflowDemo from '@/pages/WorkflowDemo';
import AdvancedChatInterface from '@/pages/AdvancedChatInterface';
import VisualThinkingMap from '@/pages/VisualThinkingMap';

// Simple router component
const AppRouter: React.FC = () => {
  const [currentPath, setCurrentPath] = React.useState(window.location.pathname);

  React.useEffect(() => {
    const handleNavigation = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleNavigation);
    
    // Override push state
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      handleNavigation();
    };

    return () => {
      window.removeEventListener('popstate', handleNavigation);
      history.pushState = originalPushState;
    };
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  switch (currentPath) {
    case '/advanced-chat':
      return <AdvancedChatInterface />;
    case '/thinking-map':
      return <VisualThinkingMap />;
    default:
      return <WorkflowDemo />;
  }
};

export default AppRouter;