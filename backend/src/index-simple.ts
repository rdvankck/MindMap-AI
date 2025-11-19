import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Basic routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'LLM Node Interface API is running!' });
});

// Basic workflow routes
app.get('/api/workflows', async (req, res) => {
  try {
    const workflows = await prisma.workflow.findMany({
      include: { user: { select: { id: true, name: true, email: true } } }
    });
    res.json(workflows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

app.post('/api/workflows', async (req, res) => {
  try {
    const { name, description, data } = req.body;
    const workflow = await prisma.workflow.create({
      data: {
        name,
        description,
        data: data || {},
        userId: 'default-user' // Simplified for demo
      }
    });
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});