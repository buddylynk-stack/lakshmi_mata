# EC2 Deployment Guide - Buddylynk Website

## Prerequisites
- EC2 instance running (Ubuntu/Amazon Linux recommended)
- Git installed on EC2 (you mentioned it's already installed ✓)
- Your GitHub repo: https://github.com/buddylynk-stack/lakshmi_mata.git

---

## Step 1: Connect to Your EC2 Instance
```bash
# Use your EC2 instance's public IP
ssh -i your-key.pem ec2-user@your-ec2-ip
# OR for Ubuntu
ssh -i your-key.pem ubuntu@your-ec2-ip
```

---

## Step 2: Install Node.js and npm (if not installed)
```bash
# For Amazon Linux 2
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# OR for Ubuntu
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## Step 3: Clone Your Repository
```bash
# Navigate to where you want your project
cd /home/ec2-user
# OR cd /home/ubuntu

# Clone your repo (HTTPS - no SSH key needed!)
git clone https://github.com/buddylynk-stack/lakshmi_mata.git

# Enter the project
cd lakshmi_mata
```

---

## Step 4: Setup the Server (Backend)
```bash
# Go to server directory
cd Buddylynk/server

# Install dependencies
npm install

# Create/Update .env file with your production settings
nano .env
# Add your MongoDB connection, JWT secrets, etc.

# Install PM2 to keep server running
sudo npm install -g pm2

# Start the server with PM2
pm2 start index.js --name buddylynk-server

# Make PM2 start on system reboot
pm2 startup
pm2 save
```

---

## Step 5: Build the Client (Frontend)
```bash
# Go back to project root
cd /home/ec2-user/lakshmi_mata
# OR cd /home/ubuntu/lakshmi_mata

# Go to client directory
cd Buddylynk/client

# Install dependencies
npm install

# Build for production
npm run build
```

---

## Step 6: Setup Nginx (Web Server)
```bash
# Install Nginx
# For Amazon Linux
sudo amazon-linux-extras install nginx1 -y

# For Ubuntu
sudo apt update
sudo apt install nginx -y

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## Step 7: Configure Nginx
```bash
# Create Nginx config
sudo nano /etc/nginx/conf.d/buddylynk.conf
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # or your EC2 public IP

    # Serve React frontend
    location / {
        root /home/ec2-user/lakshmi_mata/Buddylynk/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to Node.js backend
    location /api {
        proxy_pass http://localhost:5000;  # adjust port if different
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Test Nginx config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## Step 8: Configure EC2 Security Group
In AWS Console:
1. Go to EC2 → Security Groups
2. Select your instance's security group
3. Add Inbound Rules:
   - HTTP (Port 80) - Source: 0.0.0.0/0
   - HTTPS (Port 443) - Source: 0.0.0.0/0 (if using SSL)
   - Custom TCP (Port 5000) - Source: Your IP or VPC only

---

## Step 9: Update Code Later (Git Pull)
```bash
# SSH into EC2
cd /home/ec2-user/lakshmi_mata

# Pull latest changes
git pull origin main

# Update server
cd Buddylynk/server
npm install
pm2 restart buddylynk-server

# Update client
cd ../client
npm install
npm run build

# Restart Nginx
sudo systemctl restart nginx
```

---

## Useful PM2 Commands
```bash
pm2 list                  # See all running processes
pm2 logs buddylynk-server # View server logs
pm2 restart buddylynk-server
pm2 stop buddylynk-server
pm2 delete buddylynk-server
```

---

## Troubleshooting

### Check if server is running:
```bash
pm2 status
curl http://localhost:5000  # test backend
```

### Check Nginx status:
```bash
sudo systemctl status nginx
sudo nginx -t  # test config
```

### View logs:
```bash
pm2 logs
sudo tail -f /var/log/nginx/error.log
```

### Port already in use:
```bash
sudo lsof -i :5000
sudo kill -9 <PID>
```

---

## Optional: Setup SSL with Let's Encrypt
```bash
# Install certbot
sudo yum install certbot python3-certbot-nginx -y  # Amazon Linux
# OR
sudo apt install certbot python3-certbot-nginx -y  # Ubuntu

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

---

## Your Website Should Now Be Live! 🚀
Visit: http://your-ec2-public-ip or http://your-domain.com

---

## Notes:
- Make sure MongoDB is accessible from EC2 (use MongoDB Atlas or install locally)
- Update your .env file with production values
- Consider setting up a domain name instead of using IP
- Enable HTTPS for production (use Let's Encrypt)
- Set up automated backups for your database
