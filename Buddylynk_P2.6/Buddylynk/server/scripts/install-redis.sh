#!/bin/bash

# Redis Auto-Installation Script for Linux (EC2)
# This script automatically installs and configures Redis

echo "=========================================="
echo "Redis Auto-Installation Script"
echo "=========================================="
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "Cannot detect OS"
    exit 1
fi

echo "Detected OS: $OS"
echo ""

# Check if Redis is already installed
if command -v redis-server &> /dev/null; then
    echo "✅ Redis is already installed"
    redis-server --version
    exit 0
fi

echo "📦 Installing Redis..."
echo ""

# Install Redis based on OS
case $OS in
    ubuntu|debian)
        echo "Installing Redis on Ubuntu/Debian..."
        sudo apt-get update
        sudo apt-get install -y redis-server
        
        # Configure Redis to start on boot
        sudo systemctl enable redis-server
        sudo systemctl start redis-server
        ;;
        
    centos|rhel|fedora|amazon)
        echo "Installing Redis on CentOS/RHEL/Amazon Linux..."
        sudo yum update -y
        sudo yum install -y redis
        
        # Configure Redis to start on boot
        sudo systemctl enable redis
        sudo systemctl start redis
        ;;
        
    *)
        echo "❌ Unsupported OS: $OS"
        echo "Please install Redis manually"
        exit 1
        ;;
esac

# Wait for Redis to start
sleep 2

# Test Redis connection
if redis-cli ping > /dev/null 2>&1; then
    echo ""
    echo "=========================================="
    echo "✅ Redis installed successfully!"
    echo "=========================================="
    redis-server --version
    echo ""
    echo "Redis is running on port 6379"
    echo ""
else
    echo ""
    echo "❌ Redis installation failed"
    echo "Please check the logs and try again"
    exit 1
fi

# Configure Redis for production
echo "🔧 Configuring Redis for production..."

# Backup original config
sudo cp /etc/redis/redis.conf /etc/redis/redis.conf.backup 2>/dev/null || true

# Set Redis to bind to localhost only (security)
sudo sed -i 's/^bind .*/bind 127.0.0.1/' /etc/redis/redis.conf 2>/dev/null || true

# Enable persistence
sudo sed -i 's/^# save/save/' /etc/redis/redis.conf 2>/dev/null || true

# Set max memory policy
echo "maxmemory-policy allkeys-lru" | sudo tee -a /etc/redis/redis.conf > /dev/null 2>&1 || true

# Restart Redis to apply changes
sudo systemctl restart redis-server 2>/dev/null || sudo systemctl restart redis 2>/dev/null || true

echo "✅ Redis configuration complete"
echo ""
echo "=========================================="
echo "Redis Installation Summary"
echo "=========================================="
echo "Status: Running"
echo "Port: 6379"
echo "Host: localhost"
echo "Persistence: Enabled"
echo "Auto-start: Enabled"
echo "=========================================="
