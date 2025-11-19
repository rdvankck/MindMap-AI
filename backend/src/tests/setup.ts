import { config } from '@/config';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/llm_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.OLLAMA_BASE_URL = 'http://localhost:11434';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set timeout for async operations
jest.setTimeout(30000);

// Mock WebSocket for testing
global.WebSocket = jest.fn().mockImplementation(() => ({
  close: jest.fn(),
  send: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}));

// Setup test database connection
beforeAll(async () => {
  // Mock database and Redis connections for testing
  const { prisma } = await import('@/config/database');
  const { redis } = await import('@/config/redis');
  
  // Initialize mock connections
  jest.spyOn(prisma, '$connect').mockResolvedValue(undefined);
  jest.spyOn(prisma, '$disconnect').mockResolvedValue(undefined);
  jest.spyOn(redis, 'connect').mockResolvedValue(undefined);
  jest.spyOn(redis, 'disconnect').mockResolvedValue(undefined);
});

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Cleanup after all tests
afterAll(async () => {
  // Restore all mocks
  jest.restoreAllMocks();
});