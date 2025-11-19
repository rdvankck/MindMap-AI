.PHONY: help install dev build test clean docker-up docker-down docker-reset db-migrate db-seed lint format

# Default target
help:
	@echo "Available commands:"
	@echo "  install     - Install dependencies for all packages"
	@echo "  dev         - Start development servers"
	@echo "  build       - Build all packages"
	@echo "  test        - Run tests for all packages"
	@echo "  clean       - Clean build artifacts"
	@echo "  lint        - Run linting"
	@echo "  format      - Format code"
	@echo "  docker-up   - Start Docker services"
	@echo "  docker-down - Stop Docker services"
	@echo "  docker-reset - Reset Docker environment"
	@echo "  db-migrate  - Run database migrations"
	@echo "  db-seed     - Seed database with sample data"

# Install dependencies
install:
	npm install
	cd frontend && npm install
	cd backend && npm install
	cd shared && npm install

# Development
dev:
	npm run dev

# Build
build:
	npm run build

# Testing
test:
	npm run test

# Clean build artifacts
clean:
	rm -rf node_modules
	rm -rf frontend/node_modules
	rm -rf backend/node_modules
	rm -rf shared/node_modules
	rm -rf frontend/dist
	rm -rf backend/dist
	rm -rf shared/dist

# Linting
lint:
	npm run lint
	cd frontend && npm run lint
	cd backend && npm run lint

# Format code
format:
	cd frontend && npm run lint:fix
	cd backend && npm run lint:fix

# Docker commands
docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-reset:
	docker-compose down -v
	docker-compose up -d

# Database commands
db-migrate:
	cd backend && npm run db:migrate

db-seed:
	cd backend && npm run db:seed

# Development setup
setup: install docker-up db-migrate

# Production build
prod-build: docker-up
	docker-compose build

# Start production
prod-start:
	docker-compose up -d

# Stop production
prod-stop:
	docker-compose down

# Watch for changes
watch:
	npm run dev:backend &
	npm run dev:frontend

# Generate Prisma client
db-generate:
	cd backend && npm run db:generate

# View database
db-studio:
	cd backend && npm run db:studio

# Check health
health:
	curl http://localhost:3000/health || echo "Frontend not running"
	curl http://localhost:3001/health || echo "Backend not running"

# Logs
logs:
	docker-compose logs -f

# Backend logs
logs-backend:
	docker-compose logs -f backend

# Frontend logs
logs-frontend:
	docker-compose logs -f frontend

# Database logs
logs-db:
	docker-compose logs -f postgres

# Redis logs
logs-redis:
	docker-compose logs -f redis

# Backup database
backup-db:
	docker-compose exec postgres pg_dump -U postgres llm_interface > backup_$(shell date +%Y%m%d_%H%M%S).sql

# Restore database
restore-db:
	@read -p "Enter backup file path: " backup_file; \
	docker-compose exec -T postgres psql -U postgres llm_interface < $$backup_file