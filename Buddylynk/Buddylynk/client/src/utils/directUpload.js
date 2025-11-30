import axios from 'axios';
import { API_BASE_URL } from '../config/api';

// Compress image on client side before upload
const compressImage = async (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
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
                    resolve(new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    }));
                }, 'image/jpeg', 0.85);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
};

// Direct upload to S3 - v2.0 (XMLHttpRequest)
export const uploadToS3Direct = async (file, onProgress) => {
    try {
        console.log('🚀 Using NEW upload code with XMLHttpRequest');
        // Compress images on client side
        let fileToUpload = file;
        let finalFileType = file.type;
        
        if (file.type.startsWith('image/') && file.type !== 'image/gif') {
            console.log('Compressing image...');
            fileToUpload = await compressImage(file);
            finalFileType = 'image/jpeg'; // Compression converts to JPEG
            console.log(`Original: ${(file.size / 1024).toFixed(2)} KB → Compressed: ${(fileToUpload.size / 1024).toFixed(2)} KB`);
        }
        
        // Get presigned URL from backend with the CORRECT file type
        const { data } = await axios.post(`${API_BASE_URL}/upload/presigned-url`, {
            fileName: file.name,
            fileType: finalFileType, // Use the actual type that will be uploaded
        });
        
        console.log('Uploading to S3...');
        console.log('File type:', finalFileType);
        console.log('File size:', fileToUpload.size);
        
        // Upload directly to S3 using XMLHttpRequest for progress tracking
        await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable && onProgress) {
                    const percentCompleted = Math.round((event.loaded * 100) / event.total);
                    onProgress(percentCompleted);
                }
            });
            
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    console.log('Upload successful!');
                    resolve();
                } else {
                    console.error('S3 Error Response:', xhr.responseText);
                    reject(new Error(`S3 upload failed: ${xhr.status} - ${xhr.responseText}`));
                }
            });
            
            xhr.addEventListener('error', () => {
                reject(new Error('Network error during upload'));
            });
            
            xhr.open('PUT', data.uploadUrl);
            xhr.setRequestHeader('Content-Type', finalFileType);
            xhr.send(fileToUpload);
        });
        
        return data.fileUrl;
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
};
