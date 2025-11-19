# LLM Interface Deployment Guide

This comprehensive guide covers deployment strategies, configuration, and maintenance procedures for the LLM Interface system.

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Prerequisites](#prerequisites)
3. [Environment Configuration](#environment-configuration)
4. [Deployment Methods](#deployment-methods)
5. [Monitoring and Maintenance](#monitoring-and-maintenance)
6. [Troubleshooting](#troubleshooting)
7. [Performance Optimization](#performance-optimization)
8. [Security Considerations](#security-considerations)

## Deployment Overview

The LLM Interface system consists of:
- **Backend API**: Node.js/Express server with TypeScript
- **Frontend SPA**: React/Vite application
- **Database**: PostgreSQL
- **Cache**: Redis
- **Optional**: Local LLM inference with Ollama

### Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │    │   Backend   │    │  Database   │
│  (React)    │◄──►│  (Node.js)  │◄──►│ (PostgreSQL)│
└─────────────┘    └─────────────┘    └─────────────┘
                           │
                   ┌─────────────┐
                   │    Redis    │
                   │   (Cache)   │
                   └─────────────┘
```

## Prerequisites

### System Requirements

- **Node.js**: 20.x or higher
- **PostgreSQL**: 15.x or higher
- **Redis**: 7.x or higher
- **Docker**: 20.x or higher (for containerized deployment)
- **Docker Compose**: 2.x or higher

### Minimum Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4GB | 8GB |
| Storage | 20GB | 100GB SSD |
| Network | 100Mbps | 1Gbps |

### Cloud Provider Setup

This deployment guide supports:
- **AWS**: ECS/Fargate, RDS, ElastiCache
- **Google Cloud**: GKE, Cloud SQL, Memorystore
- **Azure**: Container Instances, PostgreSQL, Redis Cache
- **DigitalOcean**: App Platform, Managed Databases
- **Self-hosted**: Docker Swarm, Kubernetes

## Environment Configuration

### Environment Variables

Create `.env` files for each service:

#### Backend Environment (.env)

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/llm_production
POSTGRES_DB=llm_production
POSTGRES_USER=llm_user
POSTGRES_PASSWORD=your_secure_password

# Redis Configuration
REDIS_URL=redis://:password@localhost:6379/0
REDIS_PASSWORD=your_redis_password

# Application Configuration
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Authentication
JWT_SECRET=your_super_secure_jwt_secret_key_here
JWT_EXPIRES_IN=7d
JWT_ISSUER=llm-interface
JWT_AUDIENCE=llm-interface-users

# LLM Service Configuration
OPENAI_API_KEY=sk-your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
OLLAMA_BASE_URL=http://localhost:11434

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Security
HELMET_ENABLED=true
BCRYPT_ROUNDS=12

# Monitoring (Optional)
SENTRY_DSN=your-sentry-dsn
PROMETHEUS_ENABLED=true
METRICS_PORT=9090

# Performance
COMPRESSION_ENABLED=true
Caching
CACHE_TTL=3600
```

#### Frontend Environment (.env.production)

```bash
# API Configuration
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com

# Application Configuration
VITE_APP_NAME=LLM Interface
VITE_APP_VERSION=1.0.0

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DEBUG_MODE=false

# Third-party Services
VITE_SENTRY_DSN=your-frontend-sentry-dsn
```

## Deployment Methods

### 1. Docker Compose (Recommended for Development/Small Production)

#### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/llm-interface.git
cd llm-interface

# Copy environment templates
cp .env.example .env
cp frontend/.env.example frontend/.env.production

# Edit environment files
nano .env
nano frontend/.env.production

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Initialize database
docker-compose exec backend npm run db:migrate
docker-compose exec backend npm run db:seed

# Check status
docker-compose ps
```

#### Production Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - llm-network

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - llm-network

  backend:
    image: ghcr.io/your-org/llm-interface/backend:latest
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - redis
    networks:
      - llm-network

  frontend:
    image: ghcr.io/your-org/llm-interface/frontend:latest
    networks:
      - llm-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
    networks:
      - llm-network

networks:
  llm-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
```

### 2. Kubernetes Deployment

#### Namespace and ConfigMaps

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: llm-interface

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: llm-interface-config
  namespace: llm-interface
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  CORS_ORIGIN: "https://yourdomain.com"
```

#### Secrets

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: llm-interface-secrets
  namespace: llm-interface
type: Opaque
data:
  DATABASE_URL: <base64-encoded-database-url>
  REDIS_URL: <base64-encoded-redis-url>
  JWT_SECRET: <base64-encoded-jwt-secret>
  OPENAI_API_KEY: <base64-encoded-openai-key>
```

#### Backend Deployment

```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-backend
  namespace: llm-interface
spec:
  replicas: 3
  selector:
    matchLabels:
      app: llm-backend
  template:
    metadata:
      labels:
        app: llm-backend
    spec:
      containers:
      - name: backend
        image: ghcr.io/your-org/llm-interface/backend:latest
        ports:
        - containerPort: 3001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: llm-interface-secrets
              key: DATABASE_URL
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: llm-interface-secrets
              key: REDIS_URL
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: llm-interface-secrets
              key: JWT_SECRET
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### Service and Ingress

```yaml
# k8s/services.yaml
apiVersion: v1
kind: Service
metadata:
  name: llm-backend-service
  namespace: llm-interface
spec:
  selector:
    app: llm-backend
  ports:
  - port: 3001
    targetPort: 3001
  type: ClusterIP

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: llm-interface-ingress
  namespace: llm-interface
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
spec:
  tls:
  - hosts:
    - yourdomain.com
    - api.yourdomain.com
    secretName: llm-interface-tls
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: llm-backend-service
            port:
              number: 3001
  - host: yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: llm-frontend-service
            port:
              number: 80
```

### 3. Cloud Native Deployment

#### AWS ECS Deployment

```json
{
  "family": "llm-interface-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "ghcr.io/your-org/llm-interface/backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:llm-db-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/llm-interface",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### Google Cloud Run Deployment

```bash
# Build and push image
gcloud builds submit --tag gcr.io/PROJECT-ID/llm-backend

# Deploy to Cloud Run
gcloud run deploy llm-backend \
  --image gcr.io/PROJECT-ID/llm-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=llm-db-url:latest
```

## Monitoring and Maintenance

### Health Checks

The application provides multiple health endpoints:

- `/health` - Basic health check
- `/ready` - Readiness probe (Kubernetes)
- `/live` - Liveness probe (Kubernetes)
- `/metrics` - Prometheus metrics

### Monitoring Stack

#### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'llm-backend'
    static_configs:
      - targets: ['backend:3001']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
```

#### Grafana Dashboards

Pre-configured dashboards for:
- Application metrics
- Database performance
- Redis performance
- System resources
- LLM service usage

### Logging

#### Structured Logging

The application uses structured logging with winston:

```javascript
{
  "level": "info",
  "message": "User workflow executed",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "userId": "user-123",
  "workflowId": "workflow-456",
  "executionTime": 1500,
  "metadata": {
    "nodes": 3,
    "tokens": 250
  }
}
```

#### Log Aggregation

```yaml
# docker-compose.logging.yml
version: '3.8'

services:
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - ./loki.yml:/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log
      - ./promtail.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml
```

### Backup Strategy

#### Database Backups

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgres"
DB_NAME="llm_production"

# Create backup
docker-compose exec -T postgres pg_dump -U llm_user $DB_NAME | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/backup_$DATE.sql.gz s3://your-backup-bucket/postgres/
```

#### Redis Backups

```bash
#!/bin/bash
# redis-backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/redis"

# Create Redis backup
docker-compose exec redis redis-cli BGSAVE
docker cp $(docker-compose ps -q redis):/data/dump.rdb $BACKUP_DIR/redis_$DATE.rdb

# Compress backup
gzip $BACKUP_DIR/redis_$DATE.rdb
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

```bash
# Check database status
docker-compose exec postgres pg_isready

# Check connection logs
docker-compose logs backend | grep -i database

# Reset database connection
docker-compose restart postgres
```

#### 2. Redis Connection Issues

```bash
# Check Redis status
docker-compose exec redis redis-cli ping

# Monitor Redis
docker-compose exec redis redis-cli monitor

# Clear Redis cache (if needed)
docker-compose exec redis redis-cli FLUSHALL
```

#### 3. High Memory Usage

```bash
# Check memory usage
docker stats

# Monitor Node.js memory
docker-compose exec backend node -e "console.log(process.memoryUsage())"

# Restart services if needed
docker-compose restart backend
```

#### 4. SSL Certificate Issues

```bash
# Check certificate expiration
openssl x509 -in /path/to/certificate.crt -text -noout | grep "Not After"

# Renew certificates (Let's Encrypt)
certbot renew

# Test SSL configuration
nginx -t
```

### Performance Issues

#### Database Performance

```sql
-- Check slow queries
SELECT query, mean_exec_time, calls, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check active connections
SELECT count(*), state
FROM pg_stat_activity
GROUP BY state;

-- Analyze table statistics
ANALYZE;
```

#### Cache Performance

```bash
# Check Redis memory usage
docker-compose exec redis redis-cli info memory

# Monitor cache hit rate
docker-compose exec redis redis-cli info stats | grep keyspace
```

## Performance Optimization

### Database Optimization

```sql
-- Add indexes for frequently queried fields
CREATE INDEX idx_workflows_user_id ON workflows(user_id);
CREATE INDEX idx_executions_workflow_id ON executions(workflow_id);
CREATE INDEX idx_nodes_workflow_id ON nodes(workflow_id);

-- Partition large tables (if needed)
CREATE TABLE executions_2024 PARTITION OF executions
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

### Application Optimization

```javascript
// Enable compression
app.use(compression());

// Optimize Redis connections
const redis = new Redis({
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
});

// Implement connection pooling for database
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Frontend Optimization

```javascript
// Enable lazy loading
const LazyComponent = React.lazy(() => import('./Component'));

// Implement virtual scrolling
import { FixedSizeList as List } from 'react-window';

// Optimize bundle size
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
        }
      }
    }
  }
});
```

## Security Considerations

### Network Security

```yaml
# Network policies for Kubernetes
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: llm-interface-netpol
  namespace: llm-interface
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
```

### Security Headers

```javascript
// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### API Security

```javascript
// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

// Input validation
app.use('/api/workflows', validateRequest(workflowSchema));
```

## Maintenance Tasks

### Daily Tasks

- Check system health and logs
- Monitor resource usage
- Review error rates
- Check backup completion

### Weekly Tasks

- Review performance metrics
- Update security patches
- Clean up old logs and temporary files
- Monitor database growth

### Monthly Tasks

- Review and update dependencies
- Perform security audit
- Analyze usage patterns
- Optimize database indexes

### Emergency Procedures

#### Service Recovery

```bash
# Quick restart
docker-compose restart

# Full recovery
docker-compose down
docker-compose up -d

# Database recovery from backup
docker-compose exec -T postgres psql -U llm_user -d llm_production < backup.sql
```

#### Incident Response

1. **Detection**: Monitor alerts and health checks
2. **Assessment**: Determine impact and root cause
3. **Containment**: Isolate affected services
4. **Recovery**: Restore services from backups
5. **Post-mortem**: Document and improve processes

---

## Support

For deployment support and questions:
- **Documentation**: Check inline code comments and README files
- **Issues**: Create GitHub issues for bugs and feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas
- **Email**: support@yourdomain.com for critical issues

Remember to regularly update this documentation as your deployment evolves and new best practices emerge.