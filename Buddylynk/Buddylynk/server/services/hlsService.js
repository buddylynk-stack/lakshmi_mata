/**
 * HLS Video Streaming Service
 * Auto-converts uploaded videos to adaptive HLS (360p, 720p, 1080p)
 */

const { MediaConvertClient, CreateJobCommand, DescribeEndpointsCommand, GetJobCommand } = require('@aws-sdk/client-mediaconvert');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');

const REGION = process.env.AWS_REGION || 'us-east-1';
const INPUT_BUCKET = process.env.S3_BUCKET_NAME;
const OUTPUT_BUCKET = process.env.HLS_OUTPUT_BUCKET || `${INPUT_BUCKET}-hls`;
const MEDIACONVERT_ROLE = process.env.MEDIACONVERT_ROLE_ARN;
const CLOUDFRONT_HLS_DOMAIN = process.env.CLOUDFRONT_HLS_DOMAIN;

let mediaConvertEndpoint = process.env.MEDIACONVERT_ENDPOINT;
let mediaConvertClient = null;

const s3Client = new S3Client({ region: REGION });

// Get MediaConvert endpoint (cached)
async function getMediaConvertClient() {
    if (mediaConvertClient) return mediaConvertClient;
    
    if (!mediaConvertEndpoint) {
        const client = new MediaConvertClient({ region: REGION });
        const response = await client.send(new DescribeEndpointsCommand({}));
        mediaConvertEndpoint = response.Endpoints[0].Url;
        console.log(`📡 MediaConvert endpoint: ${mediaConvertEndpoint}`);
    }
    
    mediaConvertClient = new MediaConvertClient({ 
        region: REGION, 
        endpoint: mediaConvertEndpoint 
    });
    return mediaConvertClient;
}

/**
 * Start HLS transcoding job for a video
 * @param {string} videoUrl - S3 URL of the uploaded video
 * @returns {Object} - Job info with HLS URL
 */
async function startHLSTranscode(videoUrl) {
    if (!MEDIACONVERT_ROLE) {
        console.warn('⚠️ HLS disabled: MEDIACONVERT_ROLE_ARN not set');
        return null;
    }

    const client = await getMediaConvertClient();
    
    // Extract key from S3 URL
    const urlParts = new URL(videoUrl);
    const key = urlParts.pathname.substring(1); // Remove leading /
    const baseName = key.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_');
    const outputPath = `hls/${baseName}/`;

    console.log(`🎬 Starting HLS transcode for: ${key}`);

    const jobParams = {
        Role: MEDIACONVERT_ROLE,
        Settings: {
            Inputs: [{
                FileInput: `s3://${INPUT_BUCKET}/${key}`,
                AudioSelectors: { 'Audio Selector 1': { DefaultSelection: 'DEFAULT' } },
                VideoSelector: {},
                TimecodeSource: 'ZEROBASED',
            }],
            OutputGroups: [{
                Name: 'HLS',
                OutputGroupSettings: {
                    Type: 'HLS_GROUP_SETTINGS',
                    HlsGroupSettings: {
                        SegmentLength: 6,
                        MinSegmentLength: 2,
                        Destination: `s3://${OUTPUT_BUCKET}/${outputPath}`,
                        SegmentControl: 'SEGMENTED_FILES',
                        ManifestDurationFormat: 'INTEGER',
                    },
                },
                Outputs: [
                    // 360p - Fast loading, low bandwidth
                    {
                        NameModifier: '_360p',
                        ContainerSettings: { Container: 'M3U8' },
                        VideoDescription: {
                            Width: 640, Height: 360,
                            CodecSettings: {
                                Codec: 'H_264',
                                H264Settings: {
                                    RateControlMode: 'QVBR',
                                    QvbrSettings: { QvbrQualityLevel: 7 },
                                    MaxBitrate: 800000,
                                    FramerateControl: 'INITIALIZE_FROM_SOURCE',
                                    GopSize: 2, GopSizeUnits: 'SECONDS',
                                },
                            },
                        },
                        AudioDescriptions: [{
                            CodecSettings: {
                                Codec: 'AAC',
                                AacSettings: { Bitrate: 96000, CodingMode: 'CODING_MODE_2_0', SampleRate: 44100 },
                            },
                        }],
                    },
                    // 720p - Balanced quality
                    {
                        NameModifier: '_720p',
                        ContainerSettings: { Container: 'M3U8' },
                        VideoDescription: {
                            Width: 1280, Height: 720,
                            CodecSettings: {
                                Codec: 'H_264',
                                H264Settings: {
                                    RateControlMode: 'QVBR',
                                    QvbrSettings: { QvbrQualityLevel: 8 },
                                    MaxBitrate: 3000000,
                                    FramerateControl: 'INITIALIZE_FROM_SOURCE',
                                    GopSize: 2, GopSizeUnits: 'SECONDS',
                                },
                            },
                        },
                        AudioDescriptions: [{
                            CodecSettings: {
                                Codec: 'AAC',
                                AacSettings: { Bitrate: 128000, CodingMode: 'CODING_MODE_2_0', SampleRate: 48000 },
                            },
                        }],
                    },
                    // 1080p - Full HD
                    {
                        NameModifier: '_1080p',
                        ContainerSettings: { Container: 'M3U8' },
                        VideoDescription: {
                            Width: 1920, Height: 1080,
                            CodecSettings: {
                                Codec: 'H_264',
                                H264Settings: {
                                    RateControlMode: 'QVBR',
                                    QvbrSettings: { QvbrQualityLevel: 9 },
                                    MaxBitrate: 6000000,
                                    FramerateControl: 'INITIALIZE_FROM_SOURCE',
                                    GopSize: 2, GopSizeUnits: 'SECONDS',
                                },
                            },
                        },
                        AudioDescriptions: [{
                            CodecSettings: {
                                Codec: 'AAC',
                                AacSettings: { Bitrate: 192000, CodingMode: 'CODING_MODE_2_0', SampleRate: 48000 },
                            },
                        }],
                    },
                ],
            }],
        },
        UserMetadata: { originalKey: key },
    };

    const result = await client.send(new CreateJobCommand(jobParams));
    const jobId = result.Job.Id;
    
    // Build HLS URL (will be available after transcoding completes)
    const hlsUrl = CLOUDFRONT_HLS_DOMAIN 
        ? `https://${CLOUDFRONT_HLS_DOMAIN}/${outputPath}${baseName}.m3u8`
        : `https://${OUTPUT_BUCKET}.s3.${REGION}.amazonaws.com/${outputPath}${baseName}.m3u8`;

    console.log(`✅ HLS job started: ${jobId}`);
    console.log(`   HLS URL (when ready): ${hlsUrl}`);

    return { jobId, hlsUrl, outputPath, status: 'SUBMITTED' };
}


/**
 * Check HLS job status
 */
async function getJobStatus(jobId) {
    const client = await getMediaConvertClient();
    const result = await client.send(new GetJobCommand({ Id: jobId }));
    return {
        status: result.Job.Status,
        progress: result.Job.JobPercentComplete || 0,
        errorMessage: result.Job.ErrorMessage,
    };
}

/**
 * Check if HLS version exists for a video
 */
async function checkHLSExists(videoUrl) {
    try {
        const urlParts = new URL(videoUrl);
        const key = urlParts.pathname.substring(1);
        const baseName = key.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_');
        const hlsKey = `hls/${baseName}/${baseName}.m3u8`;

        await s3Client.send(new HeadObjectCommand({
            Bucket: OUTPUT_BUCKET,
            Key: hlsKey,
        }));

        const hlsUrl = CLOUDFRONT_HLS_DOMAIN 
            ? `https://${CLOUDFRONT_HLS_DOMAIN}/${hlsKey}`
            : `https://${OUTPUT_BUCKET}.s3.${REGION}.amazonaws.com/${hlsKey}`;

        return { exists: true, hlsUrl };
    } catch (err) {
        return { exists: false, hlsUrl: null };
    }
}

/**
 * Get HLS URL for a video (check if exists, otherwise return original)
 */
async function getVideoUrl(originalUrl) {
    const hlsCheck = await checkHLSExists(originalUrl);
    if (hlsCheck.exists) {
        return { url: hlsCheck.hlsUrl, type: 'hls' };
    }
    return { url: originalUrl, type: 'mp4' };
}

module.exports = {
    startHLSTranscode,
    getJobStatus,
    checkHLSExists,
    getVideoUrl,
    OUTPUT_BUCKET,
    CLOUDFRONT_HLS_DOMAIN,
};
