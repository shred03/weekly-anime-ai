const axios = require('axios');
require('dotenv').config();

const shortenLink = async (originalUrl, uniqueId) => {
    try {
        const response = await axios.get('https://shrinkme.io/api', {
            params: {
                api: process.env.SHRINKME_API_KEY,
                url: originalUrl,
                alias: uniqueId
            }
        });
        
        return response.data.shortenedUrl || null;
    } catch (error) {
        console.error('URL shortening failed:', error.message);
        return null;
    }
};

module.exports = shortenLink;