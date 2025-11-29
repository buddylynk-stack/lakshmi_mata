#!/bin/bash

# Clean Reinstall Script for EC2
# This script removes all node_modules and reinstalls everything fresh

echo "🧹 Starting clean reinstall process..."

# Navigate to project root
cd /home/ubuntu/Buddylynk || exit 1

# Stop PM2 processes
echo "⏸️  Stopping PM2 processes..."
sudo pm2 stop all

# Clean server
echo "🗑️  Cleaning server dependencies..."
cd server
sudo rm -rf node_modules
sudo rm -f package-lock.json
echo "✅ Server cleaned"

# Clean client
echo "🗑️  Cleaning client dependencies..."
cd ../client
sudo rm -rf node_modules
sudo rm -rf dist
sudo rm -f package-lock.json
echo "✅ Client cleaned"

# Reinstall server dependencies
echo "📦 Installing server dependencies..."
cd ../server
sudo npm install
if [ $? -ne 0 ]; then
    echo "❌ Server installation failed"
    exit 1
fi
echo "✅ Server dependencies installed"

# Reinstall client dependencies
echo "📦 Installing client dependencies..."
cd ../client
sudo npm install
if [ $? -ne 0 ]; then
    echo "❌ Client installation failed"
    exit 1
fi
echo "✅ Client dependencies installed"

# Build client
echo "🏗️  Building client..."
sudo npm run build
if [ $? -ne 0 ]; then
    echo "❌ Client build failed"
    exit 1
fi
echo "✅ Client built successfully"

# Fix permissions
echo "� Fisxing permissions..."
cd /home/ubuntu/Buddylynk
sudo chown -R ubuntu:ubuntu .

# Restart PM2
echo "🚀 Restarting PM2 processes..."
cd server
sudo pm2 restart all
sudo pm2 save

echo "✨ Clean reinstall complete!"
echo "📊 Check status with: pm2 status"
echo "📝 Check logs with: pm2 logs"
