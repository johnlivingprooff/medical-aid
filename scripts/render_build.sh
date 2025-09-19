#!/bin/bash
# Render build script for Django application

set -e  # Exit on any error

echo "🚀 Starting Render build process..."

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

# Run Django deployment script
echo "⚙️  Running Django deployment setup..."
python scripts/render_deploy.py

echo "✅ Render build completed successfully!"