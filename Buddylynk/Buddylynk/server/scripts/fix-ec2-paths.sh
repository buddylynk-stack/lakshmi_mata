#!/bin/bash

# Script to fix EC2 paths after folder rename from Buddylynk_P2.6 to Buddylynk
# Run this on your EC2 server: bash ~/lakshmi_mata/Buddylynk/Buddylynk/server/scripts/fix-ec2-paths.sh

set -e

echo "🔧 Fixing EC2 paths after folder rename..."

# Navigate to project root
cd ~/lakshmi_mata

# Check if old folder exists and new folder exists
if [ -d "Buddylynk_P2.6" ] && [ -d "Buddylynk" ]; then
    echo "⚠️  Both old and new folders exist. Removing old folder..."
    rm -rf Buddylynk_P2.6
fi

# Update Nginx configuration
echo "📝 Updating Nginx configuration..."

# Backup current nginx config
sudo cp /etc/nginx/sites-available/buddylynk /etc/nginx/sites-available/buddylynk.backup

# Update the nginx config to point to new path
sudo sed -i 's|/home/ubuntu/lakshmi_mata/Buddylynk_P2.6/Buddylynk/client/dist|/home/ubuntu/lakshmi_mata/Buddylynk/Buddylynk/client/dist|g' /etc/nginx/sites-available/buddylynk

# Test nginx configuration
echo "🧪 Testing Nginx configuration..."
sudo nginx -t

# Restart services
echo "🔄 Restarting services..."

# Stop PM2 processes
pm2 stop all || true
pm2 delete all || true

# Install dependencies and build
echo "📦 Installing dependencies..."
cd ~/lakshmi_mata/Buddylynk/Buddylynk/server
npm install --production --legacy-peer-deps

cd ~/lakshmi_mata/Buddylynk/Buddylynk/client
npm install --legacy-peer-deps
npm run build

# Start server with PM2
echo "🚀 Starting server..."
cd ~/lakshmi_mata/Buddylynk/Buddylynk/server
pm2 start index.js --name buddylynk-server
pm2 save

# Restart Nginx
sudo systemctl restart nginx

echo "✅ All done! Checking status..."
pm2 status
sudo systemctl status nginx --no-pager

echo ""
echo "🌐 Your site should now be working at https://buddylynk.com"
echo "📊 Check logs with: pm2 logs buddylynk-server"
