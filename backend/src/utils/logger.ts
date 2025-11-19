import winston from 'winston';
import { config } from '@/config';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`,
      ),
    ),
  }),
];

// Add file transport if not in test environment
if (config.env !== 'test') {
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  );

  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: config.logging.file,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  );
}

// Create the logger
const logger = winston.createLogger({
  level: config.logging.level,
  levels,
  format,
  transports,
  exitOnError: false,
});

// If we're not in production, log to the console with the simple format
if (config.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`,
      ),
    ),
  }));
}

// Create a stream object for Morgan HTTP logger
logger.stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
} as any;

// Helper functions for structured logging
export const logUserAction = (userId: string, action: string, details?: any) => {
  logger.info(`User Action: ${action}`, {
    userId,
    action,
    details,
    type: 'user_action',
  });
};

export const logWorkflowExecution = (
  workflowId: string, 
  executionId: string, 
  status: string, 
  details?: any
) => {
  logger.info(`Workflow Execution: ${status}`, {
    workflowId,
    executionId,
    status,
    details,
    type: 'workflow_execution',
  });
};

export const logNodeExecution = (
  nodeId: string,
  nodeType: string,
  status: string,
  duration?: number,
  error?: string,
) => {
  const logData = {
    nodeId,
    nodeType,
    status,
    duration,
    error,
    type: 'node_execution',
  };

  if (status === 'error') {
    logger.error(`Node Execution Error: ${nodeType}`, logData);
  } else {
    logger.info(`Node Execution: ${status}`, logData);
  }
};

export const logApiRequest = (
  method: string,
  url: string,
  userId?: string,
  statusCode?: number,
  duration?: number,
) => {
  logger.http(`${method} ${url}`, {
    method,
    url,
    userId,
    statusCode,
    duration,
    type: 'api_request',
  });
};

export const logSecurityEvent = (
  event: string,
  userId?: string,
  ip?: string,
  details?: any,
) => {
  logger.warn(`Security Event: ${event}`, {
    event,
    userId,
    ip,
    details,
    type: 'security_event',
  });
};

export const logPerformance = (
  operation: string,
  duration: number,
  details?: any,
) => {
  logger.info(`Performance: ${operation}`, {
    operation,
    duration,
    details,
    type: 'performance',
  });
};

export const logError = (error: Error, context?: any) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    context,
    type: 'application_error',
  });
};

export default logger;