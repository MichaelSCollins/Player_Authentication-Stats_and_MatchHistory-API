#!/bin/bash

# Go Game API Docker Stop Script
# This script handles stopping the entire stack gracefully

set -e

echo "🛑 Stopping Go Game API Docker Stack..."

# Determine environment
ENVIRONMENT=${1:-production}
COMPOSE_FILE="docker-compose.yml"

if [ "$ENVIRONMENT" = "dev" ] || [ "$ENVIRONMENT" = "development" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
    echo "🔧 Stopping DEVELOPMENT stack..."
else
    echo "🚀 Stopping PRODUCTION stack..."
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install it and try again."
    exit 1
fi

# Stop the services gracefully
echo "⏳ Stopping services..."
docker-compose -f $COMPOSE_FILE down

# Remove orphaned containers
echo "🧹 Cleaning up orphaned containers..."
docker-compose -f $COMPOSE_FILE down --remove-orphans

# Optional: Remove volumes (uncomment if you want to clear data)
# echo "🗑️  Removing volumes..."
# docker-compose -f $COMPOSE_FILE down -v

echo ""
echo "✅ Go Game API Docker Stack has been stopped successfully!"
echo ""
echo "📋 To start again:"
echo "   - Production: ./docker/scripts/start.sh"
echo "   - Development: ./docker/scripts/start.sh dev"
echo ""
echo "💾 Your data has been preserved in Docker volumes."
echo "   To completely reset, run: docker-compose -f $COMPOSE_FILE down -v"
