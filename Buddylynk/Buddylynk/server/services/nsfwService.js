const axios = require('axios');

const NSFW_API_URL = process.env.NSFW_API_URL || 'http://35.227.39.141:8002/nsfw';

// ============== PRODUCTION NSFW CONFIG ==============
const NSFW_CONFIG = {
    // EXPLICIT CONTENT - Absolutely NSFW (genitalia)
    EXPLICIT_CLASSES: [
        'exposed_genitalia_female',
        'exposed_genitalia_male',
        'exposed_anus',
        'exposed_penis',
        'exposed_vagina'
    ],
    
    // BREAST - Separate handling (higher threshold to avoid swimwear/art/breastfeeding)
    BREAST_CLASS: 'exposed_breast_female',
    
    // BORDERLINE - Very high threshold (buttocks can be in swimwear/sports)
    BORDERLINE_CLASSES: [
        'exposed_buttocks'
    ],
    
    // SAFE CLASSES - Never flag these (normal body parts)
    SAFE_CLASSES: [
        'face',
        'belly',
        'feet',
        'armpits',
        'covered_breast_female',
        'covered_genitalia_female',
        'covered_genitalia_male',
        'covered_buttocks'
    ],
    
    // ============== THRESHOLDS ==============
    // Higher = fewer false positives, but might miss some NSFW
    EXPLICIT_THRESHOLD: 0.80,           // 80% for genitalia (very strict)
    BREAST_THRESHOLD: 0.85,             // 85% for breasts (avoid swimwear/art)
    BORDERLINE_THRESHOLD: 0.90,         // 90% for buttocks (very strict)
    
    // Require multiple detections for extra safety
    MIN_EXPLICIT_DETECTIONS: 1,         // At least 1 high-confidence detection
    MIN_TOTAL_SCORE: 0.85,              // Average confidence must be high
    
    // Context analysis - check if multiple body parts detected
    REQUIRE_CONTEXT: true,              // Check surrounding detections
    MIN_CONTEXT_PARTS: 2,               // Need 2+ explicit parts for confirmation
    
    // Video specific - EXACT and THOROUGH
    VIDEO_THRESHOLD: 0.75,              // 75% for video frames (compression artifacts)
    MIN_NSFW_FRAMES: 3,                 // Need 3+ frames flagged
    MIN_NSFW_PERCENTAGE: 20,            // Or 20%+ of frames flagged
    VIDEO_HIGH_CONFIDENCE: 90,          // 90%+ avg = NSFW even with 2 frames
    VIDEO_VERY_HIGH_CONFIDENCE: 95,     // 95%+ single frame = obvious NSFW
    VIDEO_MIN_FRAMES: 10,               // Extract at least 10 frames
    VIDEO_MAX_FRAMES: 20,               // Maximum 20 frames (performance)
    VIDEO_FRAME_INTERVAL: 4,            // 1 frame every 4 seconds
    
    // Performance
    MAX_RETRIES: 2,                     // Retry failed checks
    TIMEOUT: 30000,                     // 30 second timeout
    
    // Logging
    DETAILED_LOGGING: true              // Log all detections for debugging
};

/**
 * Check if an image contains NSFW content
 * Production-ready with multi-pass verification and context analysis
 */
const checkNSFW = async (imageUrl, retryCount = 0) => {
    try {
        if (NSFW_CONFIG.DETAILED_LOGGING) {
            console.log(`🔍 NSFW Check [Attempt ${retryCount + 1}]: ${imageUrl.substring(0, 80)}...`);
        }
        
        const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 15000
        });
        
        const FormData = require('form-data');
        const form = new FormData();
        
        form.append('image', Buffer.from(imageResponse.data), {
            filename: 'image.jpg',
            contentType: imageResponse.headers['content-type'] || 'image/jpeg'
        });
        
        const response = await axios.post(NSFW_API_URL, form, {
            headers: { ...form.getHeaders() },
            timeout: NSFW_CONFIG.TIMEOUT,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        const { result } = response.data;
        
        if (!result || !result.parts || !Array.isArray(result.parts)) {
            console.log('⚠️  No detection results returned');
            return { isNsfw: false, confidence: 0, detectedParts: [], reason: 'no-results' };
        }
        
        // Analyze all detections
        const analysis = analyzeDetections(result.parts);
        
        // Log detailed results
        if (NSFW_CONFIG.DETAILED_LOGGING && analysis.allDetections.length > 0) {
            console.log(`   📊 Detections: ${analysis.allDetections.length} parts found`);
            analysis.allDetections.forEach(d => {
                const emoji = d.isExplicit ? '🔴' : d.isBreast ? '🟡' : d.isBorderline ? '🟠' : '🟢';
                console.log(`      ${emoji} ${d.class}: ${(d.score * 100).toFixed(1)}% ${d.meetsThreshold ? '✓' : '✗'}`);
            });
        }
        
        // Determine if NSFW based on comprehensive analysis
        const isNsfw = determineNSFW(analysis);
        
        const status = isNsfw ? '⚠️  NSFW DETECTED' : '✅ Safe';
        const reason = isNsfw ? analysis.reason : 'safe';
        
        console.log(`${status} - Max: ${analysis.maxConfidence.toFixed(1)}%, Avg: ${analysis.avgConfidence.toFixed(1)}% (${reason})`);
        
        return {
            isNsfw,
            confidence: analysis.maxConfidence,
            avgConfidence: analysis.avgConfidence,
            detectedParts: analysis.explicitParts,
            allDetections: analysis.allDetections,
            reason,
            details: result
        };
    } catch (error) {
        console.error(`❌ NSFW check failed [Attempt ${retryCount + 1}]:`, error.message);
        
        // Retry logic
        if (retryCount < NSFW_CONFIG.MAX_RETRIES) {
            console.log(`🔄 Retrying NSFW check (${retryCount + 1}/${NSFW_CONFIG.MAX_RETRIES})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return checkNSFW(imageUrl, retryCount + 1);
        }
        
        // Fail OPEN - allow content if check fails (better UX)
        console.log('⚠️  NSFW check failed after retries - allowing content (fail-open)');
        return {
            isNsfw: false,
            confidence: 0,
            error: error.message,
            reason: 'check-failed'
        };
    }
};

/**
 * Analyze all detections and categorize them
 */
const analyzeDetections = (parts) => {
    const allDetections = [];
    const explicitParts = [];
    let totalConfidence = 0;
    let maxConfidence = 0;
    let explicitCount = 0;
    let breastCount = 0;
    let borderlineCount = 0;
    
    for (const part of parts) {
        if (!part.score || part.score <= 0 || part.score === -1) continue;
        
        const className = (part.class || '').toLowerCase();
        const score = part.score;
        
        // Check if it's a safe class (ignore these)
        const isSafe = NSFW_CONFIG.SAFE_CLASSES.some(c => className.includes(c.toLowerCase()));
        if (isSafe) continue;
        
        // Categorize detection
        const isExplicit = NSFW_CONFIG.EXPLICIT_CLASSES.some(c => className.includes(c.toLowerCase()));
        const isBreast = className.includes(NSFW_CONFIG.BREAST_CLASS.toLowerCase());
        const isBorderline = NSFW_CONFIG.BORDERLINE_CLASSES.some(c => className.includes(c.toLowerCase()));
        
        // Check if meets threshold
        let meetsThreshold = false;
        if (isExplicit && score >= NSFW_CONFIG.EXPLICIT_THRESHOLD) {
            meetsThreshold = true;
            explicitCount++;
        }
        if (isBreast && score >= NSFW_CONFIG.BREAST_THRESHOLD) {
            meetsThreshold = true;
            breastCount++;
        }
        if (isBorderline && score >= NSFW_CONFIG.BORDERLINE_THRESHOLD) {
            meetsThreshold = true;
            borderlineCount++;
        }
        
        const detection = {
            class: part.class,
            score,
            isExplicit,
            isBreast,
            isBorderline,
            meetsThreshold
        };
        
        allDetections.push(detection);
        
        if (meetsThreshold) {
            explicitParts.push({ class: part.class, score });
            totalConfidence += score;
            maxConfidence = Math.max(maxConfidence, score);
        }
    }
    
    const avgConfidence = explicitParts.length > 0 
        ? (totalConfidence / explicitParts.length) * 100 
        : 0;
    
    return {
        allDetections,
        explicitParts,
        maxConfidence: maxConfidence * 100,
        avgConfidence,
        explicitCount,
        breastCount,
        borderlineCount,
        totalDetections: allDetections.length
    };
};

/**
 * Determine if content is NSFW based on comprehensive analysis
 */
const determineNSFW = (analysis) => {
    // No explicit parts detected
    if (analysis.explicitParts.length === 0) {
        return false;
    }
    
    // Single detection - must be very high confidence
    if (analysis.explicitParts.length === 1) {
        const part = analysis.explicitParts[0];
        const score = part.score;
        
        // Explicit genitalia - flag if above threshold
        if (analysis.explicitCount > 0 && score >= NSFW_CONFIG.EXPLICIT_THRESHOLD) {
            analysis.reason = 'explicit-genitalia-high-confidence';
            return true;
        }
        
        // Breast - only flag if very high confidence (avoid swimwear)
        if (analysis.breastCount > 0 && score >= NSFW_CONFIG.BREAST_THRESHOLD) {
            analysis.reason = 'breast-very-high-confidence';
            return true;
        }
        
        // Borderline - only flag if extremely high confidence
        if (analysis.borderlineCount > 0 && score >= NSFW_CONFIG.BORDERLINE_THRESHOLD) {
            analysis.reason = 'borderline-extreme-confidence';
            return true;
        }
        
        return false;
    }
    
    // Multiple detections - use context analysis
    if (NSFW_CONFIG.REQUIRE_CONTEXT && analysis.explicitParts.length >= NSFW_CONFIG.MIN_CONTEXT_PARTS) {
        // Multiple explicit parts detected - very likely NSFW
        if (analysis.explicitCount >= 2) {
            analysis.reason = 'multiple-explicit-parts';
            return true;
        }
        
        // Explicit + breast/borderline - likely NSFW
        if (analysis.explicitCount >= 1 && (analysis.breastCount >= 1 || analysis.borderlineCount >= 1)) {
            analysis.reason = 'explicit-with-context';
            return true;
        }
        
        // Multiple breasts - likely NSFW
        if (analysis.breastCount >= 2 && analysis.avgConfidence >= NSFW_CONFIG.MIN_TOTAL_SCORE * 100) {
            analysis.reason = 'multiple-breasts-high-avg';
            return true;
        }
    }
    
    // Check average confidence for multiple detections
    if (analysis.avgConfidence >= NSFW_CONFIG.MIN_TOTAL_SCORE * 100) {
        analysis.reason = 'high-average-confidence';
        return true;
    }
    
    // Default: not NSFW (strict approach to avoid false positives)
    analysis.reason = 'below-threshold';
    return false;
};


/**
 * Check multiple images for NSFW content
 */
const checkMultipleImages = async (imageUrls) => {
    try {
        const results = await Promise.all(
            imageUrls.map(async (url) => {
                const result = await checkNSFW(url);
                return { url, ...result };
            })
        );
        return results;
    } catch (error) {
        console.error('❌ Multiple NSFW check failed:', error.message);
        throw error;
    }
};

/**
 * Check video for NSFW content by extracting frames
 * Production-ready with multiple frame analysis
 */
const checkVideoNSFW = async (videoUrl) => {
    try {
        console.log('🎬 Checking NSFW for video:', videoUrl);
        
        let ffmpeg;
        
        try {
            ffmpeg = require('fluent-ffmpeg');
            try {
                const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
                ffmpeg.setFfmpegPath(ffmpegPath);
            } catch (e) {
                // Use system FFmpeg
            }
        } catch (e) {
            console.log('⚠️  fluent-ffmpeg not available');
            return { isNsfw: false, confidence: 0, error: 'fluent-ffmpeg not installed' };
        }
        
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        
        const tempDir = path.join(os.tmpdir(), `nsfw-video-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });
        
        const videoResponse = await axios.get(videoUrl, {
            responseType: 'arraybuffer',
            timeout: 60000
        });
        
        const tempVideoPath = path.join(tempDir, 'video.mp4');
        fs.writeFileSync(tempVideoPath, Buffer.from(videoResponse.data));
        
        // Get video duration first to extract frames intelligently
        const getVideoDuration = () => {
            return new Promise((resolve, reject) => {
                ffmpeg.ffprobe(tempVideoPath, (err, metadata) => {
                    if (err) reject(err);
                    else resolve(metadata.format.duration || 30);
                });
            });
        };
        
        let videoDuration = 30; // Default 30 seconds
        try {
            videoDuration = await getVideoDuration();
            console.log(`   📹 Video duration: ${videoDuration.toFixed(1)}s`);
        } catch (err) {
            console.log('   ⚠️  Could not get duration, using default');
        }
        
        // Extract frames EVENLY across the ENTIRE video (EXACT coverage)
        // For a 60s video: extract 15 frames = 1 frame every 4 seconds
        const numFrames = Math.min(
            Math.max(
                Math.ceil(videoDuration / NSFW_CONFIG.VIDEO_FRAME_INTERVAL), 
                NSFW_CONFIG.VIDEO_MIN_FRAMES
            ),
            NSFW_CONFIG.VIDEO_MAX_FRAMES
        );
        
        const frameInterval = videoDuration / (numFrames + 1);
        const timestamps = [];
        for (let i = 1; i <= numFrames; i++) {
            timestamps.push(frameInterval * i);
        }
        
        console.log(`   🎞️  Extracting ${numFrames} frames evenly across ${videoDuration.toFixed(1)}s video`);
        
        // Extract all frames
        const framePromises = timestamps.map((timestamp, index) => {
            return new Promise((resolve) => {
                ffmpeg(tempVideoPath)
                    .screenshots({
                        timestamps: [timestamp],
                        filename: `frame-${index}.jpg`,
                        folder: tempDir,
                        size: '1280x?' // Higher resolution for better detection
                    })
                    .on('end', () => resolve(path.join(tempDir, `frame-${index}.jpg`)))
                    .on('error', (err) => {
                        console.log(`   ⚠️  Frame ${index} extraction failed:`, err.message);
                        resolve(null);
                    });
            });
        });
        
        const framePaths = (await Promise.all(framePromises)).filter(p => p && fs.existsSync(p));
        
        console.log(`   ✅ Extracted ${framePaths.length}/${numFrames} frames successfully`);
        
        if (framePaths.length === 0) {
            fs.rmSync(tempDir, { recursive: true, force: true });
            return { isNsfw: false, confidence: 0, error: 'No frames extracted' };
        }
        
        let maxConfidence = 0;
        let nsfwFrameCount = 0;
        let totalConfidence = 0;
        const frameResults = [];
        
        console.log(`🎬 Analyzing ${framePaths.length} video frames...`);
        
        for (let i = 0; i < framePaths.length; i++) {
            const framePath = framePaths[i];
            try {
                const FormData = require('form-data');
                const form = new FormData();
                form.append('image', fs.createReadStream(framePath), {
                    filename: 'frame.jpg',
                    contentType: 'image/jpeg'
                });
                
                const response = await axios.post(NSFW_API_URL, form, {
                    headers: form.getHeaders(),
                    timeout: NSFW_CONFIG.TIMEOUT
                });
                
                const { result } = response.data;
                
                if (result && result.parts) {
                    const analysis = analyzeDetections(result.parts);
                    const frameNsfw = determineNSFW(analysis);
                    
                    frameResults.push({
                        frame: i + 1,
                        isNsfw: frameNsfw,
                        confidence: analysis.maxConfidence,
                        detections: analysis.explicitParts.length
                    });
                    
                    if (frameNsfw) {
                        nsfwFrameCount++;
                        totalConfidence += analysis.maxConfidence;
                        maxConfidence = Math.max(maxConfidence, analysis.maxConfidence);
                        
                        if (NSFW_CONFIG.DETAILED_LOGGING) {
                            console.log(`   🔴 Frame ${i + 1}: NSFW (${analysis.maxConfidence.toFixed(1)}%)`);
                        }
                    } else if (NSFW_CONFIG.DETAILED_LOGGING) {
                        console.log(`   ✅ Frame ${i + 1}: Safe`);
                    }
                }
                
            } catch (frameError) {
                console.log(`⚠️  Frame ${i + 1} check error:`, frameError.message);
            }
        }
        
        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        // STRICT VIDEO NSFW DETERMINATION - Multiple verification methods
        const nsfwPercentage = (nsfwFrameCount / framePaths.length) * 100;
        const avgConfidence = nsfwFrameCount > 0 ? totalConfidence / nsfwFrameCount : 0;
        
        let isNsfw = false;
        let reason = 'safe-video';
        const checks = [];
        
        // Method 1: Absolute count (at least 3 frames flagged)
        if (nsfwFrameCount >= NSFW_CONFIG.MIN_NSFW_FRAMES) {
            isNsfw = true;
            reason = `${nsfwFrameCount}-frames-flagged`;
            checks.push(`✓ ${nsfwFrameCount} frames flagged (>= ${NSFW_CONFIG.MIN_NSFW_FRAMES})`);
        } else {
            checks.push(`✗ ${nsfwFrameCount} frames flagged (< ${NSFW_CONFIG.MIN_NSFW_FRAMES})`);
        }
        
        // Method 2: Percentage threshold (>20% of frames)
        if (nsfwPercentage >= NSFW_CONFIG.MIN_NSFW_PERCENTAGE) {
            isNsfw = true;
            reason = `${nsfwPercentage.toFixed(1)}%-frames-nsfw`;
            checks.push(`✓ ${nsfwPercentage.toFixed(1)}% frames (>= ${NSFW_CONFIG.MIN_NSFW_PERCENTAGE}%)`);
        } else {
            checks.push(`✗ ${nsfwPercentage.toFixed(1)}% frames (< ${NSFW_CONFIG.MIN_NSFW_PERCENTAGE}%)`);
        }
        
        // Method 3: High confidence detections (2+ frames with 90%+ avg)
        if (nsfwFrameCount >= 2 && avgConfidence >= NSFW_CONFIG.VIDEO_HIGH_CONFIDENCE) {
            isNsfw = true;
            reason = 'high-confidence-detections';
            checks.push(`✓ High avg confidence: ${avgConfidence.toFixed(1)}% (>= ${NSFW_CONFIG.VIDEO_HIGH_CONFIDENCE}%)`);
        } else if (nsfwFrameCount >= 2) {
            checks.push(`✗ Avg confidence: ${avgConfidence.toFixed(1)}% (< ${NSFW_CONFIG.VIDEO_HIGH_CONFIDENCE}%)`);
        }
        
        // Method 4: Very high confidence single frame (95%+ = obvious NSFW)
        if (nsfwFrameCount >= 1 && maxConfidence >= NSFW_CONFIG.VIDEO_VERY_HIGH_CONFIDENCE) {
            isNsfw = true;
            reason = 'very-high-confidence-frame';
            checks.push(`✓ Very high max: ${maxConfidence.toFixed(1)}% (>= ${NSFW_CONFIG.VIDEO_VERY_HIGH_CONFIDENCE}%)`);
        } else if (nsfwFrameCount >= 1) {
            checks.push(`✗ Max confidence: ${maxConfidence.toFixed(1)}% (< ${NSFW_CONFIG.VIDEO_VERY_HIGH_CONFIDENCE}%)`);
        }
        
        // Log all checks
        if (NSFW_CONFIG.DETAILED_LOGGING) {
            console.log(`   📋 NSFW Checks:`);
            checks.forEach(check => console.log(`      ${check}`));
        }
        
        const status = isNsfw ? '⚠️  NSFW VIDEO' : '✅ Safe video';
        console.log(`${status} - ${nsfwFrameCount}/${framePaths.length} frames (${nsfwPercentage.toFixed(1)}%) flagged`);
        console.log(`   Max: ${maxConfidence.toFixed(1)}%, Avg: ${avgConfidence.toFixed(1)}% - Reason: ${reason}`);
        
        return {
            isNsfw,
            confidence: maxConfidence,
            avgConfidence,
            nsfwPercentage,
            details: { 
                framesChecked: framePaths.length, 
                nsfwFrames: nsfwFrameCount,
                nsfwPercentage: nsfwPercentage.toFixed(1),
                frameResults,
                reason,
                videoDuration: videoDuration.toFixed(1)
            }
        };
        
    } catch (error) {
        console.error('❌ Video NSFW check failed:', error.message);
        return { isNsfw: false, confidence: 0, error: error.message };
    }
};

/**
 * Check all media (images and videos) for NSFW content
 */
const checkAllMedia = async (mediaItems) => {
    try {
        const results = await Promise.all(
            mediaItems.map(async (item) => {
                if (item.type === 'video') {
                    const result = await checkVideoNSFW(item.url);
                    return { url: item.url, type: 'video', ...result };
                } else {
                    const result = await checkNSFW(item.url);
                    return { url: item.url, type: 'image', ...result };
                }
            })
        );
        return results;
    } catch (error) {
        console.error('❌ Media NSFW check failed:', error.message);
        throw error;
    }
};

module.exports = {
    checkNSFW,
    checkMultipleImages,
    checkVideoNSFW,
    checkAllMedia,
    NSFW_CONFIG
};
