const axios = require('axios');

const RECOMMENDATION_API_URL = process.env.RECOMMENDATION_API_URL || 'http://35.227.39.141:8001/recommend';

// ============== PRODUCTION CONFIG ==============
const CONFIG = {
    // Caching
    ML_CACHE_TTL: 3 * 60 * 1000,        // 3 minutes for ML scores
    SCORE_CACHE_TTL: 5 * 60 * 1000,     // 5 minutes for final scores
    USER_PROFILE_TTL: 10 * 60 * 1000,   // 10 minutes for user profiles
    
    // Performance
    ML_TIMEOUT: 1500,                    // 1.5 seconds max for ML
    ML_BATCH_SIZE: 20,                   // Process 20 posts at once
    MAX_POSTS_TO_SCORE: 150,             // Score up to 150 posts
    PARALLEL_BATCHES: 3,                 // Process 3 batches in parallel
    
    // Scoring weights (adaptive based on user activity)
    WEIGHTS: {
        NEW_USER: {                      // < 10 interactions
            ML_SCORE: 0.20,
            RECENCY: 0.35,
            ENGAGEMENT: 0.30,
            USER_AFFINITY: 0.10,
            DIVERSITY: 0.05
        },
        ACTIVE_USER: {                   // 10-100 interactions
            ML_SCORE: 0.40,
            RECENCY: 0.25,
            ENGAGEMENT: 0.20,
            USER_AFFINITY: 0.10,
            DIVERSITY: 0.05
        },
        POWER_USER: {                    // 100+ interactions
            ML_SCORE: 0.50,
            RECENCY: 0.15,
            ENGAGEMENT: 0.15,
            USER_AFFINITY: 0.15,
            DIVERSITY: 0.05
        }
    },
    
    // Algorithm tuning
    RECENCY_HALF_LIFE_HOURS: 24,
    ENGAGEMENT_BOOST_THRESHOLD: 10,      // Posts with 10+ likes get boost
    DIVERSITY_INJECTION_RATE: 0.15,      // 15% of feed is diverse content
    COLD_START_POSTS: 30,                // Show 30 posts for new users
    
    // Circuit breaker
    CIRCUIT_TIMEOUT: 60 * 1000,
    CIRCUIT_FAILURE_THRESHOLD: 3,
    
    // Content freshness
    MAX_POST_AGE_HOURS: 72,              // Don't show posts older than 3 days
    FRESH_CONTENT_BOOST: 1.2             // 20% boost for posts < 6 hours old
};

// Caches
const mlScoreCache = new Map();
const userAffinityCache = new Map();
const userProfileCache = new Map();
const diversityCache = new Map();

// Circuit breaker
let circuitOpen = false;
let circuitOpenTime = 0;
let circuitFailureCount = 0;

const uuidToInt = (uuid) => {
    if (!uuid) return 0;
    const hex = uuid.replace(/-/g, '').substring(0, 8);
    return parseInt(hex, 16);
};

// ============== USER PROFILING ==============
const getUserProfile = (userId) => {
    const cached = userProfileCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CONFIG.USER_PROFILE_TTL) {
        return cached.profile;
    }
    
    const interactions = userAffinityCache.get(userId) || {};
    const totalInteractions = Object.values(interactions).reduce((sum, author) => {
        return sum + (author.likes || 0) + (author.comments || 0) + (author.views || 0);
    }, 0);
    
    let userType = 'NEW_USER';
    if (totalInteractions > 100) userType = 'POWER_USER';
    else if (totalInteractions > 10) userType = 'ACTIVE_USER';
    
    const profile = {
        userType,
        totalInteractions,
        weights: CONFIG.WEIGHTS[userType],
        favoriteAuthors: Object.entries(interactions)
            .sort((a, b) => {
                const scoreA = (a[1].likes || 0) * 3 + (a[1].comments || 0) * 5;
                const scoreB = (b[1].likes || 0) * 3 + (b[1].comments || 0) * 5;
                return scoreB - scoreA;
            })
            .slice(0, 10)
            .map(([authorId]) => authorId)
    };
    
    userProfileCache.set(userId, { profile, timestamp: Date.now() });
    return profile;
};

// ============== SCORING FUNCTIONS ==============
const getRecencyScore = (createdAt) => {
    if (!createdAt) return 0.5;
    const ageHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    
    // Don't show very old posts
    if (ageHours > CONFIG.MAX_POST_AGE_HOURS) return 0;
    
    // Boost fresh content (< 6 hours)
    const baseScore = Math.exp(-ageHours / CONFIG.RECENCY_HALF_LIFE_HOURS);
    if (ageHours < 6) {
        return Math.min(1, baseScore * CONFIG.FRESH_CONTENT_BOOST);
    }
    
    return baseScore;
};

const getEngagementScore = (post) => {
    const likes = post.likes || post.likedBy?.length || 0;
    const comments = post.comments?.length || 0;
    const shares = post.shares || 0;
    const views = Math.max(post.views || 1, 1);
    
    // Calculate engagement rate with weighted actions
    const engagementRate = (likes * 3 + comments * 5 + shares * 4) / views;
    
    // Boost highly engaged posts
    let score = 1 / (1 + Math.exp(-engagementRate * 10));
    if (likes >= CONFIG.ENGAGEMENT_BOOST_THRESHOLD) {
        score = Math.min(1, score * 1.3); // 30% boost for popular posts
    }
    
    return score;
};

const getUserAffinityScore = (userId, postAuthorId, userInteractions) => {
    if (!userInteractions || userId === postAuthorId) return 0.5;
    
    const authorInteractions = userInteractions[postAuthorId] || { likes: 0, comments: 0, views: 0, shares: 0 };
    
    // Weighted interaction score
    const totalInteractions = 
        (authorInteractions.likes || 0) * 3 + 
        (authorInteractions.comments || 0) * 5 + 
        (authorInteractions.shares || 0) * 4 +
        (authorInteractions.views || 0) * 0.5;
    
    // Normalize to 0-1 range with diminishing returns
    return Math.min(1, Math.log(totalInteractions + 1) / Math.log(50));
};

const getDiversityScore = (post, userId, seenAuthors) => {
    // Encourage diversity - boost posts from authors user hasn't seen much
    const authorId = post.userId;
    const timesSeen = seenAuthors.get(authorId) || 0;
    
    // Diminishing returns for same author
    return Math.exp(-timesSeen / 3);
};

const getMLScore = async (userIdInt, postIdInt) => {
    const cacheKey = `${userIdInt}-${postIdInt}`;
    const cached = mlScoreCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CONFIG.ML_CACHE_TTL) {
        return cached.score;
    }
    try {
        const response = await axios.post(RECOMMENDATION_API_URL, {
            user_id: userIdInt,
            post_id: postIdInt
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: CONFIG.ML_TIMEOUT
        });
        const score = response.data?.score || 0.5;
        mlScoreCache.set(cacheKey, { score, timestamp: Date.now() });
        return score;
    } catch {
        return 0.5;
    }
};

const batchMLScore = async (userIdInt, postIds) => {
    const scores = new Map();
    const uncached = [];
    for (const postId of postIds) {
        const postIdInt = uuidToInt(postId);
        const cacheKey = `${userIdInt}-${postIdInt}`;
        const cached = mlScoreCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CONFIG.ML_CACHE_TTL) {
            scores.set(postId, cached.score);
        } else {
            uncached.push(postId);
        }
    }
    if (uncached.length > 0 && !circuitOpen) {
        const batches = [];
        for (let i = 0; i < uncached.length; i += CONFIG.ML_BATCH_SIZE) {
            batches.push(uncached.slice(i, i + CONFIG.ML_BATCH_SIZE));
        }
        for (const batch of batches) {
            const results = await Promise.all(
                batch.map(async (postId) => {
                    const postIdInt = uuidToInt(postId);
                    const score = await getMLScore(userIdInt, postIdInt);
                    return { postId, score };
                })
            );
            results.forEach(({ postId, score }) => {
                scores.set(postId, score);
            });
        }
    }
    for (const postId of postIds) {
        if (!scores.has(postId)) {
            scores.set(postId, 0.5);
        }
    }
    return scores;
};


const getRecommendations = async (userId, currentPostId = null, posts = [], userInteractions = {}) => {
    const startTime = Date.now();
    try {
        // Circuit breaker check
        if (circuitOpen && Date.now() - circuitOpenTime < CONFIG.CIRCUIT_TIMEOUT) {
            console.log('⚡ Circuit open, using local scoring only');
            return localOnlyScoring(posts, userInteractions, userId);
        }
        if (circuitOpen) {
            circuitOpen = false;
            circuitFailureCount = 0;
            console.log('🔄 Circuit breaker reset');
        }
        
        if (!posts || posts.length === 0) {
            return { recommendations: [], source: 'no-posts', scores: {}, userProfile: null };
        }
        
        // Get user profile for adaptive weights
        const userProfile = getUserProfile(userId);
        const weights = userProfile.weights;
        
        console.log(`🎯 Scoring ${posts.length} posts for ${userProfile.userType} (${userProfile.totalInteractions} interactions)`);
        
        // Filter out very old posts
        const freshPosts = posts.filter(post => {
            const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
            return ageHours <= CONFIG.MAX_POST_AGE_HOURS;
        });
        
        if (freshPosts.length === 0) {
            return { recommendations: [], source: 'no-fresh-posts', scores: {}, userProfile };
        }
        
        // Get ML scores in batches
        const userIdInt = uuidToInt(userId);
        const postIds = freshPosts.map(p => p.postId).slice(0, CONFIG.MAX_POSTS_TO_SCORE);
        const mlScores = await batchMLScore(userIdInt, postIds);
        
        // Track seen authors for diversity
        const seenAuthors = new Map();
        
        // Score all posts
        const scoredPosts = freshPosts.map(post => {
            const mlScore = mlScores.get(post.postId) || 0.5;
            const recencyScore = getRecencyScore(post.createdAt);
            const engagementScore = getEngagementScore(post);
            const affinityScore = getUserAffinityScore(userId, post.userId, userInteractions);
            const diversityScore = getDiversityScore(post, userId, seenAuthors);
            
            // Update seen authors
            seenAuthors.set(post.userId, (seenAuthors.get(post.userId) || 0) + 1);
            
            // Calculate final score with adaptive weights
            const finalScore = 
                weights.ML_SCORE * mlScore +
                weights.RECENCY * recencyScore +
                weights.ENGAGEMENT * engagementScore +
                weights.USER_AFFINITY * affinityScore +
                weights.DIVERSITY * diversityScore;
            
            return {
                postId: post.postId,
                authorId: post.userId,
                finalScore,
                breakdown: { mlScore, recencyScore, engagementScore, affinityScore, diversityScore }
            };
        });
        
        // Sort by score
        scoredPosts.sort((a, b) => b.finalScore - a.finalScore);
        
        // Inject diversity - ensure variety in top results
        const diversifiedPosts = injectDiversity(scoredPosts, CONFIG.DIVERSITY_INJECTION_RATE);
        
        const elapsed = Date.now() - startTime;
        console.log(`✅ Scored ${diversifiedPosts.length} posts in ${elapsed}ms (${userProfile.userType})`);
        console.log(`   Top score: ${diversifiedPosts[0]?.finalScore.toFixed(3)}, Diversity: ${(CONFIG.DIVERSITY_INJECTION_RATE * 100).toFixed(0)}%`);
        
        // Reset circuit failure count on success
        circuitFailureCount = 0;
        
        return {
            recommendations: diversifiedPosts.map(p => p.postId),
            source: 'ml-hybrid-adaptive',
            scores: Object.fromEntries(diversifiedPosts.map(p => [p.postId, p.breakdown])),
            userProfile: {
                type: userProfile.userType,
                interactions: userProfile.totalInteractions
            }
        };
    } catch (error) {
        console.error('❌ Recommendation error:', error.message);
        
        // Circuit breaker logic
        circuitFailureCount++;
        if (circuitFailureCount >= CONFIG.CIRCUIT_FAILURE_THRESHOLD) {
            circuitOpen = true;
            circuitOpenTime = Date.now();
            console.log(`🔴 Circuit breaker opened (${circuitFailureCount} failures)`);
        }
        
        return localOnlyScoring(posts, userInteractions, userId);
    }
};

// Inject diversity to prevent filter bubbles
const injectDiversity = (scoredPosts, diversityRate) => {
    if (scoredPosts.length <= 10) return scoredPosts;
    
    const numDiverse = Math.floor(scoredPosts.length * diversityRate);
    const topPosts = scoredPosts.slice(0, scoredPosts.length - numDiverse);
    const diversePosts = scoredPosts.slice(scoredPosts.length - numDiverse);
    
    // Shuffle diverse posts
    for (let i = diversePosts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [diversePosts[i], diversePosts[j]] = [diversePosts[j], diversePosts[i]];
    }
    
    // Interleave diverse posts into top posts
    const result = [];
    const interval = Math.floor(topPosts.length / (diversePosts.length + 1));
    
    let topIndex = 0;
    let diverseIndex = 0;
    
    while (topIndex < topPosts.length || diverseIndex < diversePosts.length) {
        // Add top posts
        for (let i = 0; i < interval && topIndex < topPosts.length; i++) {
            result.push(topPosts[topIndex++]);
        }
        // Add one diverse post
        if (diverseIndex < diversePosts.length) {
            result.push(diversePosts[diverseIndex++]);
        }
    }
    
    return result;
};

const localOnlyScoring = (posts, userInteractions, userId) => {
    console.log('🔧 Using local-only scoring (ML unavailable)');
    
    // Get user profile for adaptive weights
    const userProfile = getUserProfile(userId);
    
    // Filter fresh posts
    const freshPosts = posts.filter(post => {
        const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
        return ageHours <= CONFIG.MAX_POST_AGE_HOURS;
    });
    
    const seenAuthors = new Map();
    
    const scoredPosts = freshPosts.map(post => {
        const recencyScore = getRecencyScore(post.createdAt);
        const engagementScore = getEngagementScore(post);
        const affinityScore = getUserAffinityScore(userId, post.userId, userInteractions);
        const diversityScore = getDiversityScore(post, userId, seenAuthors);
        
        seenAuthors.set(post.userId, (seenAuthors.get(post.userId) || 0) + 1);
        
        // Use adaptive weights but without ML score
        const finalScore = 
            0.40 * recencyScore + 
            0.35 * engagementScore + 
            0.20 * affinityScore +
            0.05 * diversityScore;
        
        return { 
            postId: post.postId, 
            authorId: post.userId,
            finalScore,
            breakdown: { recencyScore, engagementScore, affinityScore, diversityScore }
        };
    });
    
    scoredPosts.sort((a, b) => b.finalScore - a.finalScore);
    
    // Apply diversity
    const diversifiedPosts = injectDiversity(scoredPosts, CONFIG.DIVERSITY_INJECTION_RATE);
    
    return {
        recommendations: diversifiedPosts.map(p => p.postId),
        source: 'local-fallback-adaptive',
        scores: Object.fromEntries(diversifiedPosts.map(p => [p.postId, p.breakdown])),
        userProfile: {
            type: userProfile.userType,
            interactions: userProfile.totalInteractions
        }
    };
};

const trackInteraction = async (userId, postId, action, postAuthorId = null, duration = 0) => {
    try {
        if (postAuthorId && postAuthorId !== userId) {
            if (!userAffinityCache.has(userId)) {
                userAffinityCache.set(userId, {});
            }
            const affinity = userAffinityCache.get(userId);
            if (!affinity[postAuthorId]) {
                affinity[postAuthorId] = { likes: 0, comments: 0, views: 0, shares: 0 };
            }
            switch (action) {
                case 'like': affinity[postAuthorId].likes++; break;
                case 'comment': affinity[postAuthorId].comments++; break;
                case 'view': affinity[postAuthorId].views++; break;
                case 'share': affinity[postAuthorId].shares++; break;
                case 'save': affinity[postAuthorId].likes += 2; break;
            }
        }
        if (!circuitOpen) {
            axios.post(`${RECOMMENDATION_API_URL.replace('/recommend', '/track')}`, {
                user_id: uuidToInt(userId),
                post_id: uuidToInt(postId),
                action,
                duration,
                timestamp: Date.now()
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 1000
            }).catch(() => {});
        }
    } catch (error) {
        // Silent fail
    }
};

const getUserInteractions = (userId) => {
    return userAffinityCache.get(userId) || {};
};

const clearUserCache = (userId) => {
    const userIdInt = uuidToInt(userId);
    for (const key of mlScoreCache.keys()) {
        if (key.startsWith(`${userIdInt}-`)) {
            mlScoreCache.delete(key);
        }
    }
    console.log(`🧹 Cleared cache for user ${userId.substring(0, 8)}`);
};

// Cache cleanup - run periodically
const cleanupCaches = () => {
    const now = Date.now();
    let cleaned = 0;
    
    // Clean ML score cache
    for (const [key, value] of mlScoreCache.entries()) {
        if (now - value.timestamp > CONFIG.ML_CACHE_TTL) {
            mlScoreCache.delete(key);
            cleaned++;
        }
    }
    
    // Clean user profile cache
    for (const [key, value] of userProfileCache.entries()) {
        if (now - value.timestamp > CONFIG.USER_PROFILE_TTL) {
            userProfileCache.delete(key);
            cleaned++;
        }
    }
    
    if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
    }
};

// Run cleanup every 5 minutes
setInterval(cleanupCaches, 5 * 60 * 1000);

const healthCheck = async () => {
    try {
        const start = Date.now();
        await axios.post(RECOMMENDATION_API_URL, { user_id: 1, post_id: 1 }, { timeout: 2000 });
        return { 
            healthy: true, 
            latency: Date.now() - start, 
            circuitOpen,
            circuitFailures: circuitFailureCount,
            cacheSize: { 
                ml: mlScoreCache.size, 
                affinity: userAffinityCache.size,
                profiles: userProfileCache.size
            },
            config: {
                mlTimeout: CONFIG.ML_TIMEOUT,
                batchSize: CONFIG.ML_BATCH_SIZE,
                maxPosts: CONFIG.MAX_POSTS_TO_SCORE
            }
        };
    } catch (error) {
        return { 
            healthy: false, 
            circuitOpen,
            circuitFailures: circuitFailureCount,
            error: error.message,
            cacheSize: { 
                ml: mlScoreCache.size, 
                affinity: userAffinityCache.size,
                profiles: userProfileCache.size
            }
        };
    }
};

const getStats = () => {
    return {
        caches: {
            mlScores: mlScoreCache.size,
            userAffinity: userAffinityCache.size,
            userProfiles: userProfileCache.size
        },
        circuit: {
            open: circuitOpen,
            failures: circuitFailureCount,
            openTime: circuitOpen ? Date.now() - circuitOpenTime : 0
        },
        config: CONFIG
    };
};

const getSimilarPosts = async (postId, limit = 5) => {
    return { similar: [], source: 'not-implemented' };
};

const getTrendingPosts = async (posts, limit = 10) => {
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const recentPosts = posts.filter(p => new Date(p.createdAt).getTime() > last24h);
    const scored = recentPosts.map(post => ({
        postId: post.postId,
        score: getEngagementScore(post) * getRecencyScore(post.createdAt)
    }));
    scored.sort((a, b) => b.score - a.score);
    return { trending: scored.slice(0, limit).map(p => p.postId), source: 'local-trending' };
};

module.exports = {
    getRecommendations,
    trackInteraction,
    getUserInteractions,
    getSimilarPosts,
    getTrendingPosts,
    clearUserCache,
    healthCheck,
    getStats,
    cleanupCaches,
    CONFIG
};
