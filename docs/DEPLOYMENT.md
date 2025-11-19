# Deployment Guide

## Production Deployment Options

### 1. Docker Compose (Recommended)

#### Prerequisites
- Docker and Docker Compose installed
- At least 4GB RAM
- 20GB storage space

#### Steps

1. **Clone the repository:**
```bash
git clone <repository-url>
cd LLM
```

2. **Configure environment variables:**
```bash
cp .env.example .env
# Edit .env with your production values
```

3. **Build and start services:**
```bash
make docker-up
make db-migrate
make db-seed  # Optional
```

4. **Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health checks: http://localhost:3000/health

### 2. Manual Deployment

#### Backend Setup

1. **Install Node.js 18+ and system dependencies:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm postgresql redis-server

# CentOS/RHEL
sudo yum install -y nodejs npm postgresql-server redis
```

2. **Setup PostgreSQL:**
```bash
sudo -u postgres createuser --interactive
sudo -u postgres createdb llm_interface
```

3. **Setup Redis:**
```bash
sudo systemctl start redis
sudo systemctl enable redis
```

4. **Deploy backend:**
```bash
cd backend
npm ci --only=production
npm run build
npm run db:migrate
npm run db:generate
```

5. **Start backend service:**
```bash
# Using PM2 (recommended)
npm install -g pm2
pm2 start ecosystem.config.js

# Or directly
npm start
```

#### Frontend Setup

1. **Install dependencies:**
```bash
cd frontend
npm ci
```

2. **Build for production:**
```bash
npm run build
```

3. **Serve with nginx:**
```bash
sudo cp nginx.conf /etc/nginx/sites-available/llm-interface
sudo ln -s /etc/nginx/sites-available/llm-interface /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Cloud Deployment

#### AWS ECS

1. **Create ECR repositories:**
```bash
aws ecr create-repository --repository-name llm-frontend
aws ecr create-repository --repository-name llm-backend
```

2. **Build and push images:**
```bash
# Build and tag images
docker build -f docker/frontend.Dockerfile -t llm-frontend .
docker build -f docker/backend.Dockerfile -t llm-backend .

# Push to ECR
docker tag llm-frontend:latest <aws-account-id>.dkr.ecr.<region>.amazonaws.com/llm-frontend:latest
docker tag llm-backend:latest <aws-account-id>.dkr.ecr.<region>.amazonaws.com/llm-backend:latest

docker push <aws-account-id>.dkr.ecr.<region>.amazonaws.com/llm-frontend:latest
docker push <aws-account-id>.dkr.ecr.<region>.amazonaws.com/llm-backend:latest
```

3. **Deploy ECS Task Definition:**
```json
{
  "family": "llm-interface",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "frontend",
      "image": "<aws-account-id>.dkr.ecr.<region>.amazonaws.com/llm-frontend:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ]
    },
    {
      "name": "backend",
      "image": "<aws-account-id>.dkr.ecr.<region>.amazonaws.com/llm-backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DATABASE_URL",
          "value": "postgresql://user:pass@rds-endpoint:5432/llm_interface"
        },
        {
          "name": "REDIS_URL",
          "value": "redis://elasticache-endpoint:6379"
        }
      ]
    }
  ]
}
```

#### Google Cloud Run

1. **Build and deploy backend:**
```bash
gcloud builds submit --tag gcr.io/PROJECT-ID/llm-backend
gcloud run deploy llm-backend --image gcr.io/PROJECT-ID/llm-backend --platform managed
```

2. **Build and deploy frontend:**
```bash
gcloud builds submit --tag gcr.io/PROJECT-ID/llm-frontend
gcloud run deploy llm-frontend --image gcr.io/PROJECT-ID/llm-frontend --platform managed
```

#### DigitalOcean App Platform

1. **Create app configuration:**
```yaml
name: llm-interface
services:
- name: backend
  source_dir: backend
  github:
    repo: your-username/llm-interface
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    value: ${db.DATABASE_URL}
  - key: REDIS_URL
    value: ${redis.REDIS_URL}

databases:
- name: db
  engine: PG
  version: "13"

- name: redis
  engine: REDIS
  version: "7"
```

## Environment Configuration

### Production Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis
REDIS_URL=redis://host:6379

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-here
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=https://yourdomain.com

# LLM Providers
OPENAI_API_KEY=sk-...
OLLAMA_BASE_URL=http://localhost:11434

# File Upload
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=10MB

# Logging
LOG_LEVEL=warn
LOG_FILE=/app/logs/app.log
```

### Security Considerations

1. **Environment Variables:**
   - Never commit secrets to version control
   - Use strong, randomly generated secrets
   - Rotate keys regularly

2. **Database Security:**
   - Use SSL connections
   - Implement connection pooling
   - Regular backups

3. **API Security:**
   - Enable rate limiting
   - Implement request validation
   - Use HTTPS only

4. **File Upload Security:**
   - Validate file types
   - Scan for malware
   - Use cloud storage for production

## Monitoring and Logging

### Application Monitoring

1. **Health Checks:**
   - `/health` endpoint
   - Database connectivity
   - Redis connectivity
   - LLM provider status

2. **Metrics Collection:**
```javascript
// Example: Prometheus metrics
const prometheus = require('prom-client');

const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const workflowExecutions = new prometheus.Counter({
  name: 'workflow_executions_total',
  help: 'Total number of workflow executions',
  labelNames: ['status', 'workflow_type']
});
```

3. **Logging:**
   - Structured JSON logging
   - Log levels and categories
   - Centralized log aggregation

### Infrastructure Monitoring

1. **Docker Containers:**
```bash
# Monitor container health
docker ps
docker stats
docker logs <container-name>
```

2. **System Resources:**
   - CPU usage
   - Memory usage
   - Disk space
   - Network I/O

3. **Database Monitoring:**
   - Connection count
   - Query performance
   - Replication lag

## Scaling Considerations

### Horizontal Scaling

1. **Load Balancer Configuration:**
```nginx
upstream backend {
    server backend-1:3001;
    server backend-2:3001;
    server backend-3:3001;
}

server {
    listen 80;
    location /api/ {
        proxy_pass http://backend;
    }
}
```

2. **Database Scaling:**
   - Read replicas
   - Connection pooling
   - Query optimization

3. **Redis Scaling:**
   - Redis Cluster
   - Connection pooling
   - Memory management

### Performance Optimization

1. **Caching Strategy:**
   - Application-level caching
   - Database query caching
   - CDN for static assets

2. **Database Optimization:**
   - Index optimization
   - Query optimization
   - Connection pooling

3. **Frontend Optimization:**
   - Code splitting
   - Lazy loading
   - Asset optimization

## Backup and Recovery

### Database Backups

1. **Automated Backups:**
```bash
# Daily backup script
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U postgres llm_interface > $BACKUP_DIR/backup_$DATE.sql

# Keep last 30 days
find $BACKUP_DIR -name "backup_*.sql" -mtime +30 -delete
```

2. **Point-in-Time Recovery:**
   - Enable WAL archiving
   - Regular base backups
   - Test recovery procedures

### Disaster Recovery

1. **Multi-region Deployment:**
   - Active-active setup
   - Data replication
   - Failover procedures

2. **Recovery Testing:**
   - Regular drill tests
   - Documentation updates
   - RTO/RPO measurements

## Troubleshooting

### Common Issues

1. **Database Connection Errors:**
   - Check connection string
   - Verify network connectivity
   - Check database status

2. **Redis Connection Issues:**
   - Verify Redis service
   - Check network connectivity
   - Validate connection parameters

3. **File Upload Problems:**
   - Check disk space
   - Verify permissions
   - Validate file size limits

### Debugging Tools

1. **Application Logs:**
```bash
# View real-time logs
tail -f logs/app.log

# Search logs
grep "ERROR" logs/app.log
```

2. **Database Queries:**
```sql
-- Monitor active connections
SELECT * FROM pg_stat_activity;

-- Analyze slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC;
```

3. **Performance Profiling:**
```javascript
// Node.js profiling
node --prof app.js
node --prof-process isolate-*.log > processed.txt
```

## Maintenance

### Regular Tasks

1. **Daily:**
   - Check system health
   - Review error logs
   - Monitor resource usage

2. **Weekly:**
   - Update dependencies
   - Review security advisories
   - Optimize database

3. **Monthly:**
   - Security updates
   - Performance reviews
   - Capacity planning

### Update Procedures

1. **Application Updates:**
   - Blue-green deployment
   - Rolling updates
   - Rollback procedures

2. **Database Migrations:**
   - Test in staging
   - Backup before migration
   - Monitor performance

3. **Dependency Updates:**
   - Security patches
   - Version compatibility
   - Regression testing