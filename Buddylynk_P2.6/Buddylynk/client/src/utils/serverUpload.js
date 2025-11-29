import axios from 'axios';
import { API_BASE_URL } from '../config/api';

// Upload via server (traditional multipart/form-data)
export const uploadViaServer = async (file, onProgress) => {
    try {
        console.log('📤 Uploading via server...');
        
        const formData = new FormData();
        formData.append('media', file);
        
        const response = await axios.post(`${API_BASE_URL}/upload/server`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
                if (progressEvent.lengthComputable && onProgress) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percentCompleted);
                }
            },
        });
        
        console.log('✅ Upload successful:', response.data.url);
        return response.data.url;
    } catch (error) {
        console.error('❌ Upload error:', error);
        throw error;
    }
};
