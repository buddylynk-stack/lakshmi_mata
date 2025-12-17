/**
 * NSFW Detection Service - Dual Check (NSFWJS + Fallback API)
 * Uses both for better accuracy - only flags if BOTH agree
 */

const axios = require('axios');
const tf = require('@tensorflow/tfjs');
const nsfw = require('nsfwjs');
const jpeg = require('jpeg-js');
const PNG = require('pngjs').PNG;

// ============== CONFIG ==============
const NSFW_CONFIG = {
    // NSFWJS thresholds (higher = fewer false positives)
    PORN_THRESHOLD: 0.90,      // 90% for porn (very strict)
    HENTAI_THRESHOLD: 0.92,    // 92% for hentai (very strict to avoid anime false positives)

    // Fallback API
    FALLBACK_API_URL: process.env.NSFW_API_URL || 'http://35.227.39.141:8002/nsfw',
    GENITAL_THRESHOLD: 0.30,   // 30% for genitalia detection

    // Timeout (reduced for faster uploads when API is slow/unreachable)
    TIMEOUT: 5000,

    // Fail open
    FAIL_OPEN: true,

    // Debug
    DEBUG: true
};

// NSFWJS model instance
let nsfwModel = null;

/**
 * Load NSFWJS model
 */
const loadModel = async () => {
    if (nsfwModel) return nsfwModel;

    console.log('🤖 Loading NSFWJS model...');
    try {
        nsfwModel = await nsfw.load('MobileNetV2');
        console.log('✅ NSFWJS model loaded');
        return nsfwModel;
    } catch (error) {
        console.error('❌ NSFWJS load failed:', error.message);
        return null;
    }
};

/**
 * Decode image to tensor
 */
const decodeImage = (buffer, contentType) => {
    let imageData;

    if (contentType && contentType.includes('png')) {
        const png = PNG.sync.read(buffer);
        imageData = { data: png.data, width: png.width, height: png.height };
    } else {
        imageData = jpeg.decode(buffer, { useTArray: true });
    }

    const { width, height, data } = imageData;
    const numPixels = width * height;
    const values = new Int32Array(numPixels * 3);

    for (let i = 0; i < numPixels; i++) {
        values[i * 3] = data[i * 4];
        values[i * 3 + 1] = data[i * 4 + 1];
        values[i * 3 + 2] = data[i * 4 + 2];
    }

    return tf.tensor3d(values, [height, width, 3], 'int32');
};

/**
 * Main NSFW check - DUAL verification
 */
const checkNSFW = async (imageUrl) => {
    if (NSFW_CONFIG.DEBUG) {
        console.log(`🔍 NSFW Check: ${imageUrl.substring(0, 60)}...`);
    }

    try {
        // Download image once
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 15000
        });
        const imageBuffer = Buffer.from(response.data);
        const contentType = response.headers['content-type'];

        // Run both checks in PARALLEL for speed
        const [nsfwjsResult, apiResult] = await Promise.all([
            checkWithNSFWJS(imageBuffer, contentType),
            checkWithFallbackAPI(imageBuffer, contentType)
        ]);

        // DECISION: Flag as NSFW if:
        // 1. NSFWJS says porn/hentai >= threshold, OR
        // 2. API detects genitalia

        if (nsfwjsResult.isNsfw || apiResult.isNsfw) {
            const confidence = Math.max(nsfwjsResult.confidence, apiResult.confidence);
            const reason = nsfwjsResult.isNsfw ? nsfwjsResult.reason : apiResult.reason;
            console.log(`   ⚠️ NSFW DETECTED - ${reason} (${confidence.toFixed(1)}%)`);
            return { isNsfw: true, confidence, reason };
        }

        console.log(`   ✅ SAFE`);
        return { isNsfw: false, confidence: 0, reason: 'safe' };

    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        return { isNsfw: false, confidence: 0, reason: 'error-fail-open' };
    }
};

/**
 * Check with NSFWJS
 */
const checkWithNSFWJS = async (imageBuffer, contentType) => {
    try {
        const model = await loadModel();
        if (!model) return { isNsfw: false, confidence: 0, reason: 'model-not-loaded' };

        const imageTensor = decodeImage(imageBuffer, contentType);
        const predictions = await model.classify(imageTensor);
        imageTensor.dispose();

        const predMap = {};
        predictions.forEach(p => predMap[p.className.toLowerCase()] = p.probability);

        const porn = predMap['porn'] || 0;
        const hentai = predMap['hentai'] || 0;

        if (NSFW_CONFIG.DEBUG) {
            console.log(`   📊 NSFWJS: Porn=${(porn * 100).toFixed(1)}%, Hentai=${(hentai * 100).toFixed(1)}%`);
        }

        if (porn >= NSFW_CONFIG.PORN_THRESHOLD) {
            return { isNsfw: true, confidence: porn * 100, reason: 'nsfwjs-porn' };
        }
        if (hentai >= NSFW_CONFIG.HENTAI_THRESHOLD) {
            return { isNsfw: true, confidence: hentai * 100, reason: 'nsfwjs-hentai' };
        }

        return { isNsfw: false, confidence: 0, reason: 'nsfwjs-safe' };

    } catch (error) {
        console.log(`   ⚠️ NSFWJS error: ${error.message}`);
        return { isNsfw: false, confidence: 0, reason: 'nsfwjs-error' };
    }
};

/**
 * Check with Fallback API (genitalia detection)
 */
const checkWithFallbackAPI = async (imageBuffer, contentType) => {
    try {
        const FormData = require('form-data');
        const form = new FormData();
        form.append('image', imageBuffer, {
            filename: 'image.jpg',
            contentType: contentType || 'image/jpeg'
        });

        const response = await axios.post(NSFW_CONFIG.FALLBACK_API_URL, form, {
            headers: form.getHeaders(),
            timeout: NSFW_CONFIG.TIMEOUT
        });

        const { result } = response.data;

        if (!result || !result.parts) {
            return { isNsfw: false, confidence: 0, reason: 'api-no-result' };
        }

        // Check for genitalia
        for (const part of result.parts) {
            const className = (part.class || '').toLowerCase();
            const score = part.score || 0;

            if ((className.includes('penis') || className.includes('vagina') ||
                className.includes('genitalia') || className.includes('anus')) &&
                score >= NSFW_CONFIG.GENITAL_THRESHOLD) {
                if (NSFW_CONFIG.DEBUG) {
                    console.log(`   📊 API: ${className} detected (${(score * 100).toFixed(1)}%)`);
                }
                return { isNsfw: true, confidence: score * 100, reason: 'api-genitalia' };
            }
        }

        return { isNsfw: false, confidence: 0, reason: 'api-safe' };

    } catch (error) {
        console.log(`   ⚠️ API error: ${error.message}`);
        return { isNsfw: false, confidence: 0, reason: 'api-error' };
    }
};

/**
 * Check video (skip)
 */
const checkVideoNSFW = async (videoUrl) => {
    console.log('🎬 Video check skipped');
    return { isNsfw: false, confidence: 0, reason: 'video-skipped' };
};

/**
 * Check all media
 */
const checkAllMedia = async (mediaItems) => {
    console.log(`\n🔍 ========== NSFW CHECK ==========`);
    console.log(`📎 Checking ${mediaItems.length} media item(s)`);

    const results = [];

    for (const item of mediaItems) {
        if (item.type === 'video') {
            results.push({ url: item.url, type: 'video', ...(await checkVideoNSFW(item.url)) });
        } else {
            results.push({ url: item.url, type: 'image', ...(await checkNSFW(item.url)) });
        }
    }

    const nsfwCount = results.filter(r => r.isNsfw).length;
    console.log(`\n📊 Result: ${nsfwCount}/${results.length} flagged`);
    console.log(`===================================\n`);

    return results;
};

/**
 * Health check
 */
const healthCheck = async () => {
    const model = await loadModel();
    return { status: model ? 'healthy' : 'degraded', nsfwjsLoaded: !!model };
};

module.exports = {
    checkNSFW,
    checkVideoNSFW,
    checkAllMedia,
    healthCheck,
    loadModel,
    NSFW_CONFIG
};
