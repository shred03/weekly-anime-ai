const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

class Logger {
    constructor(bot, logChannelId) {
        this.bot = bot;
        this.logChannelId = logChannelId;
        this.logDir = path.join(__dirname, 'files');
        
        // Create logs directory if it doesn't exist
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    async log(type, userId, username, command, status, details = '') {
        try {
            const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
            const logEntry = {
                timestamp,
                type,
                userId,
                username,
                command,
                status,
                details
            };
            const safeUsername = username.replace(/_/g, '\\_');

            // Create log message
            const logMessage = `
📝 Bot Log Entry
Bot Name: [K-Drama Collection](https://t.me/k_drama_collection_bot)
⏰ Time: ${timestamp}
👤 User: ${safeUsername} 
👤 UserID: (${userId})
🤖 Command: ${command}
📊 Status: ${status}
🔍 Type: ${type}
${details ? `📋 Details: ${details}` : ''}`;

            // Save to file
            const fileName = `${format(new Date(), 'yyyy-MM-dd')}.log`;
            const filePath = path.join(this.logDir, fileName);
            const fileLogLine = `[${timestamp}] ${type} - User: ${username}(${userId}) - Command: ${command} - Status: ${status}${details ? ` - Details: ${details}` : ''}\n`;
            
            fs.appendFileSync(filePath, fileLogLine);

            // Send to Telegram channel
            if (this.logChannelId) {
                await this.bot.telegram.sendMessage(this.logChannelId, logMessage, {
                    parse_mode: 'Markdown'
                });
            }

            return true;
        } catch (error) {
            console.error('Logging error:', error);
            return false;
        }
    }

    // Helper methods for different types of logs
    async command(userId, username, command, status, details = '') {
        return this.log('COMMAND', userId, username, command, status, details);
    }

    async error(userId, username, command, error) {
        return this.log('ERROR', userId, username, command, 'FAILED', error.message);
    }

    async info(userId, username, action, status, details = '') {
        return this.log('INFO', userId, username, action, status, details);
    }

    async admin(userId, username, action, status, details = '') {
        return this.log('ADMIN', userId, username, action, status, details);
    }
}

module.exports = Logger;