import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  GitBranch, 
  Plus, 
  Play, 
  Settings, 
  BarChart3,
  Users,
  Activity,
  Zap,
  Target,
  Eye,
  Download,
  Share2
} from 'lucide-react';
import BranchManager from './BranchManager';
import { useConversationStore } from '@/store/conversationStore';
import { useConversationApi } from '@/services';
import { cn } from '@/utils';

const ConversationDemo: React.FC = () => {
  const [threadId, setThreadId] = useState<string | null>('demo-thread-1');
  const [nodeId] = useState('demo-node-1');
  const [isCreating, setIsCreating] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const conversationApi = useConversationApi(threadId);
  const {
    branches,
    branchTree,
    activeBranchId,
    selectedBranchIds,
    comparisonBranchIds,
    showBranchPanel,
    showVisualization,
    showComparison,
    loadingBranches,
    isCreatingBranch,
    isMergingBranches,
    setActiveThread,
    setActiveBranch,
    toggleBranchPanel,
    toggleVisualization,
    toggleComparison,
  } = useConversationStore();

  useEffect(() => {
    if (threadId) {
      setActiveThread(threadId);
      // Load demo data
      loadDemoData();
    }
  }, [threadId, setActiveThread]);

  const loadDemoData = async () => {
    // Simulate loading demo branches
    const demoBranches = [
      {
        id: 'branch-1',
        threadId: threadId!,
        branchPointId: 'message-1',
        branchName: 'Main Conversation',
        branchType: 'alternative' as const,
        description: 'Primary conversation path',
        color: '#3b82f6',
        isActive: true,
        isMainBranch: true,
        depth: 0,
        createdAt: new Date(Date.now() - 3600000),
        updatedAt: new Date(),
        metadata: {
          messageCount: 15,
          lastActivity: new Date(),
        },
        childBranchIds: ['branch-2', 'branch-3'],
      },
      {
        id: 'branch-2',
        threadId: threadId!,
        branchPointId: 'message-5',
        branchName: 'Technical Deep Dive',
        branchType: 'exploration' as const,
        description: 'Exploring technical implementation details',
        color: '#10b981',
        isActive: true,
        isMainBranch: false,
        depth: 1,
        parentBranchId: 'branch-1',
        createdAt: new Date(Date.now() - 1800000),
        updatedAt: new Date(),
        metadata: {
          messageCount: 8,
          lastActivity: new Date(),
        },
      },
      {
        id: 'branch-3',
        threadId: threadId!,
        branchPointId: 'message-8',
        branchName: 'Alternative Approach',
        branchType: 'question' as const,
        description: 'Questioning the current approach',
        color: '#f97316',
        isActive: false,
        isMainBranch: false,
        depth: 1,
        parentBranchId: 'branch-1',
        createdAt: new Date(Date.now() - 900000),
        updatedAt: new Date(),
        metadata: {
          messageCount: 5,
          lastActivity: new Date(Date.now() - 300000),
        },
      },
      {
        id: 'branch-4',
        threadId: threadId!,
        branchPointId: 'message-12',
        branchName: 'Correction Branch',
        branchType: 'correction' as const,
        description: 'Correcting previous assumptions',
        color: '#ef4444',
        isActive: false,
        isMainBranch: false,
        depth: 2,
        parentBranchId: 'branch-2',
        createdAt: new Date(Date.now() - 600000),
        updatedAt: new Date(),
        metadata: {
          messageCount: 3,
          lastActivity: new Date(Date.now() - 240000),
        },
      },
    ];

    // This would normally come from the API
    // For demo purposes, we'll simulate the data
    console.log('Demo branches loaded:', demoBranches);
  };

  const handleCreateConversation = async () => {
    setIsCreating(true);
    try {
      const newConversation = await useConversationApi.createConversation(
        nodeId,
        'demo-workflow-1',
        {
          title: `Demo Conversation ${Date.now()}`,
          systemPrompt: 'You are a helpful AI assistant.',
        }
      );
      setThreadId(newConversation.id);
      setActiveThread(newConversation.id);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const stats = {
    totalBranches: branches.length,
    activeBranches: branches.filter(b => b.isActive).length,
    maxDepth: branchTree?.maxDepth || 0,
    totalMessages: branches.reduce((sum, b) => sum + (b.metadata?.messageCount || 0), 0),
    selectedForComparison: comparisonBranchIds.length,
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">Conversation Branching Demo</h1>
              </div>
              
              {threadId && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  <Activity className="w-4 h-4" />
                  <span>Thread: {threadId}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Stats Toggle */}
              <button
                onClick={() => setShowStats(!showStats)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                  showStats
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                <BarChart3 className="w-4 h-4" />
                Stats
              </button>

              {/* Quick Actions */}
              <button
                onClick={() => toggleVisualization()}
                className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
              >
                <Eye className="w-4 h-4" />
                Visualization
              </button>

              <button
                onClick={() => toggleComparison()}
                disabled={comparisonBranchIds.length < 2}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                  comparisonBranchIds.length >= 2
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                )}
              >
                <GitCompare className="w-4 h-4" />
                Compare
              </button>

              {!threadId ? (
                <button
                  onClick={handleCreateConversation}
                  disabled={isCreating}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg transition-colors",
                    isCreating ? "opacity-75 cursor-wait" : "hover:bg-blue-700"
                  )}
                >
                  {isCreating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      New Conversation
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => {
                    setThreadId(null);
                    setActiveThread(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  New Thread
                </button>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <AnimatePresence>
            {showStats && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-4 grid grid-cols-5 gap-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <GitBranch className="w-4 h-4" />
                      <span>Total Branches</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{stats.totalBranches}</div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Zap className="w-4 h-4" />
                      <span>Active Branches</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600">{stats.activeBranches}</div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Target className="w-4 h-4" />
                      <span>Max Depth</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">{stats.maxDepth}</div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <MessageSquare className="w-4 h-4" />
                      <span>Total Messages</span>
                    </div>
                    <div className="text-2xl font-bold text-purple-600">{stats.totalMessages}</div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <GitCompare className="w-4 h-4" />
                      <span>For Comparison</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-600">{stats.selectedForComparison}</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex">
          {threadId ? (
            <>
              {/* Demo Conversation Area */}
              <div className="flex-1 p-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">Conversation Interface</h2>
                    <div className="flex items-center gap-2">
                      {activeBranchId && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                          <GitBranch className="w-4 h-4" />
                          <span>Active: {branches.find(b => b.id === activeBranchId)?.branchName || 'Unknown'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Demo Messages */}
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        U
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-lg p-4">
                        <p className="text-gray-900">
                          Welcome to the conversation branching demo! This is a demonstration of how parallel conversations can be managed within a single thread.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        AI
                      </div>
                      <div className="flex-1 bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <p className="text-gray-900">
                          Hello! I'm excited to show you the conversation branching functionality. You can create multiple conversation paths to explore different topics, ask questions, or try alternative approaches.
                        </p>
                      </div>
                    </div>

                    {branches.length > 0 && (
                      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <GitBranch className="w-5 h-5 text-blue-600" />
                          <h3 className="font-medium text-blue-900">Branching Active</h3>
                        </div>
                        <p className="text-sm text-blue-700">
                          This conversation has {branches.length} branch{branches.length > 1 ? 'es' : ''}. Use the branch panel on the right to explore different conversation paths.
                        </p>
                      </div>
                    )}

                    {/* Interactive Elements */}
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button
                        onClick={() => {
                          // Simulate adding a message that could create a branch
                          console.log('Add message that could create a branch');
                        }}
                        className="p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors text-left"
                      >
                        <MessageSquare className="w-6 h-6 text-gray-600 mb-2" />
                        <h4 className="font-medium text-gray-900">Add Message</h4>
                        <p className="text-sm text-gray-500 mt-1">Continue the conversation</p>
                      </button>

                      <button
                        onClick={() => {
                          // Simulate asking a follow-up question
                          console.log('Ask follow-up question');
                        }}
                        className="p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors text-left"
                      >
                        <Target className="w-6 h-6 text-gray-600 mb-2" />
                        <h4 className="font-medium text-gray-900">Ask Question</h4>
                        <p className="text-sm text-gray-500 mt-1">Create a question branch</p>
                      </button>

                      <button
                        onClick={() => {
                          // Simulate exploring alternatives
                          console.log('Explore alternatives');
                        }}
                        className="p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors text-left"
                      >
                        <GitBranch className="w-6 h-6 text-gray-600 mb-2" />
                        <h4 className="font-medium text-gray-900">Explore Path</h4>
                        <p className="text-sm text-gray-500 mt-1">Try a different approach</p>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Branch Manager Panel */}
              {showBranchPanel && (
                <BranchManager
                  threadId={threadId}
                  nodeId={nodeId}
                  className="w-80"
                />
              )}
            </>
          ) : (
            /* Welcome Screen */
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-2xl">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <GitBranch className="w-8 h-8 text-blue-600" />
                </div>
                
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Conversation Branching System
                </h2>
                
                <p className="text-lg text-gray-600 mb-8">
                  Explore parallel conversations with our advanced branching functionality. 
                  Create multiple conversation paths, compare different approaches, and merge insights.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="p-6 bg-white rounded-lg border border-gray-200">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <GitBranch className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Create Branches</h3>
                    <p className="text-sm text-gray-600">
                      Branch conversations at any point to explore different topics or approaches
                    </p>
                  </div>

                  <div className="p-6 bg-white rounded-lg border border-gray-200">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <GitCompare className="w-6 h-6 text-purple-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Compare Paths</h3>
                    <p className="text-sm text-gray-600">
                      Analyze and compare different conversation branches to find the best insights
                    </p>
                  </div>

                  <div className="p-6 bg-white rounded-lg border border-gray-200">
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <Eye className="w-6 h-6 text-orange-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Visualize</h3>
                    <p className="text-sm text-gray-600">
                      See your conversation branches as an interactive knowledge map
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleCreateConversation}
                  disabled={isCreating}
                  className={cn(
                    "inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg transition-colors text-lg font-medium",
                    isCreating ? "opacity-75 cursor-wait" : "hover:bg-blue-700"
                  )}
                >
                  {isCreating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating Demo...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Start Demo
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationDemo;