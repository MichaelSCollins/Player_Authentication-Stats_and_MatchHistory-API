# Go Game API Makefile
# Simplifies common Docker operations and development tasks

.PHONY: help build start stop restart dev prod logs status clean clean-all test lint

# Default target
help:
	@echo "🎮 Go Game API - Available Commands:"
	@echo ""
	@echo "🚀 Production Commands:"
	@echo "  make build     - Build production Docker images"
	@echo "  make start     - Start production stack"
	@echo "  make stop      - Stop production stack"
	@echo "  make restart   - Restart production stack"
	@echo "  make logs      - View production logs"
	@echo "  make status    - Show production service status"
	@echo ""
	@echo "🔧 Development Commands:"
	@echo "  make dev       - Start development stack with hot reload"
	@echo "  make dev-stop  - Stop development stack"
	@echo "  make dev-logs  - View development logs"
	@echo ""
	@echo "🧹 Maintenance Commands:"
	@echo "  make clean     - Remove containers and networks (keep volumes)"
	@echo "  make clean-all - Remove everything including volumes and images"
	@echo ""
	@echo "📋 Quality Commands:"
	@echo "  make test      - Run tests"
	@echo "  make lint      - Run ESLint"
	@echo "  make build-ts  - Build TypeScript"
	@echo ""

# Production commands
build:
	@echo "🔨 Building production Docker images..."
	docker-compose build --no-cache

start:
	@echo "🚀 Starting production stack..."
	@chmod +x docker/scripts/start.sh
	./docker/scripts/start.sh

stop:
	@echo "🛑 Stopping production stack..."
	@chmod +x docker/scripts/stop.sh
	./docker/scripts/stop.sh

restart: stop start

logs:
	@echo "📋 Production logs:"
	docker-compose logs -f

status:
	@echo "📊 Production service status:"
	docker-compose ps

# Development commands
dev:
	@echo "🔧 Starting development stack..."
	@chmod +x docker/scripts/start.sh
	./docker/scripts/start.sh dev

dev-stop:
	@echo "🛑 Stopping development stack..."
	@chmod +x docker/scripts/stop.sh
	./docker/scripts/stop.sh dev

dev-logs:
	@echo "📋 Development logs:"
	docker-compose -f docker-compose.dev.yml logs -f

dev-status:
	@echo "📊 Development service status:"
	docker-compose -f docker-compose.dev.yml ps

# Maintenance commands
clean:
	@echo "🧹 Cleaning up containers and networks..."
	docker-compose down --remove-orphans
	docker-compose -f docker-compose.dev.yml down --remove-orphans
	docker container prune -f
	docker network prune -f

clean-all:
	@echo "🧹 Complete cleanup (WARNING: This will delete all data!)"
	@chmod +x docker/scripts/cleanup.sh
	./docker/scripts/cleanup.sh

# Quality commands
test:
	@echo "🧪 Running tests..."
	npm test

lint:
	@echo "🔍 Running ESLint..."
	npm run lint

lint-fix:
	@echo "🔧 Fixing ESLint issues..."
	npm run lint:fix

build-ts:
	@echo "🔨 Building TypeScript..."
	npm run build

# Database commands
db-shell:
	@echo "🗄️  Opening MongoDB shell..."
	docker exec -it go-game-mongodb mongosh -u admin -p password123 --authenticationDatabase admin go-game-db

db-express:
	@echo "🌐 Opening MongoDB Express..."
	@echo "URL: http://localhost:8081"
	@echo "Username: admin"
	@echo "Password: password123"

# Utility commands
shell:
	@echo "🐚 Opening API container shell..."
	docker exec -it go-game-api sh

shell-dev:
	@echo "🐚 Opening development API container shell..."
	docker exec -it go-game-api-dev sh

# Health checks
health:
	@echo "🏥 Checking API health..."
	curl -f http://localhost:3000/health || echo "❌ API is not healthy"

health-dev:
	@echo "🏥 Checking development API health..."
	curl -f http://localhost:3000/health || echo "❌ Development API is not healthy"

# Quick start for development
quick-dev: dev
	@echo "⏳ Waiting for services to be ready..."
	@sleep 30
	@make health-dev
	@echo "🎉 Development environment is ready!"
	@echo "📱 API: http://localhost:3000"
	@echo "🗄️  MongoDB Express: http://localhost:8081"
