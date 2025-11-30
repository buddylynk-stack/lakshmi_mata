# Server Scripts

## 🔧 S3 Image Fix Scripts

### Quick Fix (Recommended)
```bash
node scripts/fix-s3-images.js
```
**All-in-one solution** that fixes S3 image loading issues permanently. Configures ACLs, permissions, CORS, and tests everything.

### Individual S3 Scripts
- `fix-s3-images.js` - **All-in-one fix** (recommended)
- `enable-bucket-acls.js` - Enable ACLs on S3 bucket
- `setup-s3-complete.js` - Configure bucket permissions and CORS
- `test-s3-upload.js` - Test upload and public access
- `fix-bucket-permissions.js` - Legacy permissions script

📖 **See `../S3_IMAGE_FIX.md` for detailed documentation**

---

## Auto-Installation Scripts for EC2

These scripts automatically install and configure everything needed for production deployment.

### 📦 Available Scripts

#### 1. `install-redis.sh`
Automatically installs Redis on Linux (Ubuntu, CentOS, Amazon Linux)

```bash
npm run setup:redis
```

**What it does:**
- Detects your OS
- Installs Redis
- Configures Redis for production
- Enables auto-start on boot
- Tests the installation

#### 2. `setup-ec2.sh`
Complete EC2 setup - installs everything

```bash
npm run setup:ec2
```

**What it does:**
- Updates system packages
- Installs Node.js (if needed)
- Installs Redis
- Installs PM2
- Installs npm dependencies
- Creates .env file
- Configures PM2 auto-start

---

## Usage on EC2

### First Time Setup

```bash
# 1. SSH into EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# 2. Clone repository
git clone https://github.com/your-repo/buddylynk.git
cd buddylynk/Buddylynk/server

# 3. Run auto-setup
npm install
npm run setup:ec2

# 4. Configure environment
nano .env

# 5. Start server
npm run start:prod
```

### Redis Only

If you only need to install Redis:

```bash
npm run setup:redis
```

---

## Supported Operating Systems

✅ **Ubuntu** (18.04, 20.04, 22.04)  
✅ **Debian** (9, 10, 11)  
✅ **CentOS** (7, 8)  
✅ **RHEL** (7, 8)  
✅ **Amazon Linux** (1, 2)  
✅ **Fedora**  

---

## Manual Installation

If auto-scripts fail, you can install manually:

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### CentOS/RHEL/Amazon Linux
```bash
sudo yum update -y
sudo yum install -y redis
sudo systemctl start redis
sudo systemctl enable redis
```

### Verify
```bash
redis-cli ping
# Should return: PONG
```

---

## Troubleshooting

### Script Permission Denied

```bash
chmod +x scripts/*.sh
```

### Redis Not Starting

```bash
sudo systemctl status redis
sudo systemctl start redis
```

### Check Logs

```bash
sudo tail -f /var/log/redis/redis-server.log
```

---

## Production Configuration

After installation, Redis is configured with:

- **Bind:** localhost only (security)
- **Persistence:** Enabled (RDB + AOF)
- **Max Memory Policy:** allkeys-lru
- **Auto-start:** Enabled on boot

---

## Security Notes

- Redis is bound to localhost only
- No password by default (add one in production)
- Firewall rules should block external Redis access
- Only your Node.js app should access Redis

---

**These scripts make deployment to EC2 super easy!** 🚀
