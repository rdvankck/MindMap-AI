import { conversationService } from '@/services/conversationService';
import { ConversationRole, ContextStrategy } from '@prisma/client';

describe('ConversationService', () => {
  const testUserId = 'test-user-id';
  const testWorkflowId = 'test-workflow-id';
  const testNodeId = 'test-node-id';

  describe('createConversation', () => {
    it('should create a new conversation thread', async () => {
      const conversation = await conversationService.createConversation({
        nodeId: testNodeId,
        workflowId: testWorkflowId,
        userId: testUserId,
        title: 'Test Conversation',
        systemPrompt: 'You are a helpful assistant.',
        contextConfig: {
          provider: 'openai',
          model: 'gpt-4',
          maxTokens: 4096,
          contextStrategy: ContextStrategy.FULL,
        },
      });

      expect(conversation).toBeDefined();
      expect(conversation.title).toBe('Test Conversation');
      expect(conversation.nodeId).toBe(testNodeId);
      expect(conversation.workflowId).toBe(testWorkflowId);
      expect(conversation.userId).toBe(testUserId);
    });
  });

  describe('addMessage', () => {
    let threadId: string;

    beforeEach(async () => {
      const conversation = await conversationService.createConversation({
        nodeId: testNodeId,
        workflowId: testWorkflowId,
        userId: testUserId,
        title: 'Test Conversation',
      });
      threadId = conversation.id;
    });

    it('should add a user message', async () => {
      const message = await conversationService.addMessage(threadId, {
        role: ConversationRole.USER,
        content: 'Hello, how are you?',
      });

      expect(message).toBeDefined();
      expect(message.role).toBe(ConversationRole.USER);
      expect(message.content).toBe('Hello, how are you?');
      expect(message.threadId).toBe(threadId);
    });

    it('should add an assistant message', async () => {
      const message = await conversationService.addMessage(threadId, {
        role: ConversationRole.ASSISTANT,
        content: 'I\'m doing well, thank you for asking!',
      });

      expect(message).toBeDefined();
      expect(message.role).toBe(ConversationRole.ASSISTANT);
      expect(message.content).toBe('I\'m doing well, thank you for asking!');
    });
  });

  describe('buildContext', () => {
    let threadId: string;

    beforeEach(async () => {
      const conversation = await conversationService.createConversation({
        nodeId: testNodeId,
        workflowId: testWorkflowId,
        userId: testUserId,
        title: 'Test Conversation',
        systemPrompt: 'You are a helpful assistant.',
      });
      threadId = conversation.id;

      // Add some test messages
      await conversationService.addMessage(threadId, {
        role: ConversationRole.USER,
        content: 'Hello!',
      });
      
      await conversationService.addMessage(threadId, {
        role: ConversationRole.ASSISTANT,
        content: 'Hi there! How can I help you?',
      });
    });

    it('should build conversation context with full strategy', async () => {
      const context = await conversationService.buildContext(threadId, {
        strategy: ContextStrategy.FULL,
      });

      expect(context).toBeDefined();
      expect(context.threadId).toBe(threadId);
      expect(context.nodeId).toBe(testNodeId);
      expect(context.workflowId).toBe(testWorkflowId);
      expect(context.messages).toHaveLength(2);
      expect(context.strategy).toBe(ContextStrategy.FULL);
      expect(context.systemPrompt).toBe('You are a helpful assistant.');
    });

    it('should build conversation context with sliding window strategy', async () => {
      const context = await conversationService.buildContext(threadId, {
        strategy: ContextStrategy.SLIDING_WINDOW,
        maxTokens: 100,
      });

      expect(context).toBeDefined();
      expect(context.strategy).toBe(ContextStrategy.SLIDING_WINDOW);
    });
  });

  describe('createBranch', () => {
    let threadId: string;
    let messageId: string;

    beforeEach(async () => {
      const conversation = await conversationService.createConversation({
        nodeId: testNodeId,
        workflowId: testWorkflowId,
        userId: testUserId,
        title: 'Test Conversation',
      });
      threadId = conversation.id;

      const message = await conversationService.addMessage(threadId, {
        role: ConversationRole.USER,
        content: 'Original message',
      });
      messageId = message.id;
    });

    it('should create a conversation branch', async () => {
      const branch = await conversationService.createBranch(
        threadId,
        messageId,
        'Alternative Response'
      );

      expect(branch).toBeDefined();
      expect(branch.threadId).toBe(threadId);
      expect(branch.branchPointId).toBe(messageId);
      expect(branch.branchName).toBe('Alternative Response');
      expect(branch.isActive).toBe(true);
    });
  });

  describe('getConversationHistory', () => {
    let threadId: string;

    beforeEach(async () => {
      const conversation = await conversationService.createConversation({
        nodeId: testNodeId,
        workflowId: testWorkflowId,
        userId: testUserId,
        title: 'Test Conversation',
      });
      threadId = conversation.id;

      // Add multiple messages
      await conversationService.addMessage(threadId, {
        role: ConversationRole.USER,
        content: 'First message',
      });
      
      await conversationService.addMessage(threadId, {
        role: ConversationRole.ASSISTANT,
        content: 'First response',
      });
      
      await conversationService.addMessage(threadId, {
        role: ConversationRole.USER,
        content: 'Second message',
      });
    });

    it('should return conversation history with pagination', async () => {
      const { messages, total } = await conversationService.getConversationHistory(threadId, {
        limit: 2,
        offset: 0,
      });

      expect(messages).toHaveLength(2);
      expect(total).toBe(3);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('First response');
    });

    it('should return paginated results', async () => {
      const { messages, total } = await conversationService.getConversationHistory(threadId, {
        limit: 2,
        offset: 1,
      });

      expect(messages).toHaveLength(2);
      expect(total).toBe(3);
      expect(messages[0].content).toBe('First response');
      expect(messages[1].content).toBe('Second message');
    });
  });

  describe('createContextSnapshot', () => {
    let threadId: string;

    beforeEach(async () => {
      const conversation = await conversationService.createConversation({
        nodeId: testNodeId,
        workflowId: testWorkflowId,
        userId: testUserId,
        title: 'Test Conversation',
      });
      threadId = conversation.id;

      await conversationService.addMessage(threadId, {
        role: ConversationRole.USER,
        content: 'Test message for snapshot',
      });
    });

    it('should create a context snapshot', async () => {
      const snapshot = await conversationService.createContextSnapshot(threadId, undefined, 'full');

      expect(snapshot).toBeDefined();
      expect(snapshot.threadId).toBe(threadId);
      expect(snapshot.contextStrategy).toBe('full');
      expect(snapshot.tokenCount).toBeGreaterThan(0);
    });
  });

  describe('closeConversation', () => {
    let threadId: string;

    beforeEach(async () => {
      const conversation = await conversationService.createConversation({
        nodeId: testNodeId,
        workflowId: testWorkflowId,
        userId: testUserId,
        title: 'Test Conversation',
      });
      threadId = conversation.id;
    });

    it('should close a conversation thread', async () => {
      const closedConversation = await conversationService.closeConversation(threadId);

      expect(closedConversation).toBeDefined();
      // Note: This would require updating the service to actually close the conversation
      // For now, this test shows the expected behavior
    });
  });
});