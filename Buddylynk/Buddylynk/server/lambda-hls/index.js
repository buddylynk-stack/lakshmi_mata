const { MediaConvertClient, CreateJobCommand } = require('@aws-sdk/client-mediaconvert');

const REGION = process.env.AWS_REGION || 'us-east-1';
const MEDIACONVERT_ENDPOINT = process.env.MEDIACONVERT_ENDPOINT;
const MEDIACONVERT_ROLE_ARN = process.env.MEDIACONVERT_ROLE_ARN;
const OUTPUT_BUCKET = process.env.HLS_OUTPUT_BUCKET;

const mediaConvert = new MediaConvertClient({ region: REGION, endpoint: MEDIACONVERT_ENDPOINT });

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    for (const record of event.Records) {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

        // Only process video files
        if (!/\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(key)) {
            console.log(`Skipping non-video: ${key}`);
            continue;
        }

        // Skip HLS files
        if (key.includes('/hls/') || /\.(ts|m3u8)$/i.test(key)) {
            console.log(`Skipping HLS file: ${key}`);
            continue;
        }

        console.log(`Processing: s3://${bucket}/${key}`);
        const baseName = key.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_');
        const outputPath = `hls/${baseName}/`;

        const jobParams = {
            Role: MEDIACONVERT_ROLE_ARN,
            Settings: {
                Inputs: [{
                    FileInput: `s3://${bucket}/${key}`,
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
                        },
                    },
                    Outputs: [
                        { NameModifier: '_360p', ContainerSettings: { Container: 'M3U8' },
                          VideoDescription: { Width: 640, Height: 360, CodecSettings: { Codec: 'H_264', H264Settings: { RateControlMode: 'QVBR', QvbrSettings: { QvbrQualityLevel: 7 }, MaxBitrate: 800000, GopSize: 2, GopSizeUnits: 'SECONDS' }}},
                          AudioDescriptions: [{ CodecSettings: { Codec: 'AAC', AacSettings: { Bitrate: 96000, CodingMode: 'CODING_MODE_2_0', SampleRate: 44100 }}}]},
                        { NameModifier: '_720p', ContainerSettings: { Container: 'M3U8' },
                          VideoDescription: { Width: 1280, Height: 720, CodecSettings: { Codec: 'H_264', H264Settings: { RateControlMode: 'QVBR', QvbrSettings: { QvbrQualityLevel: 8 }, MaxBitrate: 3000000, GopSize: 2, GopSizeUnits: 'SECONDS' }}},
                          AudioDescriptions: [{ CodecSettings: { Codec: 'AAC', AacSettings: { Bitrate: 128000, CodingMode: 'CODING_MODE_2_0', SampleRate: 48000 }}}]},
                        { NameModifier: '_1080p', ContainerSettings: { Container: 'M3U8' },
                          VideoDescription: { Width: 1920, Height: 1080, CodecSettings: { Codec: 'H_264', H264Settings: { RateControlMode: 'QVBR', QvbrSettings: { QvbrQualityLevel: 9 }, MaxBitrate: 6000000, GopSize: 2, GopSizeUnits: 'SECONDS' }}},
                          AudioDescriptions: [{ CodecSettings: { Codec: 'AAC', AacSettings: { Bitrate: 192000, CodingMode: 'CODING_MODE_2_0', SampleRate: 48000 }}}]},
                    ],
                }],
            },
        };

        const result = await mediaConvert.send(new CreateJobCommand(jobParams));
        console.log(`HLS job created: ${result.Job.Id}`);
    }
    return { statusCode: 200 };
};
