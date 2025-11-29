#!/bin/bash

# Complete EC2 Setup Script
# This script sets up everything needed for the Buddylynk backend on EC2

echo "=========================================="
echo "Buddylynk EC2 Setup Script"
echo "=========================================="
echo ""

# Update system
echo "📦 Updating system packages..."
sudo yum update -y || sudo apt-get update -y

# Install Node.js if not installed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash - || \
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo yum install -y nodejs || sudo apt-get install -y nodejs
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ NPM version: $(npm --version)"
echo ""

# Install Redis
echo "📦 Installing Redis..."
chmod +x ./scripts/install-redis.sh
./scripts/install-redis.sh

# Install PM2 globally for process management
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

echo "✅ PM2 version: $(pm2 --version)"
echo ""

# Install project dependencies
echo "📦 Installing project dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Please update .env with your configuration!"
    echo ""
fi

# Setup PM2 to start on boot
echo "🔧 Configuring PM2 to start on boot..."
pm2 startup | tail -n 1 | sudo bash

echo ""
echo "=========================================="
echo "✅ EC2 Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Update .env file with your configuration"
echo "2. Start the server: npm run start:prod"
echo "3. Check status: pm2 status"
echo "4. View logs: pm2 logs"
echo ""
echo "=========================================="
