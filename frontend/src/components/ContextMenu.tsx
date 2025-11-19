import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { 
  Copy, 
  Trash2, 
  Edit, 
  Download, 
  Play, 
  Pause, 
  Square,
  Settings,
  ChevronRight
} from 'lucide-react';
import { useFlowStore } from '../store';
import { Node, Edge } from 'reactflow';
import { cn } from '../utils';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  target?: {
    type: 'node' | 'edge' | 'canvas' | 'selection';
    items?: (Node | Edge)[];
  };
}

interface MenuItem {
  label: string;
  icon: React.ComponentType<any>;
  action: () => void;
  disabled?: boolean;
  separator?: boolean;
  submenu?: MenuItem[];
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, target }) => {
  const {
    selectedNodes,
    selectedEdges,
    copySelection,
    pasteSelection,
    deleteSelection,
    duplicateNode,
    setNodeStatus,
    clearExecutionResults,
    clearSelection,
    isExecuting,
  } = useFlowStore();

  const [showSubmenu, setShowSubmenu] = useState<string | null>(null);

  // Close on click outside
  useEffect(() => {
    const handleClick = () => onClose();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAction = useCallback((action: () => void) => {
    action();
    onClose();
  }, [onClose]);

  // Build menu items based on target
  const menuItems: MenuItem[] = React.useMemo(() => {
    const items: MenuItem[] = [];

    if (target?.type === 'canvas') {
      items.push(
        {
          label: 'Paste',
          icon: Copy,
          action: () => pasteSelection({ x, y }),
          disabled: false, // Check if clipboard has content
        },
        {
          label: 'Clear Selection',
          icon: ChevronRight,
          action: clearSelection,
          disabled: selectedNodes.length === 0 && selectedEdges.length === 0,
        },
        { separator: true },
        {
          label: 'Clear Execution Results',
          icon: Square,
          action: clearExecutionResults,
        }
      );
    } else if (target?.type === 'node' && target.items) {
      const node = target.items[0] as Node;
      
      items.push(
        {
          label: 'Edit',
          icon: Edit,
          action: () => {
            // Trigger node edit mode
            console.log('Edit node:', node.id);
          },
        },
        {
          label: 'Duplicate',
          icon: Copy,
          action: () => {
            duplicateNode(node.id, { x, y });
          },
        },
        {
          label: 'Copy',
          icon: Copy,
          action: copySelection,
        },
        { separator: true },
        {
          label: 'Execute',
          icon: Play,
          action: () => {
            setNodeStatus(node.id, 'running');
            // Simulate execution
            setTimeout(() => {
              setNodeStatus(node.id, 'completed', { output: 'Sample output' });
            }, 2000);
          },
          disabled: isExecuting,
        },
        {
          label: 'Stop',
          icon: Square,
          action: () => {
            setNodeStatus(node.id, 'idle');
          },
          disabled: !isExecuting,
        },
        { separator: true },
        {
          label: 'Delete',
          icon: Trash2,
          action: () => deleteSelection(),
        }
      );
    } else if (target?.type === 'edge' && target.items) {
      items.push(
        {
          label: 'Delete Edge',
          icon: Trash2,
          action: () => deleteSelection(),
        }
      );
    } else if (target?.type === 'selection') {
      const hasNodes = selectedNodes.length > 0;
      const hasEdges = selectedEdges.length > 0;
      
      items.push(
        {
          label: 'Copy Selection',
          icon: Copy,
          action: copySelection,
        },
        {
          label: 'Duplicate',
          icon: Copy,
          action: () => {
            selectedNodes.forEach(nodeId => {
              duplicateNode(nodeId, { x: x + 20, y: y + 20 });
            });
          },
          disabled: !hasNodes,
        },
        { separator: true },
        {
          label: 'Execute Selection',
          icon: Play,
          action: () => {
            selectedNodes.forEach(nodeId => {
              setNodeStatus(nodeId, 'running');
              setTimeout(() => {
                setNodeStatus(nodeId, 'completed', { output: 'Sample output' });
              }, 2000);
            });
          },
          disabled: !hasNodes || isExecuting,
        },
        {
          label: 'Stop Selection',
          icon: Square,
          action: () => {
            selectedNodes.forEach(nodeId => {
              setNodeStatus(nodeId, 'idle');
            });
          },
          disabled: !hasNodes || !isExecuting,
        },
        { separator: true },
        {
          label: 'Delete Selection',
          icon: Trash2,
          action: deleteSelection,
        }
      );
    }

    return items;
  }, [
    target,
    x,
    y,
    selectedNodes,
    selectedEdges,
    isExecuting,
    copySelection,
    pasteSelection,
    deleteSelection,
    duplicateNode,
    setNodeStatus,
    clearExecutionResults,
    clearSelection,
  ]);

  // Adjust position to keep menu in viewport
  const adjustedPosition = React.useMemo(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let adjustedX = x;
    let adjustedY = y;
    
    // Estimate menu dimensions
    const menuWidth = 200;
    const menuHeight = menuItems.length * 36 + 16; // 36px per item + padding
    
    // Adjust horizontally
    if (x + menuWidth > viewportWidth) {
      adjustedX = viewportWidth - menuWidth - 10;
    }
    
    // Adjust vertically
    if (y + menuHeight > viewportHeight) {
      adjustedY = viewportHeight - menuHeight - 10;
    }
    
    return { x: adjustedX, y: adjustedY };
  }, [x, y, menuItems.length]);

  if (menuItems.length === 0) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.15 }}
        className="fixed z-50"
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
        }}
      >
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[200px]">
          {menuItems.map((item, index) => {
            if (item.separator) {
              return (
                <div key={`separator-${index}`} className="h-px bg-gray-200 my-1" />
              );
            }

            const Icon = item.icon;
            
            return (
              <div key={index} className="relative">
                <button
                  onClick={() => handleAction(item.action)}
                  disabled={item.disabled}
                  onMouseEnter={() => setShowSubmenu(item.submenu ? item.label : null)}
                  onMouseLeave={() => setShowSubmenu(null)}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm flex items-center space-x-2 transition-colors',
                    item.disabled
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-100 cursor-pointer'
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.submenu && (
                    <ChevronRight className="w-3 h-3 text-gray-400" />
                  )}
                </button>
                
                {/* Submenu */}
                <AnimatePresence>
                  {showSubmenu === item.label && item.submenu && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-full top-0 ml-1"
                    >
                      <div className="bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[200px]">
                        {item.submenu.map((subItem, subIndex) => {
                          if (subItem.separator) {
                            return (
                              <div key={`sub-separator-${subIndex}`} className="h-px bg-gray-200 my-1" />
                            );
                          }

                          const SubIcon = subItem.icon;
                          
                          return (
                            <button
                              key={subIndex}
                              onClick={() => handleAction(subItem.action)}
                              disabled={subItem.disabled}
                              className={cn(
                                'w-full px-3 py-2 text-left text-sm flex items-center space-x-2 transition-colors',
                                subItem.disabled
                                  ? 'text-gray-400 cursor-not-allowed'
                                  : 'text-gray-700 hover:bg-gray-100 cursor-pointer'
                              )}
                            >
                              <SubIcon className="w-4 h-4 flex-shrink-0" />
                              <span>{subItem.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default ContextMenu;