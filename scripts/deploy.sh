#!/bin/bash

# LLM Interface Deployment Script
# This script automates the deployment process for different environments

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/deploy.config.yml"

# Default values
ENVIRONMENT="development"
REGION="us-west-2"
CLUSTER_NAME="llm-interface"
SKIP_TESTS=false
SKIP_BUILD=false
SKIP_MIGRATE=false
FORCE_DEPLOY=false
DRY_RUN=false

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Show usage
usage() {
    cat << EOF
LLM Interface Deployment Script

Usage: $0 [OPTIONS] ENVIRONMENT

ENVIRONMENTS:
    development     Local development environment
    staging         Staging environment
    production      Production environment

OPTIONS:
    -h, --help              Show this help message
    -r, --region REGION     AWS region (default: us-west-2)
    -c, --cluster CLUSTER   Kubernetes cluster name
    --skip-tests           Skip running tests
    --skip-build           Skip building images
    --skip-migrate         Skip database migrations
    --force-deploy         Force deployment without confirmation
    --dry-run              Show what would be deployed without actually deploying

EXAMPLES:
    $0 development
    $0 --region us-east-1 staging
    $0 --skip-tests --force-deploy production

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            -r|--region)
                REGION="$2"
                shift 2
                ;;
            -c|--cluster)
                CLUSTER_NAME="$2"
                shift 2
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-migrate)
                SKIP_MIGRATE=true
                shift
                ;;
            --force-deploy)
                FORCE_DEPLOY=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            -*)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
            *)
                if [[ -z "$ENVIRONMENT" ]]; then
                    ENVIRONMENT="$1"
                else
                    log_error "Multiple environments specified"
                    usage
                    exit 1
                fi
                shift
                ;;
        esac
    done

    # Validate environment
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        log_error "Invalid environment: $ENVIRONMENT"
        usage
        exit 1
    fi
}

# Load configuration
load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        log_info "Loading configuration from $CONFIG_FILE"
        # Parse YAML config (simplified - in production use a proper YAML parser)
        eval "$(python3 -c "
import yaml
import json

with open('$CONFIG_FILE') as f:
    config = yaml.safe_load(f)

print(f'AWS_ACCOUNT={config.get(\"aws\", {}).get(\"account\", \"\")}')
print(f'ECR_REGISTRY={config.get(\"aws\", {}).get(\"ecr_registry\", \"\")}')
print(f'DOMAIN={config.get(\"domains\", {}).get(\"$ENVIRONMENT\", \"\")}')
print(f'NAMESPACE={config.get(\"kubernetes\", {}).get(\"namespace\", \"\")}')
")"
    else
        log_warning "Configuration file not found: $CONFIG_FILE"
        log_info "Using default values"
    fi
}

# Validate prerequisites
validate_prerequisites() {
    log_info "Validating prerequisites"

    # Check if required tools are installed
    local required_tools=("docker" "kubectl" "node" "npm")
    
    if [[ "$ENVIRONMENT" != "development" ]]; then
        required_tools+=("aws" "helm")
    fi

    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool not found: $tool"
            exit 1
        fi
    done

    # Check if we're in the right directory
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        log_error "Not in project root directory"
        exit 1
    fi

    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi

    # Check kubectl connection
    if [[ "$ENVIRONMENT" != "development" ]] && ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    log_success "Prerequisites validated"
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == true ]]; then
        log_warning "Skipping tests as requested"
        return 0
    fi

    log_info "Running tests"

    # Backend tests
    log_info "Running backend tests"
    cd "$PROJECT_ROOT/backend"
    npm ci
    npm run test
    npm run test:integration

    # Frontend tests
    log_info "Running frontend tests"
    cd "$PROJECT_ROOT/frontend"
    npm ci
    npm run test
    npm run test:e2e

    log_success "All tests passed"
}

# Build Docker images
build_images() {
    if [[ "$SKIP_BUILD" == true ]]; then
        log_warning "Skipping image build as requested"
        return 0
    fi

    log_info "Building Docker images"

    cd "$PROJECT_ROOT"

    # Get version from package.json
    local VERSION=$(node -p "require('./package.json').version")
    local GIT_SHA=$(git rev-parse --short HEAD)
    local TAG="${VERSION}-${GIT_SHA}"

    # Build backend image
    log_info "Building backend image"
    docker build \
        -f Dockerfile.backend \
        -t "llm-interface/backend:$TAG" \
        -t "llm-interface/backend:latest" \
        .

    # Build frontend image
    log_info "Building frontend image"
    docker build \
        -f Dockerfile.frontend \
        -t "llm-interface/frontend:$TAG" \
        -t "llm-interface/frontend:latest" \
        .

    # Push to registry if not development
    if [[ "$ENVIRONMENT" != "development" && "$DRY_RUN" == false ]]; then
        log_info "Pushing images to registry"
        
        # Tag and push backend
        docker tag "llm-interface/backend:$TAG" "$ECR_REGISTRY/llm-interface-backend:$TAG"
        docker tag "llm-interface/backend:latest" "$ECR_REGISTRY/llm-interface-backend:latest"
        docker push "$ECR_REGISTRY/llm-interface-backend:$TAG"
        docker push "$ECR_REGISTRY/llm-interface-backend:latest"

        # Tag and push frontend
        docker tag "llm-interface/frontend:$TAG" "$ECR_REGISTRY/llm-interface-frontend:$TAG"
        docker tag "llm-interface/frontend:latest" "$ECR_REGISTRY/llm-interface-frontend:latest"
        docker push "$ECR_REGISTRY/llm-interface-frontend:$TAG"
        docker push "$ECR_REGISTRY/llm-interface-frontend:latest"
    fi

    log_success "Docker images built successfully"
}

# Deploy to Kubernetes
deploy_kubernetes() {
    if [[ "$ENVIRONMENT" == "development" ]]; then
        deploy_docker_compose
        return 0
    fi

    log_info "Deploying to Kubernetes ($ENVIRONMENT)"

    # Set kubectl context
    if [[ "$ENVIRONMENT" == "production" ]]; then
        kubectl config use-context "$CLUSTER_NAME-prod"
    else
        kubectl config use-context "$CLUSTER_NAME-$ENVIRONMENT"
    fi

    # Create namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

    # Apply secrets
    log_info "Applying secrets"
    kubectl apply -f "$PROJECT_ROOT/k8s/secrets.yaml" -n "$NAMESPACE"

    # Apply ConfigMaps
    log_info "Applying ConfigMaps"
    kubectl apply -f "$PROJECT_ROOT/k8s/configmaps.yaml" -n "$NAMESPACE"

    # Deploy database (if needed)
    if [[ "$ENVIRONMENT" == "staging" ]]; then
        kubectl apply -f "$PROJECT_ROOT/k8s/postgres.yaml" -n "$NAMESPACE"
        kubectl apply -f "$PROJECT_ROOT/k8s/redis.yaml" -n "$NAMESPACE"
    fi

    # Deploy application
    log_info "Deploying application"
    envsubst < "$PROJECT_ROOT/k8s/backend-deployment.yaml" | kubectl apply -f - -n "$NAMESPACE"
    envsubst < "$PROJECT_ROOT/k8s/frontend-deployment.yaml" | kubectl apply -f - -n "$NAMESPACE"

    # Apply services and ingress
    kubectl apply -f "$PROJECT_ROOT/k8s/services.yaml" -n "$NAMESPACE"
    kubectl apply -f "$PROJECT_ROOT/k8s/ingress.yaml" -n "$NAMESPACE"

    # Wait for rollout
    log_info "Waiting for deployment rollout"
    kubectl rollout status deployment/llm-backend -n "$NAMESPACE" --timeout=600s
    kubectl rollout status deployment/llm-frontend -n "$NAMESPACE" --timeout=300s

    log_success "Kubernetes deployment completed"
}

# Deploy with Docker Compose
deploy_docker_compose() {
    log_info "Deploying with Docker Compose ($ENVIRONMENT)"

    cd "$PROJECT_ROOT"

    # Copy environment files
    cp ".env.$ENVIRONMENT" .env
    cp "frontend/.env.$ENVIRONMENT" frontend/.env.production

    # Start services
    if [[ "$DRY_RUN" == false ]]; then
        docker-compose -f docker-compose.prod.yml up -d

        # Wait for services to be ready
        log_info "Waiting for services to be ready"
        sleep 30

        # Check service health
        local health_url="http://localhost:3001/health"
        if curl -f "$health_url" &> /dev/null; then
            log_success "Services are healthy"
        else
            log_error "Services are not healthy"
            docker-compose logs
            exit 1
        fi
    else
        log_info "DRY RUN: Would run: docker-compose -f docker-compose.prod.yml up -d"
    fi

    log_success "Docker Compose deployment completed"
}

# Run database migrations
run_migrations() {
    if [[ "$SKIP_MIGRATE" == true ]]; then
        log_warning "Skipping database migrations as requested"
        return 0
    fi

    log_info "Running database migrations"

    if [[ "$ENVIRONMENT" == "development" ]]; then
        # Local migrations
        docker-compose exec backend npm run db:migrate
    else
        # Kubernetes migrations
        kubectl exec -n "$NAMESPACE" deployment/llm-backend -- npm run db:migrate
    fi

    log_success "Database migrations completed"
}

# Perform health check
health_check() {
    log_info "Performing health check"

    local max_attempts=30
    local attempt=1
    local health_url

    if [[ "$ENVIRONMENT" == "development" ]]; then
        health_url="http://localhost:3001/health"
    else
        health_url="https://$DOMAIN/health"
    fi

    while [[ $attempt -le $max_attempts ]]; do
        if curl -f "$health_url" &> /dev/null; then
            log_success "Health check passed"
            return 0
        fi

        log_info "Health check attempt $attempt/$max_attempts failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done

    log_error "Health check failed after $max_attempts attempts"
    return 1
}

# Show deployment summary
show_summary() {
    log_info "Deployment Summary"
    echo "===================="
    echo "Environment: $ENVIRONMENT"
    echo "Region: $REGION"
    echo "Cluster: $CLUSTER_NAME"
    echo "Domain: $DOMAIN"
    echo "Namespace: $NAMESPACE"
    echo "Skip Tests: $SKIP_TESTS"
    echo "Skip Build: $SKIP_BUILD"
    echo "Skip Migrate: $SKIP_MIGRATE"
    echo "Force Deploy: $FORCE_DEPLOY"
    echo "Dry Run: $DRY_RUN"
    echo "===================="
}

# Confirm deployment
confirm_deployment() {
    if [[ "$FORCE_DEPLOY" == true || "$DRY_RUN" == true ]]; then
        return 0
    fi

    echo
    log_warning "You are about to deploy to $ENVIRONMENT environment"
    echo "This will:"
    echo "  - Build and deploy new Docker images"
    echo "  - Run database migrations"
    echo "  - Update Kubernetes resources"
    echo
    read -p "Are you sure you want to continue? (yes/no): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^yes$ ]]; then
        log_info "Deployment cancelled"
        exit 0
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up"
    # Add any cleanup tasks here
}

# Main deployment function
main() {
    parse_args "$@"
    load_config
    validate_prerequisites
    
    show_summary
    confirm_deployment

    # Set up trap for cleanup
    trap cleanup EXIT

    # Run deployment steps
    run_tests
    build_images
    
    if [[ "$ENVIRONMENT" == "development" ]]; then
        deploy_docker_compose
    else
        deploy_kubernetes
    fi
    
    run_migrations
    health_check

    log_success "Deployment to $ENVIRONMENT completed successfully!"
    
    if [[ "$ENVIRONMENT" != "development" ]]; then
        echo
        log_info "Application URLs:"
        echo "  Frontend: https://$DOMAIN"
        echo "  API: https://api.$DOMAIN"
        echo "  Health: https://api.$DOMAIN/health"
    fi
}

# Execute main function
main "$@"