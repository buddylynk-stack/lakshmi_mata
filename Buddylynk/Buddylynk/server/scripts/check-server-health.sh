#!/bin/bash

# Script to check server health and environment on EC2
# This will be run automatically by GitHub Actions

echo "🔍 Checking server health..."

# Check if .env file exists
if [ ! -f ~/lakshmi_mata/Buddylynk/Buddylynk/server/.env ]; then
    echo "❌ ERROR: .env file not found!"
    echo "Creating .env file from environment variables..."
    
    cat > ~/lakshmi_mata/Buddylynk/Buddylynk/server/.env << EOF
# AWS Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}

# S3 Bucket Name
S3_BUCKET_NAME=${S3_BUCKET_NAME:-buddylynk-media-bucket-2024}

# Google OAuth Configuration
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}

# Server Configuration
PORT=${PORT:-5000}
JWT_SECRET=${JWT_SECRET}
EOF
    
    echo "✅ .env file created"
else
    echo "✅ .env file exists"
fi

# Check if PM2 is running
if pm2 list | grep -q "buddylynk-server"; then
    echo "✅ PM2 process is running"
    pm2 logs buddylynk-server --lines 20 --nostream
else
    echo "❌ PM2 process not found"
fi

# Check if port 5000 is listening
if netstat -tuln | grep -q ":5000"; then
    echo "✅ Server is listening on port 5000"
else
    echo "❌ Server is NOT listening on port 5000"
fi

# Check Redis status
if systemctl is-active --quiet redis-server; then
    echo "✅ Redis is running"
    redis-cli ping > /dev/null 2>&1 && echo "✅ Redis is responding to PING" || echo "❌ Redis not responding"
else
    echo "❌ Redis is not running"
fi

# Check Nginx status
if sudo systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running"
else
    echo "❌ Nginx is not running"
fi

# Test API endpoint
echo "🧪 Testing API endpoint..."
curl -s http://localhost:5000/api/posts | head -c 100
echo ""

echo "✅ Health check complete"
