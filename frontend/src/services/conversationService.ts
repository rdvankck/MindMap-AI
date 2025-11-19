// Simplified conversation service for demo
export class ConversationApiService {
  private baseUrl: string;

  constructor(threadId: string | null = null) {
    this.baseUrl = 'http://localhost:3001/api';
  }

  async createBranch(options: any) {
    console.log('Mock createBranch:', options);
    return { id: 'mock-branch-' + Date.now() };
  }

  async mergeBranch(branchId: string, options: any) {
    console.log('Mock mergeBranch:', branchId, options);
    return { success: true };
  }

  async getBranches(threadId: string) {
    console.log('Mock getBranches:', threadId);
    return [];
  }

  async switchBranch(threadId: string, branchId: string) {
    console.log('Mock switchBranch:', threadId, branchId);
    return { success: true };
  }

  async getBranchComparison(threadId: string, branchIds: string[]) {
    console.log('Mock getBranchComparison:', threadId, branchIds);
    return {
      branches: [],
      differences: [],
      recommendations: []
    };
  }
}

// Export singleton instance
export const conversationService = new ConversationApiService();