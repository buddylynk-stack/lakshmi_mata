const { PutCommand, ScanCommand, GetCommand, UpdateCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const { BUCKET_NAME } = require("../config/s3");

const TABLE_NAME = "Buddylynk_Posts";

const createPost = async (post) => {
    const newPost = {
        postId: uuidv4(),
        createdAt: new Date().toISOString(),
        likes: 0,
        likedBy: [],
        comments: [],
        shares: 0,
        views: 0,
        savedBy: [],
        media: [], // Array of media objects
        ...post,
    };

    // Initialize poll structure if poll options are provided
    if (post.pollOptions && post.pollOptions.length > 0) {
        newPost.poll = {
            options: post.pollOptions.map((option, index) => ({
                id: index,
                text: option,
                votes: 0,
                voters: []
            }))
        };
        delete newPost.pollOptions; // Remove pollOptions from root
    }

    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newPost,
    }));
    return newPost;
};

const getAllPosts = async () => {
    const command = new ScanCommand({
        TableName: TABLE_NAME,
    });
    const response = await docClient.send(command);

    // Filter out posts without required fields and sort by createdAt desc
    const validPosts = response.Items.filter(post =>
        post.createdAt && post.username && post.userId
    );

    return validPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const getPostById = async (postId) => {
    const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: { postId },
    });
    const response = await docClient.send(command);
    return response.Item;
};

const votePoll = async (postId, optionId, userId) => {
    // Get the post first
    const getCmd = new GetCommand({
        TableName: TABLE_NAME,
        Key: { postId },
    });
    const result = await docClient.send(getCmd);
    const post = result.Item;

    if (!post || !post.poll) {
        throw new Error("Post or poll not found");
    }

    // Check if user already voted
    const alreadyVoted = post.poll.options.some(opt => opt.voters.includes(userId));
    if (alreadyVoted) {
        throw new Error("User already voted");
    }

    // Update the specific option
    post.poll.options[optionId].votes += 1;
    post.poll.options[optionId].voters.push(userId);

    // Save back
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: post,
    }));

    return post;
};

const deletePost = async (postId) => {
    console.log(`\n🗑️  Starting deletion of post: ${postId}`);
    
    // First, get the post to retrieve media URLs
    const getCmd = new GetCommand({
        TableName: TABLE_NAME,
        Key: { postId },
    });
    const result = await docClient.send(getCmd);
    const post = result.Item;
    
    if (!post) {
        console.log(`❌ Post ${postId} not found`);
        throw new Error("Post not found");
    }
    
    console.log(`📝 Post found: ${post.content?.substring(0, 50) || '(no content)'}`);

    // Delete media files from S3 if they exist
    if (post && post.media && Array.isArray(post.media) && post.media.length > 0) {
        const { s3Client } = require("../config/s3");
        const { DeleteObjectCommand } = require("@aws-sdk/client-s3");

        console.log(`🗑️  Deleting ${post.media.length} media file(s) from S3...`);

        for (const mediaItem of post.media) {
            if (mediaItem.url && mediaItem.url.includes('s3.amazonaws.com')) {
                try {
                    // Extract the key from the S3 URL
                    const key = mediaItem.url.split('.com/')[1];
                    if (key) {
                        await s3Client.send(new DeleteObjectCommand({
                            Bucket: BUCKET_NAME,
                            Key: key
                        }));
                        console.log(`   ✅ Deleted S3 file: ${key}`);
                    }
                } catch (error) {
                    console.error(`   ❌ Failed to delete S3 file:`, error.message);
                }
            }
        }
    }

    // Also handle old posts with single mediaUrl
    if (post && post.mediaUrl && post.mediaUrl.includes('s3.amazonaws.com')) {
        const { s3Client } = require("../config/s3");
        const { DeleteObjectCommand } = require("@aws-sdk/client-s3");

        try {
            const key = post.mediaUrl.split('.com/')[1];
            if (key) {
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: key
                }));
                console.log(`   ✅ Deleted S3 file: ${key}`);
            }
        } catch (error) {
            console.error(`   ❌ Failed to delete S3 file:`, error.message);
        }
    }

    // Delete view records from PostViews table
    try {
        const { QueryCommand, BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");
        
        // Get all view records for this post
        const queryCmd = new QueryCommand({
            TableName: "Buddylynk_PostViews",
            IndexName: "PostIdIndex",
            KeyConditionExpression: "postId = :postId",
            ExpressionAttributeValues: {
                ":postId": postId
            }
        });
        
        const viewsResult = await docClient.send(queryCmd);
        const views = viewsResult.Items || [];
        
        if (views.length > 0) {
            // Batch delete view records (max 25 at a time)
            const batches = [];
            for (let i = 0; i < views.length; i += 25) {
                batches.push(views.slice(i, i + 25));
            }
            
            for (const batch of batches) {
                const deleteRequests = batch.map(view => ({
                    DeleteRequest: {
                        Key: { viewId: view.viewId }
                    }
                }));
                
                await docClient.send(new BatchWriteCommand({
                    RequestItems: {
                        "Buddylynk_PostViews": deleteRequests
                    }
                }));
            }
            
            console.log(`✅ Deleted ${views.length} view records from PostViews table`);
        }
    } catch (error) {
        console.error("❌ Failed to delete view records:", error);
    }

    // Delete the post from DynamoDB
    await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { postId },
    }));
    
    console.log(`✅ Post ${postId} deleted from database`);
    console.log(`🎉 Post ${postId} deleted completely!\n`);
};

const likePost = async (postId, userId) => {
    const getCmd = new GetCommand({
        TableName: TABLE_NAME,
        Key: { postId },
    });
    const result = await docClient.send(getCmd);
    const post = result.Item;

    if (!post) throw new Error("Post not found");

    const likedBy = post.likedBy || [];
    const hasLiked = likedBy.includes(userId);

    if (hasLiked) {
        // Unlike
        post.likedBy = likedBy.filter(id => id !== userId);
        post.likes = Math.max(0, (post.likes || 0) - 1);
    } else {
        // Like
        post.likedBy = [...likedBy, userId];
        post.likes = (post.likes || 0) + 1;
    }

    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: post,
    }));

    return post;
};

const addComment = async (postId, userId, username, userAvatar, content) => {
    const getCmd = new GetCommand({
        TableName: TABLE_NAME,
        Key: { postId },
    });
    const result = await docClient.send(getCmd);
    const post = result.Item;

    if (!post) throw new Error("Post not found");

    const newComment = {
        commentId: uuidv4(),
        userId,
        username,
        userAvatar,
        content,
        createdAt: new Date().toISOString(),
    };

    // Add new comment at the beginning (newest first)
    post.comments = [newComment, ...(post.comments || [])];

    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: post,
    }));

    return post;
};

const editComment = async (postId, commentId, userId, content) => {
    const getCmd = new GetCommand({
        TableName: TABLE_NAME,
        Key: { postId },
    });
    const result = await docClient.send(getCmd);
    const post = result.Item;

    if (!post) throw new Error("Post not found");

    const commentIndex = post.comments.findIndex(c => c.commentId === commentId);
    if (commentIndex === -1) throw new Error("Comment not found");
    
    // Check if user owns the comment
    if (post.comments[commentIndex].userId !== userId) {
        throw new Error("Not authorized to edit this comment");
    }

    post.comments[commentIndex].content = content;
    post.comments[commentIndex].editedAt = new Date().toISOString();

    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: post,
    }));

    return post;
};

const deleteComment = async (postId, commentId, userId) => {
    const getCmd = new GetCommand({
        TableName: TABLE_NAME,
        Key: { postId },
    });
    const result = await docClient.send(getCmd);
    const post = result.Item;

    if (!post) throw new Error("Post not found");

    const comment = post.comments.find(c => c.commentId === commentId);
    if (!comment) throw new Error("Comment not found");
    
    // Check if user owns the comment or the post
    if (comment.userId !== userId && post.userId !== userId) {
        throw new Error("Not authorized to delete this comment");
    }

    post.comments = post.comments.filter(c => c.commentId !== commentId);

    // If this was the pinned comment, unpin it
    if (post.pinnedCommentId === commentId) {
        delete post.pinnedCommentId;
    }

    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: post,
    }));

    return post;
};

const pinComment = async (postId, commentId, userId) => {
    const getCmd = new GetCommand({
        TableName: TABLE_NAME,
        Key: { postId },
    });
    const result = await docClient.send(getCmd);
    const post = result.Item;

    if (!post) throw new Error("Post not found");
    
    // Check if user owns the post
    if (post.userId !== userId) {
        throw new Error("Only post owner can pin comments");
    }

    const comment = post.comments.find(c => c.commentId === commentId);
    if (!comment) throw new Error("Comment not found");

    // Toggle pin
    if (post.pinnedCommentId === commentId) {
        delete post.pinnedCommentId;
    } else {
        post.pinnedCommentId = commentId;
    }

    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: post,
    }));

    return post;
};

const sharePost = async (postId) => {
    // Use atomic increment
    const updateCmd = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { postId },
        UpdateExpression: "ADD shares :increment",
        ExpressionAttributeValues: {
            ":increment": 1,
        },
        ReturnValues: "ALL_NEW",
    });

    const result = await docClient.send(updateCmd);

    if (!result.Attributes) throw new Error("Post not found");

    return result.Attributes;
};

const savePost = async (postId, userId) => {
    const getCmd = new GetCommand({
        TableName: TABLE_NAME,
        Key: { postId },
    });
    const result = await docClient.send(getCmd);
    const post = result.Item;

    if (!post) throw new Error("Post not found");

    const savedBy = post.savedBy || [];
    const hasSaved = savedBy.includes(userId);

    if (hasSaved) {
        // Unsave
        post.savedBy = savedBy.filter(id => id !== userId);
    } else {
        // Save
        post.savedBy = [...savedBy, userId];
    }

    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: post,
    }));

    return post;
};

const incrementViews = async (postId, userId = null) => {
    // Get the post first to check if user already viewed it
    const getCmd = new GetCommand({
        TableName: TABLE_NAME,
        Key: { postId },
    });
    const result = await docClient.send(getCmd);
    const post = result.Item;

    if (!post) throw new Error("Post not found");

    // Initialize viewedBy array if it doesn't exist
    const viewedBy = post.viewedBy || [];
    
    // Check if this user already viewed the post
    if (userId && viewedBy.includes(userId)) {
        // User already viewed, don't increment
        return post;
    }

    // Add user to viewedBy array and increment views
    if (userId) {
        viewedBy.push(userId);
    }

    // Update post with new view count and viewedBy list
    const updateCmd = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { postId },
        UpdateExpression: "ADD #views :increment SET #viewedBy = :viewedBy, #lastViewedAt = :timestamp",
        ExpressionAttributeNames: {
            "#views": "views",
            "#viewedBy": "viewedBy",
            "#lastViewedAt": "lastViewedAt",
        },
        ExpressionAttributeValues: {
            ":increment": 1,
            ":viewedBy": viewedBy,
            ":timestamp": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
    });

    const updateResult = await docClient.send(updateCmd);
    return updateResult.Attributes;
};

const editPost = async (postId, content, media = null) => {
    const getCmd = new GetCommand({
        TableName: TABLE_NAME,
        Key: { postId },
    });
    const result = await docClient.send(getCmd);
    const post = result.Item;

    if (!post) throw new Error("Post not found");

    post.content = content;
    post.editedAt = new Date().toISOString();

    // Update media if provided
    if (media !== null) {
        post.media = media;
    }

    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: post,
    }));

    return post;
};

module.exports = { createPost, getAllPosts, getPostById, votePoll, deletePost, likePost, addComment, editComment, deleteComment, pinComment, sharePost, savePost, incrementViews, editPost };
