#!/bin/bash

# Development Setup Script for Disposable Suite

echo "🚀 Setting up Disposable Suite for development..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker is not installed. Some features may not work."
else
    echo "✅ Docker is installed"
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "⚠️  Docker Compose is not installed. Some features may not work."
else
    echo "✅ Docker Compose is installed"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "✅ Created .env file. Please review and update the configuration."
else
    echo "✅ .env file already exists"
fi

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs

# Build the application
echo "🔨 Building the application..."
npm run build

# Run type check
echo "🔍 Running type check..."
npm run type-check

# Run linting
echo "🧹 Running linting..."
npm run lint

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Review and update .env file with your configuration"
echo "2. Start Redis (if using persistence): docker run -d -p 6379:6379 redis:7-alpine"
echo "3. Start development server: npm run dev"
echo "4. Visit http://localhost:4000/api-docs for API documentation"
echo ""
echo "For production deployment:"
echo "1. docker-compose up -d"
echo "" 