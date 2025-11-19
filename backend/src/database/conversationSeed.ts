import { PrismaClient, ConversationRole, ContextStrategy, ConversationStatus } from '@prisma/client';
import { logger } from '@/utils/logger';

export async function seedConversationData(prisma: PrismaClient): Promise<void> {
  try {
    logger.info('Seeding conversation data...');

    // Create sample LLM context configurations
    const contextConfigs = [
      {
        name: 'GPT-4 Standard',
        provider: 'openai',
        model: 'gpt-4',
        maxTokens: 4096,
        contextWindow: 8192,
        systemPrompt: 'You are a helpful AI assistant.',
        contextStrategy: ContextStrategy.FULL,
        tokenCountingMethod: 'tiktoken',
        isActive: true,
      },
      {
        name: 'Claude Sonnet',
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        maxTokens: 4096,
        contextWindow: 200000,
        systemPrompt: 'You are Claude, an AI assistant.',
        contextStrategy: ContextStrategy.SLIDING_WINDOW,
        tokenCountingMethod: 'provider',
        isActive: true,
      },
      {
        name: 'Ollama Llama 2',
        provider: 'ollama',
        model: 'llama2',
        maxTokens: 2048,
        contextWindow: 4096,
        systemPrompt: 'You are a helpful assistant running locally.',
        contextStrategy: ContextStrategy.SUMMARIZATION,
        tokenCountingMethod: 'custom',
        summarizationConfig: {
          model: 'llama2',
          maxSummaryTokens: 500,
        },
        isActive: true,
      },
    ];

    for (const config of contextConfigs) {
      await prisma.lLMContextConfig.upsert({
        where: { name: config.name },
        update: config,
        create: config,
      });
    }

    logger.info('Created LLM context configurations');

    // Get or create a sample user and workflow for conversations
    const sampleUser = await prisma.user.findFirst();
    if (!sampleUser) {
      logger.warn('No users found. Skipping conversation seeding.');
      return;
    }

    const sampleWorkflow = await prisma.workflow.findFirst({
      where: { userId: sampleUser.id },
    });

    if (!sampleWorkflow) {
      logger.warn('No workflows found. Skipping conversation seeding.');
      return;
    }

    // Create sample conversation threads
    const sampleConversations = [
      {
        nodeId: 'node-1',
        workflowId: sampleWorkflow.id,
        userId: sampleUser.id,
        title: 'AI Assistant Conversation',
        status: ConversationStatus.ACTIVE,
        context: {
          systemPrompt: 'You are a helpful AI assistant specialized in creative writing.',
          settings: {
            model: 'gpt-4',
            temperature: 0.7,
            maxTokens: 4096,
          },
        },
        settings: {
          maxTokens: 4096,
          contextStrategy: ContextStrategy.FULL,
        },
      },
      {
        nodeId: 'node-2',
        workflowId: sampleWorkflow.id,
        userId: sampleUser.id,
        title: 'Code Review Discussion',
        status: ConversationStatus.ACTIVE,
        context: {
          systemPrompt: 'You are an expert code reviewer. Provide constructive feedback on code quality, best practices, and potential improvements.',
          settings: {
            model: 'claude-3-sonnet-20240229',
            temperature: 0.3,
            maxTokens: 4096,
          },
        },
        settings: {
          maxTokens: 8192,
          contextStrategy: ContextStrategy.SLIDING_WINDOW,
        },
      },
      {
        nodeId: 'node-3',
        workflowId: sampleWorkflow.id,
        userId: sampleUser.id,
        title: 'Data Analysis Chat',
        status: ConversationStatus.PAUSED,
        context: {
          systemPrompt: 'You are a data analyst helping users understand their data and generate insights.',
          settings: {
            model: 'gpt-4',
            temperature: 0.1,
            maxTokens: 2048,
          },
        },
        settings: {
          maxTokens: 4096,
          contextStrategy: ContextStrategy.SUMMARIZATION,
        },
      },
    ];

    const createdConversations = [];
    for (const conv of sampleConversations) {
      const conversation = await prisma.conversationThread.upsert({
        where: {
          nodeId_userId: {
            nodeId: conv.nodeId,
            userId: conv.userId,
          },
        },
        update: conv,
        create: conv,
      });
      createdConversations.push(conversation);
    }

    logger.info(`Created ${createdConversations.length} conversation threads`);

    // Add sample messages to conversations
    const sampleMessages = [
      {
        threadId: createdConversations[0].id,
        nodeId: createdConversations[0].nodeId,
        role: ConversationRole.USER,
        content: 'Hi! Can you help me write a short story about a time-traveling detective?',
        metadata: { type: 'creative_request' },
      },
      {
        threadId: createdConversations[0].id,
        nodeId: createdConversations[0].nodeId,
        role: ConversationRole.ASSISTANT,
        content: 'I\'d love to help you write a time-traveling detective story! Let me start with an intriguing opening:\n\n Detective Sarah Mitchell adjusted her vintage trench coat as she stepped out of the temporal displacement chamber into the rain-slicked streets of 1947 New York. The year 2047 had its comforts, but nothing beat the atmosphere of classic noir when investigating temporal anomalies. Her quantum scanner beeped - there was a disturbance three blocks away, near the old jazz club...',
        metadata: { type: 'creative_response', wordCount: 67 },
      },
      {
        threadId: createdConversations[0].id,
        nodeId: createdConversations[0].nodeId,
        role: ConversationRole.USER,
        content: 'That\'s great! Can you make the detective more mysterious and add a clue about what she\'s investigating?',
        metadata: { type: 'creative_feedback' },
      },
    ];

    for (const msg of sampleMessages) {
      const tokenCount = Math.ceil(msg.content.length / 4); // Simple token calculation
      await prisma.conversationMessage.create({
        data: {
          ...msg,
          tokenCount,
          timestamp: new Date(Date.now() - Math.random() * 86400000), // Random time in last 24h
        },
      });
    }

    // Add messages to the code review conversation
    const codeReviewMessages = [
      {
        threadId: createdConversations[1].id,
        nodeId: createdConversations[1].nodeId,
        role: ConversationRole.USER,
        content: 'Can you review this Python function for performance issues?\n\n```python\ndef find_duplicates(items):\n    duplicates = []\n    for i in range(len(items)):\n        for j in range(i + 1, len(items)):\n            if items[i] == items[j] and items[i] not in duplicates:\n                duplicates.append(items[i])\n    return duplicates\n```',
        metadata: { language: 'python', function_type: 'duplicate_detection' },
      },
      {
        threadId: createdConversations[1].id,
        nodeId: createdConversations[1].nodeId,
        role: ConversationRole.ASSISTANT,
        content: 'I found several performance and code quality issues in your function:\n\n**Performance Issues:**\n1. **O(n²) time complexity** - The nested loops make this inefficient for large lists\n2. **Repeated `in` checks** - Searching `duplicates` list is O(k) where k is the number of duplicates found\n\n**Suggested improvements:**\n```python\ndef find_duplicates(items):\n    seen = set()\n    duplicates = set()\n    for item in items:\n        if item in seen:\n            duplicates.add(item)\n        seen.add(item)\n    return list(duplicates)\n```\n\nThis reduces time complexity to O(n) and uses hash sets for O(1) lookups.',
        metadata: { 
          review_type: 'performance_analysis', 
          original_complexity: 'O(n²)',
          improved_complexity: 'O(n)',
          suggestions_count: 2
        },
      },
    ];

    for (const msg of codeReviewMessages) {
      const tokenCount = Math.ceil(msg.content.length / 4);
      await prisma.conversationMessage.create({
        data: {
          ...msg,
          tokenCount,
          timestamp: new Date(Date.now() - Math.random() * 86400000),
        },
      });
    }

    // Create conversation branches for demonstration
    const firstMessage = await prisma.conversationMessage.findFirst({
      where: { threadId: createdConversations[0].id },
      orderBy: { timestamp: 'asc' },
    });

    if (firstMessage) {
      await prisma.conversationBranch.create({
        data: {
          threadId: createdConversations[0].id,
          branchPointId: firstMessage.id,
          branchName: 'Alternative Story Path',
          isActive: true,
          metadata: {
            description: 'A different direction for the detective story',
            createdFor: 'demo_purposes',
          },
        },
      });
    }

    // Initialize conversation statistics
    for (const conversation of createdConversations) {
      const messageCount = await prisma.conversationMessage.count({
        where: { threadId: conversation.id, isDeleted: false },
      });

      const totalTokens = await prisma.conversationMessage.aggregate({
        where: { threadId: conversation.id, isDeleted: false },
        _sum: { tokenCount: true },
      });

      await prisma.conversationStats.upsert({
        where: { threadId: conversation.id },
        update: {
          totalMessages: messageCount,
          totalTokens: totalTokens._sum.tokenCount || 0,
          lastActivityAt: new Date(),
        },
        create: {
          threadId: conversation.id,
          totalMessages: messageCount,
          totalTokens: totalTokens._sum.tokenCount || 0,
          lastActivityAt: new Date(),
        },
      });
    }

    // Create context snapshots
    for (const conversation of createdConversations.slice(0, 2)) { // Create snapshots for first 2 conversations
      const context = await prisma.conversationMessage.findMany({
        where: { threadId: conversation.id, isDeleted: false },
        orderBy: { timestamp: 'asc' },
      });

      if (context.length > 0) {
        const totalTokens = context.reduce((sum, msg) => sum + msg.tokenCount, 0);
        
        await prisma.contextSnapshot.create({
          data: {
            threadId: conversation.id,
            context: {
              messages: context,
              totalTokens,
              threadId: conversation.id,
              nodeId: conversation.nodeId,
              workflowId: conversation.workflowId,
            } as any,
            tokenCount: totalTokens,
            contextStrategy: 'full',
            expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
          },
        });
      }
    }

    logger.info('Conversation data seeding completed successfully');
    logger.info(`Created: ${contextConfigs.length} context configs, ${createdConversations.length} conversations, multiple messages and branches`);

  } catch (error) {
    logger.error('Error seeding conversation data:', error);
    throw error;
  }
}