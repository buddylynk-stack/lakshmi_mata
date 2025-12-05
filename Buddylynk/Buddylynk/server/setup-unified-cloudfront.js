/**
 * Setup Unified CloudFront for Images + HLS Videos
 * Single CDN for all media: images, videos, HLS streams
 * Run: node setup-unified-cloudfront.js
 */

const { CloudFrontClient, CreateDistributionCommand, ListDistributionsCommand } = require('@aws-sdk/client-cloudfront');
const fs = require('fs');
require('dotenv').config();

const REGION = process.env.AWS_REGION || 'us-east-1';
const MEDIA_BUCKET = process.env.S3_BUCKET_NAME; // buddylynk-media-bucket-2024
const HLS_BUCKET = process.env.HLS_OUTPUT_BUCKET || `${MEDIA_BUCKET}-hls`;

const cf = new CloudFrontClient({ region: 'us-east-1' });

async function createUnifiedCloudFront() {
    console.log('🌐 Creating Unified CloudFront Distribution\n');
    console.log(`   Media Bucket: ${MEDIA_BUCKET}`);
    console.log(`   HLS Bucket:   ${HLS_BUCKET}\n`);

    // Check if unified distribution already exists
    const existing = await cf.send(new ListDistributionsCommand({}));
    const unifiedDist = existing.DistributionList?.Items?.find(d => 
        d.Comment === 'Buddylynk Unified CDN'
    );

    if (unifiedDist) {
        console.log(`✅ Unified CloudFront already exists: https://${unifiedDist.DomainName}`);
        return unifiedDist.DomainName;
    }

    const distributionConfig = {
        DistributionConfig: {
            CallerReference: `buddylynk-unified-${Date.now()}`,
            Comment: 'Buddylynk Unified CDN',
            Enabled: true,
            
            // Multiple origins: Media bucket + HLS bucket
            Origins: {
                Quantity: 2,
                Items: [
                    {
                        Id: 'MediaBucket',
                        DomainName: `${MEDIA_BUCKET}.s3.${REGION}.amazonaws.com`,
                        S3OriginConfig: { OriginAccessIdentity: '' },
                    },
                    {
                        Id: 'HLSBucket',
                        DomainName: `${HLS_BUCKET}.s3.${REGION}.amazonaws.com`,
                        S3OriginConfig: { OriginAccessIdentity: '' },
                    },
                ],
            },

            // Default behavior: serve from Media bucket (images, original videos)
            DefaultCacheBehavior: {
                TargetOriginId: 'MediaBucket',
                ViewerProtocolPolicy: 'redirect-to-https',
                AllowedMethods: {
                    Quantity: 2,
                    Items: ['GET', 'HEAD'],
                    CachedMethods: { Quantity: 2, Items: ['GET', 'HEAD'] },
                },
                ForwardedValues: {
                    QueryString: false,
                    Cookies: { Forward: 'none' },
                    Headers: { Quantity: 0 },
                },
                MinTTL: 0,
                DefaultTTL: 86400,      // 1 day
                MaxTTL: 31536000,       // 1 year
                Compress: true,
            },

            // Cache behaviors: route /hls/* to HLS bucket
            CacheBehaviors: {
                Quantity: 1,
                Items: [
                    {
                        PathPattern: '/hls/*',
                        TargetOriginId: 'HLSBucket',
                        ViewerProtocolPolicy: 'redirect-to-https',
                        AllowedMethods: {
                            Quantity: 2,
                            Items: ['GET', 'HEAD'],
                            CachedMethods: { Quantity: 2, Items: ['GET', 'HEAD'] },
                        },
                        ForwardedValues: {
                            QueryString: false,
                            Cookies: { Forward: 'none' },
                            Headers: { Quantity: 0 },
                        },
                        MinTTL: 0,
                        DefaultTTL: 86400,
                        MaxTTL: 31536000,
                        Compress: true,
                    },
                ],
            },

            PriceClass: 'PriceClass_All',
            HttpVersion: 'http2and3',
            IsIPV6Enabled: true,
        },
    };

    try {
        const response = await cf.send(new CreateDistributionCommand(distributionConfig));
        const domain = response.Distribution.DomainName;
        
        console.log(`\n✅ Unified CloudFront created: https://${domain}`);
        console.log(`\n📋 URL Patterns:`);
        console.log(`   Images:     https://${domain}/1234567890-image.jpg`);
        console.log(`   Videos:     https://${domain}/1234567890-video.mp4`);
        console.log(`   HLS:        https://${domain}/hls/video_name/video_name.m3u8`);

        // Update .env
        const envUpdate = `\n# Unified CloudFront CDN\nCLOUDFRONT_DOMAIN=${domain}\n`;
        fs.appendFileSync('.env', envUpdate);
        console.log(`\n💾 Added CLOUDFRONT_DOMAIN to .env`);

        return domain;
    } catch (error) {
        console.error('❌ Failed to create CloudFront:', error.message);
        throw error;
    }
}

createUnifiedCloudFront().catch(console.error);
