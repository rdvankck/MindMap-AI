import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Bot, 
  GitBranch, 
  Code, 
  Merge,
  Plus,
  Cpu,
  FileText,
  Globe,
  Database,
  Clock,
  Shuffle,
  Package,
  Webhook,
  HardDrive,
  Mail,
  MessageCircle,
  Cloud
} from 'lucide-react';

const nodeCategories = [
  {
    title: 'Core',
    nodes: [
      { type: 'prompt', label: 'Prompt', icon: MessageSquare, color: 'bg-blue-500', description: 'User input or prompt text' },
      { type: 'response', label: 'LLM Response', icon: Bot, color: 'bg-purple-500', description: 'AI-generated response' },
    ],
  },
  {
    title: 'Logic',
    nodes: [
      { type: 'condition', label: 'Condition', icon: Code, color: 'bg-indigo-500', description: 'Conditional logic' },
      { type: 'branch', label: 'Branch', icon: GitBranch, color: 'bg-orange-500', description: 'Split workflow path' },
      { type: 'aggregation', label: 'Aggregation', icon: Merge, color: 'bg-teal-500', description: 'Combine multiple inputs' },
    ],
  },
  {
    title: 'Operations',
    nodes: [
      { type: 'code', label: 'Code Execution', icon: Cpu, color: 'bg-gray-600', description: 'Run custom code' },
      { type: 'transform', label: 'Transform', icon: Shuffle, color: 'bg-green-600', description: 'Transform data' },
      { type: 'merge', label: 'Merge', icon: Package, color: 'bg-pink-600', description: 'Merge data streams' },
      { type: 'split', label: 'Split', icon: GitBranch, color: 'bg-yellow-600', description: 'Split data stream' },
    ],
  },
  {
    title: 'Data',
    nodes: [
      { type: 'file', label: 'File Read/Write', icon: FileText, color: 'bg-cyan-600', description: 'Handle file operations' },
      { type: 'http', label: 'HTTP Request', icon: Globe, color: 'bg-red-600', description: 'Make API calls' },
      { type: 'database', label: 'Database', icon: Database, color: 'bg-blue-700', description: 'Database operations' },
      { type: 'cache', label: 'Cache', icon: HardDrive, color: 'bg-purple-700', description: 'Cache operations' },
    ],
  },
  {
    title: 'External',
    nodes: [
      { type: 'email', label: 'Email', icon: Mail, color: 'bg-green-700', description: 'Send emails' },
      { type: 'slack', label: 'Slack', icon: MessageCircle, color: 'bg-purple-800', description: 'Slack integration' },
      { type: 'webhook', label: 'Webhook', icon: Webhook, color: 'bg-orange-600', description: 'Webhook endpoint' },
      { type: 'storage', label: 'Storage', icon: Cloud, color: 'bg-blue-600', description: 'Cloud storage' },
    ],
  },
  {
    title: 'Flow Control',
    nodes: [
      { type: 'wait', label: 'Wait', icon: Clock, color: 'bg-gray-500', description: 'Delay execution' },
      { type: 'input', label: 'Input', icon: Plus, color: 'bg-cyan-500', description: 'Workflow input' },
      { type: 'output', label: 'Output', icon: Plus, color: 'bg-pink-500', description: 'Workflow output' },
    ],
  },
];

interface NodePaletteProps {
  onDragStart?: (event: React.DragEvent, nodeType: string) => void;
}

const NodePalette: React.FC<NodePaletteProps> = ({ onDragStart }) => {
  const handleDragStart = useCallback(
    (event: React.DragEvent, nodeType: string) => {
      event.dataTransfer.setData('application/reactflow', nodeType);
      event.dataTransfer.effectAllowed = 'move';
      onDragStart?.(event, nodeType);
    },
    [onDragStart]
  );

  return (
    <div className="w-64 h-full bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Node Palette</h2>
        
        <div className="space-y-6">
          {nodeCategories.map((category, categoryIndex) => (
            <motion.div
              key={category.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: categoryIndex * 0.1 }}
            >
              <h3 className="text-sm font-medium text-gray-700 mb-3 capitalize">
                {category.title}
              </h3>
              
              <div className="space-y-2">
                {category.nodes.map((node) => {
                  const Icon = node.icon;
                  
                  return (
                    <motion.div
                      key={node.type}
                      draggable
                      onDragStart={(e) => handleDragStart(e, node.type)}
                      whileHover={{ scale: 1.02 }}
                      whileDrag={{ scale: 1.05, opacity: 0.8 }}
                      className="flex items-center space-x-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-move hover:bg-gray-100 hover:border-gray-300 transition-colors"
                    >
                      <div className={`w-8 h-8 ${node.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {node.label}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {node.description}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
        
        {/* Tips */}
        <div className="mt-8 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800">
              <div className="font-medium mb-1">Tip:</div>
              <div>Drag nodes from here to the canvas to build your workflow.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodePalette;