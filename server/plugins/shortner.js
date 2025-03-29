const axios = require('axios');
const config = require('../config')

const shortenLink = async (originalUrl, uniqueId) => {
    const alisMsg = `TBATE${uniqueId}`
    try {
        const response = await axios.get('https://get2short.com/api', {

            params: {
                api: config.GETTOSHORT_API,
                url: originalUrl,
                alias: alisMsg,
            }
        });
        
        return response.data.shortenedUrl || null;
    } catch (error) {
        console.error('URL shortening failed:', error.message);
        return null;
    }
};

module.exports = shortenLink;