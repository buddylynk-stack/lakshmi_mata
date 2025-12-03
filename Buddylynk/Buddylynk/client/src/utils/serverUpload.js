import axios from 'axios';
import { API_BASE_URL } from '../config/api';

// Image compression settings
const MAX_IMAGE_SIZE = 1920; // Max width/height
const IMAGE_QUALITY = 0.85; // JPEG quality
const MAX_FILE_SIZE_MB = 10; // Max file size before compression

// Compress image before upload
const compressImage = (file) => {
    return new Promise((resolve, reject) => {
        // Skip if not an image or already small
        if (!file.type.startsWith('image/') || file.size < 500 * 1024) {
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
        };

        img.onerror = () => resolve(file);
        img.src = URL.createObjectURL(file);
    });
};

// Upload via presigned URL (fastest - direct to S3)
const uploadViaPresignedUrl = async (file, onProgress) => {
    try {
        const token = localStorage.getItem('token');
        
        // Get presigned URL
        const { data } = await axios.post(`${API_BASE_URL}/upload/presigned-url`, {
            fileName: file.name,
            fileType: file.type
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        // Upload directly to S3
        await axios.put(data.uploadUrl, file, {
            headers: {
                'Content-Type': file.type
            },
            onUploadProgress: (progressEvent) => {
                if (progressEvent.lengthComputable && onProgress) {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percent);
                }
            }
        });

        return data.fileUrl;
    } catch (error) {
        console.error('Presigned URL upload failed:', error);
        throw error;
    }
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

// Main upload function with compression and fallback
export const uploadViaServer = async (file, onProgress) => {
    try {
        console.log(`📤 Uploading: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        
        // Compress images before upload
        let fileToUpload = file;
        if (file.type.startsWith('image/') && file.size > 1024 * 1024) {
            onProgress?.(5); // Show compression started
            fileToUpload = await compressImage(file);
        }

        // Try presigned URL first (fastest)
        try {
            const url = await uploadViaPresignedUrl(fileToUpload, onProgress);
            console.log('✅ Upload via presigned URL successful');
            return url;
        } catch (presignedError) {
            console.log('⚠️ Presigned URL failed, falling back to server upload');
        }

        // Fallback to server upload
        const url = await uploadViaServerDirect(fileToUpload, onProgress);
        console.log('✅ Upload via server successful');
        return url;
    } catch (error) {
        console.error('❌ Upload error:', error);
        throw error;
    }
};

// Parallel upload for multiple files (much faster)
export const uploadMultipleFiles = async (files, onProgress) => {
    const totalFiles = files.length;
    let completedFiles = 0;
    const results = [];

    // Upload in parallel batches of 3
    const batchSize = 3;
    
    for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (file, batchIndex) => {
            const fileIndex = i + batchIndex;
            
            const url = await uploadViaServer(file, (fileProgress) => {
                // Calculate overall progress
                const baseProgress = (completedFiles / totalFiles) * 100;
                const fileContribution = (fileProgress / totalFiles);
                onProgress?.(Math.round(baseProgress + fileContribution));
            });
            
            completedFiles++;
            return { index: fileIndex, url, type: file.type.startsWith('video') ? 'video' : 'image' };
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
    }

    // Sort by original index
    results.sort((a, b) => a.index - b.index);
    
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
