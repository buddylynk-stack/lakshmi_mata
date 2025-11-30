/**
 * Redis Configuration for Real-Time Features
 * 
 * This module sets up Redis PUB/SUB for scalable real-time communication
 * across multiple server instances. It creates separate Redis clients for:
 * - Publisher: Sends events to channels
 * - Subscriber: Listens to events from channels
 * - Regular client: For caching and data storage
 */

const Redis = require("ioredis");

// Redis connection configuration
const redisConfig = {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
};

// Create Redis clients
const redisPublisher = new Redis(redisConfig);
const redisSubscriber = new Redis(redisConfig);
const redisClient = new Redis(redisConfig);

// Connection event handlers
redisPublisher.on("connect", () => {
    console.log("✅ Redis Publisher connected");
});

redisSubscriber.on("connect", () => {
    console.log("✅ Redis Subscriber connected");
});

redisClient.on("connect", () => {
    console.log("✅ Redis Client connected");
});

redisPublisher.on("error", (err) => {
    console.error("❌ Redis Publisher Error:", err.message);
});

redisSubscriber.on("error", (err) => {
    console.error("❌ Redis Subscriber Error:", err.message);
});

redisClient.on("error", (err) => {
    console.error("❌ Redis Client Error:", err.message);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log("Closing Redis connections...");
    await redisPublisher.quit();
    await redisSubscriber.quit();
    await redisClient.quit();
});

module.exports = {
    redisPublisher,
    redisSubscriber,
    redisClient,
};
