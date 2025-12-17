import axios from 'axios';
import { API_BASE_URL } from '../config/api';

// Image compression settings
const MAX_IMAGE_SIZE = 1920; // Max width/height
const IMAGE_QUALITY = 0.85; // JPEG quality

// Compress image before upload - optimized for speed
const compressImage = (file) => {
    return new Promise((resolve) => {
        // Skip if not an image, is GIF, or already small
        if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.size < 300 * 1024) {
            resolve(file);
            return;
        }

        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
            let { width, height } = img;

            // Calculate new dimensions
            if (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE) {
                if (width > height) {
                    height = (height / width) * MAX_IMAGE_SIZE;
                    width = MAX_IMAGE_SIZE;
                } else {
                    width = (width / height) * MAX_IMAGE_SIZE;
                    height = MAX_IMAGE_SIZE;
                }
            }

            canvas.width = width;
            canvas.height = height;

            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        console.log(`📦 Compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
                        resolve(compressedFile);
                    } else {
                        resolve(file);
                    }
                },
                'image/jpeg',
                IMAGE_QUALITY
            );
            
            // Cleanup
            URL.revokeObjectURL(img.src);
        };

        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            resolve(file);
        };
        img.src = URL.createObjectURL(file);
    });
};

// Upload via presigned URL (fastest - direct to S3) with real-time progress
const uploadViaPresignedUrl = async (file, onProgress) => {
    const token = localStorage.getItem('token');
    const startTime = Date.now();

    console.log('🚀 Starting direct S3 upload for:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    // Get presigned URL from server
    const { data } = await axios.post(`${API_BASE_URL}/upload/presigned-url`, {
        fileName: file.name,
        fileType: file.type
    }, {
        headers: { Authorization: `Bearer ${token}` }
    });

    console.log('📝 Got presigned URL, uploading directly to S3...');

    // Upload directly to S3 using XMLHttpRequest for real-time progress
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let lastProgress = 0;
        let lastTime = startTime;
        let lastLoaded = 0;

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                const percent = Math.round((e.loaded * 100) / e.total);
                
                // Calculate upload speed
                const now = Date.now();
                const timeDiff = (now - lastTime) / 1000; // seconds
                const bytesDiff = e.loaded - lastLoaded;
                const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
                
                // Only update if progress changed (reduces UI updates)
                if (percent !== lastProgress) {
                    onProgress(percent);
                    
                    // Log speed every 10%
                    if (percent % 10 === 0 && percent > 0) {
                        const speedMB = (speed / 1024 / 1024).toFixed(2);
                        console.log(`📊 Upload: ${percent}% @ ${speedMB} MB/s`);
                    }
                    
                    lastProgress = percent;
                }
                
                lastTime = now;
                lastLoaded = e.loaded;
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`✅ Direct S3 upload successful! (${totalTime}s)`);
                resolve(data.fileUrl);
            } else {
                console.error('❌ S3 upload failed with status:', xhr.status, xhr.responseText);
                reject(new Error(`S3 upload failed: ${xhr.status}`));
            }
        });

        xhr.addEventListener('error', () => {
            console.error('❌ S3 upload network error');
            reject(new Error('Network error during S3 upload'));
        });

        xhr.addEventListener('timeout', () => {
            console.error('❌ S3 upload timeout');
            reject(new Error('S3 upload timeout'));
        });

        xhr.open('PUT', data.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.timeout = 600000; // 10 minute timeout for large files
        xhr.send(file);
    });
};

// Upload via server (fallback - more reliable)
const uploadViaServerDirect = async (file, onProgress) => {
    const formData = new FormData();
    formData.append('media', file);

    const token = localStorage.getItem('token');

    const response = await axios.post(`${API_BASE_URL}/upload/server`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
        },
        onUploadProgress: (progressEvent) => {
            if (progressEvent.lengthComputable && onProgress) {
                const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                onProgress(percent);
            }
        },
        timeout: 120000 // 2 minute timeout for large files
    });

    return response.data.url;
};

// Main upload function - DIRECT S3 FIRST for speed, server as fallback
export const uploadViaServer = async (file, onProgress) => {
    try {
        console.log(`📤 Uploading: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

        // Compress images before upload (skip small files)
        let fileToUpload = file;
        if (file.type.startsWith('image/') && file.type !== 'image/gif' && file.size > 500 * 1024) {
            onProgress?.(2); // Show compression started
            fileToUpload = await compressImage(file);
            onProgress?.(5); // Compression done
        }

        // Use DIRECT S3 upload FIRST (much faster - real-time progress)
        try {
            const url = await uploadViaPresignedUrl(fileToUpload, onProgress);
            console.log('✅ Direct S3 upload successful');
            return url;
        } catch (presignedError) {
            console.log('⚠️ Direct S3 failed, trying server upload:', presignedError.message);
        }

        // Fallback to server upload (slower but more reliable)
        try {
            const url = await uploadViaServerDirect(fileToUpload, onProgress);
            console.log('✅ Server upload successful');
            return url;
        } catch (serverError) {
            console.error('❌ Both upload methods failed');
            throw serverError;
        }
    } catch (error) {
        console.error('❌ Upload error:', error);
        throw error;
    }
};

// Upload file directly to S3 with presigned URL (no server roundtrip)
const uploadWithPresignedUrl = async (file, uploadUrl, fileUrl, onProgress) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let lastProgress = 0;

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                const percent = Math.round((e.loaded * 100) / e.total);
                if (percent !== lastProgress) {
                    onProgress(percent);
                    lastProgress = percent;
                }
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(fileUrl);
            } else {
                reject(new Error(`Upload failed: ${xhr.status}`));
            }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('timeout', () => reject(new Error('Timeout')));

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.timeout = 600000;
        xhr.send(file);
    });
};

// FAST batch upload - gets all presigned URLs at once, then uploads in parallel
export const uploadMultipleFiles = async (files, onProgress) => {
    const totalFiles = files.length;
    const fileProgress = new Array(totalFiles).fill(0);
    const token = localStorage.getItem('token');

    console.log(`📤 Batch uploading ${totalFiles} files...`);

    const updateTotalProgress = () => {
        const total = fileProgress.reduce((sum, p) => sum + p, 0);
        const avgProgress = Math.round(total / totalFiles);
        onProgress?.(avgProgress);
    };

    // Step 1: Compress all images in parallel
    onProgress?.(2);
    const compressedFiles = await Promise.all(
        files.map(async (file) => {
            if (file.type.startsWith('image/') && file.type !== 'image/gif' && file.size > 500 * 1024) {
                return await compressImage(file);
            }
            return file;
        })
    );
    onProgress?.(5);

    // Step 2: Get ALL presigned URLs in one request (faster!)
    const { data } = await axios.post(`${API_BASE_URL}/upload/presigned-urls`, {
        files: compressedFiles.map(f => ({ fileName: f.name, fileType: f.type }))
    }, {
        headers: { Authorization: `Bearer ${token}` }
    });

    console.log(`📝 Got ${data.urls.length} presigned URLs`);

    // Step 3: Upload ALL files in parallel (max 6 concurrent)
    const batchSize = 6;
    const results = [];

    for (let i = 0; i < compressedFiles.length; i += batchSize) {
        const batch = compressedFiles.slice(i, i + batchSize);
        const batchUrls = data.urls.slice(i, i + batchSize);

        const batchPromises = batch.map(async (file, batchIndex) => {
            const fileIndex = i + batchIndex;
            const { uploadUrl, fileUrl } = batchUrls[batchIndex];

            try {
                const url = await uploadWithPresignedUrl(file, uploadUrl, fileUrl, (progress) => {
                    fileProgress[fileIndex] = progress;
                    updateTotalProgress();
                });

                fileProgress[fileIndex] = 100;
                updateTotalProgress();

                return {
                    index: fileIndex,
                    url,
                    type: file.type.startsWith('video') ? 'video' : 'image'
                };
            } catch (error) {
                console.error(`Failed to upload file ${fileIndex}:`, error);
                // Fallback to server upload
                const url = await uploadViaServerDirect(file, (progress) => {
                    fileProgress[fileIndex] = progress;
                    updateTotalProgress();
                });
                return { index: fileIndex, url, type: file.type.startsWith('video') ? 'video' : 'image' };
            }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
    }

    // Sort by original index
    results.sort((a, b) => a.index - b.index);
    console.log(`✅ Batch upload complete!`);

    return results.map(r => ({ url: r.url, type: r.type }));
};

// Quick upload for small files (< 1MB) - no compression
export const quickUpload = async (file) => {
    if (file.size > 1024 * 1024) {
        return uploadViaServer(file);
    }

    // Direct upload without compression for small files
    return uploadViaServerDirect(file);
};

export default uploadViaServer;
