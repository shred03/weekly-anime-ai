require('dotenv').config();

const config = {
    TMDB_API_KEY: process.env.TMDB_API_KEY,
    TMDB_BASE_URL: 'https://api.themoviedb.org/3',
    BOT_TOKEN: process.env.BOT_TOKEN,
    ADMIN_IDS: process.env.ADMIN_IDS,
    DATABASE_FILE_CHANNELS: process.env.DATABASE_FILE_CHANNELS,
    FORCE_CHANNEL_ID: process.env.FORCE_CHANNEL_ID,
    FORCE_CHANNEL_USERNAME: process.env.FORCE_CHANNEL_USERNAME,
    AUTO_DELETE_FILES: process.env.AUTO_DELETE_FILES === 'true',
    AUTO_DELETE_TIME: process.env.AUTO_DELETE_TIME,
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
    KOYEB_API_KEY: process.env.KOYEB_API_KEY,
    KOYEB_SERVICE_ID: process.env.KOYEB_SERVICE_ID


}

module.exports = config;