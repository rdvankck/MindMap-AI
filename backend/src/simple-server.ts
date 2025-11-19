import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const prisma = new PrismaClient();

// AI Configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3002'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0',
  });
});

// Basic API routes
app.get('/api', (req, res) => {
  res.json({ message: 'LLM Interface API is running' });
});

// Workflow routes
app.post('/api/workflows', async (req, res) => {
  try {
    const { name, description, nodes, edges } = req.body;
    
    // Create a mock workflow for now
    const workflow = {
      id: 'demo-' + Date.now(),
      name: name || 'Demo Workflow',
      description: description || 'Demo workflow description',
      nodes: nodes || [],
      edges: edges || [],
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log('Created workflow:', workflow);
    res.json(workflow);
  } catch (error) {
    console.error('Error creating workflow:', error);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// Chat routes
app.post('/api/chat', async (req, res) => {
  try {
    const { message, model, conversationId, branchId, context } = req.body;
    
    console.log('Received request with context:', context ? 'YES' : 'NO');
    console.log('Full request body:', { message, hasContext: !!context, contextLength: context?.length || 0 });
    
    try {
      if (!GROQ_API_KEY) {
        throw new Error('Groq API key not found in environment variables');
      }

      // Build messages array for Groq API
      const messages = [];
      
      // Add system prompt for better context understanding
      messages.push({
        role: 'system',
        content: `Sen görsel düşünce haritası için özel bir asistansin. Kullanıcı önceki sorularla ilgili bağlamı koruyarak cevap vermelisin. 
        
        Eğer "İlgili Önceki Sorular" bölümü varsa, bunlar aynı konu hakkında sorulmuş önceki sorulardir ve konunun bütünlüğünü anlamana yardımcı olur.
        
        "Devam Edilen Konu" bölümü ise mevcut konuşma akışını gösterir. 
        
        Lütfen cevaplarında bu bağlamı dikkate al ve tutarlı bir şekilde yanıt ver. Konu değiştirdiğini düşünüyorsan belirt ama mümkünse konu bütünlüğünü koru.`
      });
      
      // Process enhanced context
      if (context && context.trim()) {
        const contextLines = context.split('\n').filter(line => line.trim());
        let isInRelatedSection = false;
        let isInMainSection = false;
        
        for (const line of contextLines) {
          if (line.includes('--- İlgili Önceki Sorular ---')) {
            isInRelatedSection = true;
            isInMainSection = false;
            continue;
          } else if (line.includes('--- Devam Edilen Konu ---')) {
            isInRelatedSection = false;
            isInMainSection = true;
            continue;
          }
          
          if (line.startsWith('Kullanıcı:')) {
            const userMessage = line.replace('Kullanıcı: ', '');
            if (isInRelatedSection) {
              messages.push({ 
                role: 'user', 
                content: `[Önceki Soru] ${userMessage}` 
              });
            } else {
              messages.push({ role: 'user', content: userMessage });
            }
          } else if (line.startsWith('Asistan:')) {
            const assistantMessage = line.replace('Asistan: ', '');
            if (isInRelatedSection) {
              messages.push({ 
                role: 'assistant', 
                content: `[Önceki Cevap] ${assistantMessage}` 
              });
            } else {
              messages.push({ role: 'assistant', content: assistantMessage });
            }
          } else if (line.startsWith('Soru:')) {
            messages.push({ 
              role: 'user', 
              content: `[İlgili Soru] ${line.replace('Soru: ', '')}` 
            });
          } else if (line.startsWith('Cevap:')) {
            messages.push({ 
              role: 'assistant', 
              content: `[İlgili Cevap] ${line.replace('Cevap: ', '')}` 
            });
          }
        }
      }
      
      // Add current message
      messages.push({ role: 'user', content: message });
      
      console.log('Sending to Groq:', { messageCount: messages.length, contextLength: context?.length || 0 });
      
      // Call Groq API
      const groqResponse = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant', // Free model
          messages: messages,
          max_tokens: 1000,
          temperature: 0.7,
          stream: false
        })
      });

      if (groqResponse.ok) {
        const data = await groqResponse.json();
        const aiResponse = data.choices[0]?.message?.content || 'Sorry, I could not process your request.';
        
        const response = {
          response: aiResponse,
          model: 'llama-3.1-8b-instant',
          timestamp: new Date().toISOString(),
          conversationId: conversationId || 'conv-' + Date.now(),
          branchId: branchId || 'main'
        };
        
        console.log('Groq chat message:', message, 'Response:', response.response?.slice(0, 100));
        res.json(response);
      } else {
        const errorData = await groqResponse.text();
        console.error('Groq API error:', groqResponse.status, errorData);
        
        // Fallback response
        const response = {
          response: `I'm sorry, but I'm having trouble connecting to the AI service. Please check your API key and try again.`,
          model: 'llama-3.1-8b-instant',
          timestamp: new Date().toISOString(),
          conversationId: conversationId || 'conv-' + Date.now(),
          branchId: branchId || 'main',
          error: 'groq_connection_failed'
        };
        
        res.json(response);
      }
    } catch (error) {
      console.error('Groq API error:', error);
      
      // Fallback response
      const response = {
        response: `I apologize, but I'm having trouble connecting to the AI service. Your question "${message}" was received, but I cannot process it right now. Please try again later.`,
        model: 'llama-3.1-8b-instant',
        timestamp: new Date().toISOString(),
        conversationId: conversationId || 'conv-' + Date.now(),
        branchId: branchId || 'main',
        error: 'connection_failed'
      };
      
      res.json(response);
    }
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// Conversation routes
app.post('/api/conversations', async (req, res) => {
  try {
    const { title, userId } = req.body;
    const conversation = {
      id: 'conv-' + Date.now(),
      title: title || 'New Conversation',
      userId: userId || 'user-1',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      branches: []
    };
    console.log('Created conversation:', conversation);
    res.json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Branch routes
app.post('/api/conversations/:conversationId/branches', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { name, parentId, data } = req.body;
    const branch = {
      id: 'branch-' + Date.now(),
      conversationId,
      name: name || 'New Branch',
      parentId: parentId || null,
      data: data || {},
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    console.log('Created branch:', branch);
    res.json(branch);
  } catch (error) {
    console.error('Error creating branch:', error);
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// Get conversation with branches
app.get('/api/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    // Mock data for demo
    const conversation = {
      id: conversationId,
      title: 'Demo Conversation',
      userId: 'user-1',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      branches: [
        {
          id: 'main',
          conversationId,
          name: 'Main Branch',
          parentId: null,
          data: {
            messages: [
              { id: '1', sender: 'user', text: 'Hello!', timestamp: new Date().toISOString() },
              { id: '2', sender: 'ai', text: 'Hi there! How can I help you today?', timestamp: new Date().toISOString() }
            ]
          },
          isActive: true
        },
        {
          id: 'branch-1',
          conversationId,
          name: 'Alternative Path',
          parentId: 'main',
          data: {
            messages: [
              { id: '1', sender: 'user', text: 'Hello!', timestamp: new Date().toISOString() },
              { id: '2', sender: 'ai', text: 'Hello! What specific topic would you like to explore?', timestamp: new Date().toISOString() }
            ]
          },
          isActive: false
        }
      ]
    };
    res.json(conversation);
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// Switch active branch
app.put('/api/conversations/:conversationId/branches/:branchId/activate', async (req, res) => {
  try {
    const { conversationId, branchId } = req.params;
    console.log(`Activated branch ${branchId} in conversation ${conversationId}`);
    res.json({ success: true, activeBranch: branchId });
  } catch (error) {
    console.error('Error activating branch:', error);
    res.status(500).json({ error: 'Failed to activate branch' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
const PORT = process.env.PORT || 3001;
const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Start listening
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check available at http://localhost:${PORT}/health`);
      console.log(`🔧 API endpoints ready`);
      console.log('✅ Backend server is ready!');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    prisma.$disconnect();
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    prisma.$disconnect();
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
startServer();

export { app, server };