#!/bin/bash

# Go Game API Docker Cleanup Script
# This script completely removes containers, volumes, and images

set -e

echo "🧹 Go Game API Docker Cleanup Script"
echo "⚠️  WARNING: This will remove ALL containers, volumes, and images!"
echo ""

# Confirm action
read -p "Are you sure you want to continue? This will delete all data! (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled."
    exit 1
fi

echo ""
echo "🛑 Stopping all containers..."
docker-compose -f docker-compose.yml down --remove-orphans -v
docker-compose -f docker-compose.dev.yml down --remove-orphans -v

echo "🗑️  Removing all containers..."
docker container prune -f

echo "🗑️  Removing all volumes..."
docker volume prune -f

echo "🗑️  Removing all networks..."
docker network prune -f

echo "🗑️  Removing all images..."
docker image prune -a -f

echo "🧹 Removing build cache..."
docker builder prune -f

echo ""
echo "✅ Cleanup completed successfully!"
echo ""
echo "📋 All Docker resources have been removed:"
echo "   - Containers"
echo "   - Volumes (including database data)"
echo "   - Networks"
echo "   - Images"
echo "   - Build cache"
echo ""
echo "🚀 To start fresh, run: ./docker/scripts/start.sh"
