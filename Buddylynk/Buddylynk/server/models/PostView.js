const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "Buddylynk_PostViews";

/**
 * Record a post view
 * Uses composite key: postId (partition) + userId (sort key)
 * This prevents duplicate views and manipulation
 */
const recordView = async (postId, userId, metadata = {}) => {
    try {
        const viewId = `${postId}#${userId}`;
        const timestamp = new Date().toISOString();
        
        const viewRecord = {
            viewId,           // Composite key for uniqueness
            postId,           // Partition key
            userId,           // Sort key
            viewedAt: timestamp,
            firstViewedAt: timestamp,
            viewCount: 1,     // Track how many times user viewed (for analytics)
            lastDuration: metadata.duration || 0,
            totalDuration: metadata.duration || 0,
            deviceType: metadata.deviceType || 'unknown',
            userAgent: metadata.userAgent || 'unknown',
            ipHash: metadata.ipHash || null, // Hashed IP for fraud detection
        };

        // Check if view already exists
        const existingView = await getView(postId, userId);
        
        if (existingView) {
            // Update existing view (user came back to view again)
            const updateCmd = new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    ...existingView,
                    viewedAt: timestamp,
                    viewCount: (existingView.viewCount || 1) + 1,
                    lastDuration: metadata.duration || 0,
                    totalDuration: (existingView.totalDuration || 0) + (metadata.duration || 0),
                }
            });
            
            await docClient.send(updateCmd);
            return { isNewView: false, viewCount: existingView.viewCount + 1 };
        }
        
        // Create new view record
        const cmd = new PutCommand({
            TableName: TABLE_NAME,
            Item: viewRecord,
            ConditionExpression: "attribute_not_exists(viewId)" // Prevent duplicates
        });

        await docClient.send(cmd);
        return { isNewView: true, viewCount: 1 };
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            // View already exists (race condition)
            return { isNewView: false, viewCount: 1 };
        }
        throw error;
    }
};

/**
 * Get a specific view record
 */
const getView = async (postId, userId) => {
    try {
        const viewId = `${postId}#${userId}`;
        
        const cmd = new GetCommand({
            TableName: TABLE_NAME,
            Key: { viewId }
        });

        const result = await docClient.send(cmd);
        return result.Item || null;
    } catch (error) {
        console.error("Error getting view:", error);
        return null;
    }
};

/**
 * Get all views for a post (for analytics)
 */
const getPostViews = async (postId) => {
    try {
        const cmd = new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: "PostIdIndex", // GSI on postId
            KeyConditionExpression: "postId = :postId",
            ExpressionAttributeValues: {
                ":postId": postId
            }
        });

        const result = await docClient.send(cmd);
        return result.Items || [];
    } catch (error) {
        console.error("Error getting post views:", error);
        return [];
    }
};

/**
 * Get view count for a post (unique viewers)
 */
const getPostViewCount = async (postId) => {
    try {
        const views = await getPostViews(postId);
        return {
            uniqueViewers: views.length,
            totalViews: views.reduce((sum, v) => sum + (v.viewCount || 1), 0),
            totalDuration: views.reduce((sum, v) => sum + (v.totalDuration || 0), 0)
        };
    } catch (error) {
        console.error("Error getting view count:", error);
        return { uniqueViewers: 0, totalViews: 0, totalDuration: 0 };
    }
};

/**
 * Get all posts viewed by a user
 */
const getUserViews = async (userId) => {
    try {
        const cmd = new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: "UserIdIndex", // GSI on userId
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: {
                ":userId": userId
            }
        });

        const result = await docClient.send(cmd);
        return result.Items || [];
    } catch (error) {
        console.error("Error getting user views:", error);
        return [];
    }
};

/**
 * Check if user has viewed a post
 */
const hasUserViewedPost = async (postId, userId) => {
    const view = await getView(postId, userId);
    return view !== null;
};

/**
 * Get view analytics for a post
 */
const getViewAnalytics = async (postId) => {
    try {
        const views = await getPostViews(postId);
        
        const analytics = {
            uniqueViewers: views.length,
            totalViews: views.reduce((sum, v) => sum + (v.viewCount || 1), 0),
            totalDuration: views.reduce((sum, v) => sum + (v.totalDuration || 0), 0),
            avgDuration: 0,
            deviceBreakdown: {},
            viewsByDate: {},
            repeatViewers: views.filter(v => v.viewCount > 1).length
        };
        
        if (views.length > 0) {
            analytics.avgDuration = analytics.totalDuration / analytics.totalViews;
            
            // Device breakdown
            views.forEach(v => {
                const device = v.deviceType || 'unknown';
                analytics.deviceBreakdown[device] = (analytics.deviceBreakdown[device] || 0) + 1;
            });
            
            // Views by date
            views.forEach(v => {
                const date = v.firstViewedAt.split('T')[0];
                analytics.viewsByDate[date] = (analytics.viewsByDate[date] || 0) + 1;
            });
        }
        
        return analytics;
    } catch (error) {
        console.error("Error getting view analytics:", error);
        return null;
    }
};

module.exports = {
    recordView,
    getView,
    getPostViews,
    getPostViewCount,
    getUserViews,
    hasUserViewedPost,
    getViewAnalytics
};
