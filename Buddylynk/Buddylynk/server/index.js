// Load environment variables FIRST before any other imports
const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const compression = require("compression");
const socketService = require("./services/socketService");
const authRoutes = require("./routes/authRoutes");
const postRoutes = require("./routes/postRoutes");
const groupRoutes = require("./routes/groupRoutes");
const searchRoutes = require("./routes/searchRoutes");
const userRoutes = require("./routes/userRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const messageRoutes = require("./routes/messageRoutes");

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://buddylynk.com",
    "http://www.buddylynk.com",
    "https://buddylynk.com",
    "https://www.buddylynk.com",
    "http://api.buddylynk.com",
    "https://api.buddylynk.com",
    "http://app.buddylynk.com",
    "https://app.buddylynk.com"
];

// Initialize Socket.IO with production-grade configuration
const io = new Server(server, {
    cors: {
        origin: function (origin, callback) {
            // Allow requests with no origin
            if (!origin) return callback(null, true);
            
            // Allow all localhost and 127.0.0.1 origins
            if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
                return callback(null, true);
            }
            
            // Check against allowed origins list
            if (allowedOrigins.indexOf(origin) !== -1) {
                return callback(null, true);
            }
            
            callback(null, false);
        },
        methods: ["GET", "POST"],
        credentials: true
    },
    // Production optimizations
    pingTimeout: 60000, // 60 seconds
    pingInterval: 25000, // 25 seconds
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e8, // 100 MB
    transports: ['websocket', 'polling'], // Prefer WebSocket
    allowUpgrades: true,
    perMessageDeflate: {
        threshold: 1024 // Compress messages larger than 1KB
    },
    httpCompression: {
        threshold: 1024
    }
});

const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Allow all localhost and 127.0.0.1 origins
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
            return callback(null, true);
        }
        
        // Allow all buddylynk.com origins (including Cloudflare)
        if (origin.includes('buddylynk.com')) {
            return callback(null, true);
        }
        
        // Check against allowed origins list
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            // Allow all origins in production for now
            callback(null, true);
        }
    },
    credentials: true
}));
// Enable gzip compression for faster responses
app.use(compression({
    level: 6, // Balanced compression
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    }
}));

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Cache headers for API responses
app.use('/api', (req, res, next) => {
    // Cache GET requests for 30 seconds
    if (req.method === 'GET') {
        res.set('Cache-Control', 'public, max-age=30');
    }
    next();
});

// Serve uploads folder statically
app.use("/uploads", express.static("uploads"));

// Initialize Socket Service with Redis PUB/SUB
socketService.initialize(io);

// Make socketService accessible to routes
app.set("socketService", socketService);
app.set("io", io); // Keep for backward compatibility

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/upload", require("./routes/uploadRoutes"));

app.get("/", (req, res) => {
    res.send("Buddylynk API is running");
});

server.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    
    // Auto-setup S3 public access on server start
    try {
        const { S3Client, PutBucketPolicyCommand, PutPublicAccessBlockCommand, GetBucketPolicyCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
        const BUCKET_NAME = process.env.S3_BUCKET_NAME;
        
        if (BUCKET_NAME && process.env.AWS_ACCESS_KEY_ID) {
            const s3Client = new S3Client({
                region: process.env.AWS_REGION || 'us-east-1',
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
                }
            });
            
            // Check if bucket exists
            await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
            
            // Check if public access is already set
            let needsSetup = false;
            try {
                const policy = await s3Client.send(new GetBucketPolicyCommand({ Bucket: BUCKET_NAME }));
                const policyJson = JSON.parse(policy.Policy);
                const hasPublicRead = policyJson.Statement?.some(s => 
                    s.Effect === 'Allow' && s.Principal === '*' && s.Action === 's3:GetObject'
                );
                needsSetup = !hasPublicRead;
            } catch (e) {
                needsSetup = true; // No policy exists
            }
            
            if (needsSetup) {
                console.log('🔧 Setting up S3 public access...');
                
                // Disable block public access
                await s3Client.send(new PutPublicAccessBlockCommand({
                    Bucket: BUCKET_NAME,
                    PublicAccessBlockConfiguration: {
                        BlockPublicAcls: false,
                        IgnorePublicAcls: false,
                        BlockPublicPolicy: false,
                        RestrictPublicBuckets: false
                    }
                }));
                
                // Set bucket policy
                const bucketPolicy = {
                    Version: '2012-10-17',
                    Statement: [{
                        Sid: 'PublicReadGetObject',
                        Effect: 'Allow',
                        Principal: '*',
                        Action: 's3:GetObject',
                        Resource: `arn:aws:s3:::${BUCKET_NAME}/*`
                    }]
                };
                
                await s3Client.send(new PutBucketPolicyCommand({
                    Bucket: BUCKET_NAME,
                    Policy: JSON.stringify(bucketPolicy)
                }));
                
                console.log('✅ S3 public access configured successfully!');
            } else {
                console.log('✅ S3 public access already configured');
            }
        }
    } catch (error) {
        console.warn('⚠️ S3 setup skipped:', error.message);
    }
});
