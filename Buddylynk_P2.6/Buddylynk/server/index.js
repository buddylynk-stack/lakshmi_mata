// Load environment variables FIRST before any other imports
const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
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
        
        // Check against allowed origins list
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

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

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
