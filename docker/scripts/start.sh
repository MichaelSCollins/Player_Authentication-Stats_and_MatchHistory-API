#!/bin/bash

# Go Game API Docker Startup Script
# This script handles starting the entire stack with proper health checks

set -e

echo "🚀 Starting Go Game API Docker Stack..."

# Function to check if a service is healthy
wait_for_service() {
    local service_name=$1
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $service_name to be healthy..."
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose ps $service_name | grep -q "healthy"; then
            echo "✅ $service_name is healthy!"
            return 0
        fi
        
        echo "⏳ Attempt $attempt/$max_attempts: $service_name is not ready yet..."
        sleep 10
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service_name failed to become healthy after $max_attempts attempts"
    return 1
}

# Function to display service status
show_status() {
    echo ""
    echo "📊 Service Status:"
    docker-compose ps
    echo ""
}

# Function to display logs
show_logs() {
    local service_name=$1
    echo ""
    echo "📋 Logs for $service_name:"
    docker-compose logs --tail=20 $service_name
    echo ""
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install it and try again."
    exit 1
fi

# Determine environment
ENVIRONMENT=${1:-production}
COMPOSE_FILE="docker-compose.yml"

if [ "$ENVIRONMENT" = "dev" ] || [ "$ENVIRONMENT" = "development" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
    echo "🔧 Starting in DEVELOPMENT mode..."
else
    echo "🚀 Starting in PRODUCTION mode..."
fi

# Stop any existing containers
echo "🛑 Stopping any existing containers..."
docker-compose -f $COMPOSE_FILE down --remove-orphans

# Start the services
echo "🔧 Starting services..."
docker-compose -f $COMPOSE_FILE up -d

# Wait for MongoDB to be healthy
if wait_for_service "mongodb"; then
    echo "✅ MongoDB is ready!"
else
    echo "❌ MongoDB failed to start properly"
    show_logs "mongodb"
    exit 1
fi

# Wait for API to be healthy
if wait_for_service "api"; then
    echo "✅ API is ready!"
else
    echo "❌ API failed to start properly"
    show_logs "api"
    exit 1
fi

# Show final status
show_status

echo ""
echo "🎉 Go Game API is now running!"
echo ""
echo "📱 API Endpoints:"
echo "   - API Server: http://localhost:3000"
echo "   - Health Check: http://localhost:3000/health"
echo "   - MongoDB Express: http://localhost:8081"
echo ""
echo "🔑 Test Credentials:"
echo "   - Admin: admin / admin123"
echo "   - Player: testplayer / test123"
echo ""
echo "📋 Useful Commands:"
echo "   - View logs: docker-compose -f $COMPOSE_FILE logs -f [service]"
echo "   - Stop services: docker-compose -f $COMPOSE_FILE down"
echo "   - Restart services: docker-compose -f $COMPOSE_FILE restart"
echo "   - View status: docker-compose -f $COMPOSE_FILE ps"
echo ""
echo "🌐 The API is ready to accept connections from your Unity app!"
