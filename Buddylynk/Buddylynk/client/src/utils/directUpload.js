import axios from 'axios';
import { API_BASE_URL } from '../config/api';

// Compress image on client side before upload - optimized
const compressImage = async (file) => {
    return new Promise((resolve) => {
        // Skip small files
        if (file.size < 300 * 1024) {
            resolve(file);
            return;
        }
        
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Max dimensions
            const MAX_WIDTH = 1920;
            const MAX_HEIGHT = 1920;
            
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob((blob) => {
                URL.revokeObjectURL(objectUrl);
                resolve(new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                }));
            }, 'image/jpeg', 0.85);
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(file);
        };
        
        img.src = objectUrl;
    });
};

// Direct upload to S3 - v2.1 (XMLHttpRequest with real-time progress)
export const uploadToS3Direct = async (file, onProgress) => {
    try {
        const startTime = Date.now();
        console.log('🚀 Direct S3 upload:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        
        // Compress images on client side
        let fileToUpload = file;
        let finalFileType = file.type;
        
        if (file.type.startsWith('image/') && file.type !== 'image/gif') {
            onProgress?.(2);
            fileToUpload = await compressImage(file);
            finalFileType = 'image/jpeg';
            console.log(`📦 Compressed: ${(file.size / 1024).toFixed(0)}KB → ${(fileToUpload.size / 1024).toFixed(0)}KB`);
            onProgress?.(5);
        }
        
        // Get presigned URL from backend
        const { data } = await axios.post(`${API_BASE_URL}/upload/presigned-url`, {
            fileName: file.name,
            fileType: finalFileType,
        });
        
        // Upload directly to S3 with real-time progress
        await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            let lastProgress = 0;
            
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable && onProgress) {
                    const percent = Math.round((event.loaded * 100) / event.total);
                    if (percent !== lastProgress) {
                        onProgress(percent);
                        lastProgress = percent;
                    }
                }
            });
            
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
                    console.log(`✅ Upload complete! (${totalTime}s)`);
                    resolve();
                } else {
                    console.error('S3 Error:', xhr.status, xhr.responseText);
                    reject(new Error(`S3 upload failed: ${xhr.status}`));
                }
            });
            
            xhr.addEventListener('error', () => reject(new Error('Network error')));
            xhr.addEventListener('timeout', () => reject(new Error('Upload timeout')));
            
            xhr.open('PUT', data.uploadUrl);
            xhr.setRequestHeader('Content-Type', finalFileType);
            xhr.timeout = 600000; // 10 min timeout
            xhr.send(fileToUpload);
        });
        
        return data.fileUrl;
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
};
