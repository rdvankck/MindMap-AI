import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  GitCompare, 
  TrendingUp, 
  MessageSquare, 
  Clock, 
  Users,
  CheckCircle,
  AlertTriangle,
  Info,
  Target,
  Zap,
  BarChart3,
  Filter
} from 'lucide-react';
import { BranchComparison, ConversationBranch } from '../shared';
import { cn } from '@/utils';

interface BranchComparisonPanelProps {
  comparison: BranchComparison | null;
  branches: ConversationBranch[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

const comparisonTypes = [
  { value: 'content', label: 'Content', icon: '📝', description: 'Compare message content and topics' },
  { value: 'structure', label: 'Structure', icon: '🏗️', description: 'Compare conversation flow and patterns' },
  { value: 'performance', label: 'Performance', icon: '⚡', description: 'Compare response times and efficiency' },
  { value: 'outcomes', label: 'Outcomes', icon: '🎯', description: 'Compare results and effectiveness' },
  { value: 'comprehensive', label: 'Comprehensive', icon: '🔍', description: 'Full comparison across all dimensions' },
];

const BranchComparisonPanel: React.FC<BranchComparisonPanelProps> = ({
  comparison,
  branches,
  loading,
  error,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'differences' | 'recommendations'>('overview');

  const getBranchById = (id: string) => branches.find(b => b.id === id);

  const renderOverview = () => {
    if (!comparison) return null;

    return (
      <div className="space-y-6">
        {/* Comparison Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900">Comparison Summary</h3>
              <p className="text-sm text-blue-700 mt-1">
                Compared {comparison.branchIds.length} branches using {comparison.comparisonType} analysis
              </p>
            </div>
          </div>
        </div>

        {/* Branch Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {comparison.branchIds.map((branchId, index) => {
            const branch = getBranchById(branchId);
            if (!branch) return null;

            const metrics = comparison.metrics.totalMessages[index];
            const tokens = comparison.metrics.tokenUsage[index];

            return (
              <div key={branchId} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: branch.color || '#6b7280' }}
                  />
                  <h4 className="font-medium text-gray-900">{branch.branchName}</h4>
                  <span className="text-xs text-gray-500">({branch.branchType})</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Messages:</span>
                    <span className="ml-2 font-medium">{metrics}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Tokens:</span>
                    <span className="ml-2 font-medium">{tokens?.toLocaleString() || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Depth:</span>
                    <span className="ml-2 font-medium">{branch.depth}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Type:</span>
                    <span className="ml-2 font-medium capitalize">{branch.branchType}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Total Messages</span>
            </div>
            <p className="text-2xl font-bold text-purple-900">
              {comparison.metrics.totalMessages.reduce((sum, count) => sum + count, 0)}
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">Avg Tokens</span>
            </div>
            <p className="text-2xl font-bold text-green-900">
              {Math.round(comparison.metrics.tokenUsage.reduce((sum, tokens) => sum + tokens, 0) / comparison.metrics.tokenUsage.length)}
            </p>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-900">Differences</span>
            </div>
            <p className="text-2xl font-bold text-orange-900">
              {comparison.differences.length}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Recommendations</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">
              {comparison.recommendations.length}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderMetrics = () => {
    if (!comparison) return null;

    return (
      <div className="space-y-6">
        {/* Message Metrics */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Message Metrics</h3>
          <div className="bg-white border rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-gray-700">Branch</th>
                  <th className="text-right p-3 text-sm font-medium text-gray-700">Messages</th>
                  <th className="text-right p-3 text-sm font-medium text-gray-700">Tokens</th>
                  <th className="text-right p-3 text-sm font-medium text-gray-700">Avg Tokens/Msg</th>
                  <th className="text-right p-3 text-sm font-medium text-gray-700">Depth</th>
                </tr>
              </thead>
              <tbody>
                {comparison.branchIds.map((branchId, index) => {
                  const branch = getBranchById(branchId);
                  if (!branch) return null;

                  const messages = comparison.metrics.totalMessages[index];
                  const tokens = comparison.metrics.tokenUsage[index];
                  const avgTokens = tokens > 0 ? Math.round(tokens / messages) : 0;

                  return (
                    <tr key={branchId} className="border-b">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: branch.color || '#6b7280' }}
                          />
                          <span className="text-sm font-medium">{branch.branchName}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right text-sm">{messages}</td>
                      <td className="p-3 text-right text-sm">{tokens?.toLocaleString() || 'N/A'}</td>
                      <td className="p-3 text-right text-sm">{avgTokens.toLocaleString()}</td>
                      <td className="p-3 text-right text-sm">{branch.depth}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Performance Metrics */}
        {comparison.metrics.responseTime && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {comparison.metrics.responseTime.map((time, index) => {
                const branch = getBranchById(comparison.branchIds[index]);
                if (!branch) return null;

                return (
                  <div key={comparison.branchIds[index]} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-gray-600" />
                      <span className="font-medium text-gray-900">{branch.branchName}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span>Avg Response Time: </span>
                      <span className="font-medium">{Math.round(time)}ms</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDifferences = () => {
    if (!comparison) return null;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Key Differences</h3>
        
        {comparison.differences.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p>No significant differences found between branches</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comparison.differences.map((difference, index) => {
              const branch = getBranchById(difference.branchId);
              const severityColors = {
                low: 'bg-yellow-50 border-yellow-200 text-yellow-800',
                medium: 'bg-orange-50 border-orange-200 text-orange-800',
                high: 'bg-red-50 border-red-200 text-red-800',
              };

              return (
                <div
                  key={index}
                  className={cn("border rounded-lg p-4", severityColors[difference.severity])}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium capitalize">{difference.type} Difference</span>
                        {branch && (
                          <span className="text-sm opacity-75">in {branch.branchName}</span>
                        )}
                      </div>
                      <p className="text-sm">{difference.description}</p>
                      {difference.details && (
                        <div className="mt-2 p-2 bg-white bg-opacity-50 rounded text-xs">
                          <pre>{JSON.stringify(difference.details, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Similarities */}
        {comparison.similarities.length > 0 && (
          <div className="mt-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">Similarities</h4>
            <div className="space-y-2">
              {comparison.similarities.map((similarity, index) => (
                <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-900 capitalize">
                      {similarity.type} Similarity
                    </span>
                    <span className="text-sm text-green-700">
                      ({Math.round(similarity.confidence * 100)}% confidence)
                    </span>
                  </div>
                  <p className="text-sm text-green-800 mt-1">{similarity.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRecommendations = () => {
    if (!comparison) return null;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Recommendations</h3>
        
        {comparison.recommendations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Info className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p>No specific recommendations at this time</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comparison.recommendations.map((recommendation, index) => {
              const branch = getBranchById(recommendation.targetBranchId);
              const typeIcons = {
                merge: <GitCompare className="w-4 h-4" />,
                continue: <Zap className="w-4 h-4" />,
                switch: <Target className="w-4 h-4" />,
                explore: <Filter className="w-4 h-4" />,
              };

              return (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      {typeIcons[recommendation.type as keyof typeof typeIcons]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium capitalize">{recommendation.type} Recommendation</span>
                        <span className="text-xs text-gray-500">
                          (Confidence: {Math.round(recommendation.confidence * 100)}%)
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{recommendation.description}</p>
                      {branch && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>Target:</span>
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: branch.color || '#6b7280' }}
                          />
                          <span>{branch.branchName}</span>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-2 italic">
                        Reasoning: {recommendation.reasoning}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <GitCompare className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Branch Comparison</h2>
                <p className="text-sm text-gray-500">
                  {comparison ? `Analyzed ${comparison.branchIds.length} branches` : 'Loading comparison...'}
                </p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Content */}
          <div className="flex" style={{ height: '70vh' }}>
            {/* Sidebar */}
            <div className="w-64 border-r border-gray-200 bg-gray-50 p-4">
              <h3 className="font-medium text-gray-900 mb-4">Comparison Type</h3>
              <div className="space-y-2">
                {comparisonTypes.map((type) => {
                  const Icon = () => <span className="text-xl">{type.icon}</span>;
                  return (
                    <button
                      key={type.value}
                      onClick={() => setActiveTab(type.value as any)}
                      className={cn(
                        "w-full p-3 border rounded-lg text-left transition-all",
                        activeTab === type.value
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon />
                        <div>
                          <div className="font-medium text-gray-900">{type.label}</div>
                          <div className="text-xs text-gray-500">{type.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Comparing branches...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md">
                    <div className="text-red-600 mb-4">
                      <AlertTriangle className="w-12 h-12 mx-auto" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Comparison Error</h3>
                    <p className="text-gray-600">{error}</p>
                  </div>
                </div>
              ) : comparison ? (
                <>
                  {activeTab === 'overview' && renderOverview()}
                  {activeTab === 'metrics' && renderMetrics()}
                  {activeTab === 'differences' && renderDifferences()}
                  {activeTab === 'recommendations' && renderRecommendations()}
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <GitCompare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No comparison available</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BranchComparisonPanel;