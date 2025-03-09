const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();
const File = require('./models/File');
const Admin = require('./models/Admin');
const User = require('./models/User');
const setupBroadcast = require('./plugins/broadcast');
const descriptions = require('./script');
const express = require('express');
const Logger = require('./logs/Logs');
const app = express();
const setupStats = require('./plugins/stats');
const shortenLink = require('./utils/linkShortener');
const setupTVShowPostCommand = require('./plugins/post');
const config = require('./config');



mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.DATABASE_NAME,
    retryWrites: true,
    w: 'majority',
})
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_IDS = config.ADMIN_IDS.split(',').map(id => parseInt(id));
const FILE_DATABASE_CHANNEL = config.FILE_DATABASE_CHANNEL;
const FORCE_CHANNEL_ID = config.FORCE_CHANNEL_ID;
const FORCE_CHANNEL_USERNAME = config.FORCE_CHANNEL_USERNAME;
const AUTO_DELETE = config.AUTO_DELETE_FILES === 'true';
const DELETE_MINUTES = parseInt(config.AUTO_DELETE_TIME) || 10 ;
const logger = new Logger(bot, config.LOG_CHANNEL_ID);
setupBroadcast(bot, logger);
setupStats(bot, logger);
setupTVShowPostCommand(bot, logger, ADMIN_IDS);

const mainKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🏠 Home', 'home')],
    [
        Markup.button.callback('🛠 Support', 'support'),
        Markup.button.callback('ℹ️ About', 'about')
    ],
    [Markup.button.callback('📋 Commands', 'commands')],
]);

const isAdmin = async (ctx, next) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) {
        return ctx.reply('❌ 𝑬𝒙𝒄𝒍𝒖𝒔𝒊𝒗𝒆 𝑴𝒆𝒎𝒃𝒆𝒓 𝑪𝒐𝒎𝒎𝒂𝒏𝒅');
    }
    return next();
};
const generateUniqueId = () => crypto.randomBytes(8).toString('hex');

const extractMessageId = (link) => {
    try {
        const url = new URL(link);
        return parseInt(url.pathname.split('/').pop());
    } catch (error) {
        return null;
    }
};

const getMessageFromChannel = async (ctx, messageId) => {
    try {
        const forwardedMsg = await ctx.telegram.forwardMessage(
            ctx.chat.id,
            FILE_DATABASE_CHANNEL,
            messageId,
            { disable_notification: true }
        );
        await ctx.telegram.deleteMessage(ctx.chat.id, forwardedMsg.message_id);
        return forwardedMsg;
    } catch (error) {
        console.error('Error getting message:', error);
        return null;
    }
};

const getFileDataFromMessage = (message) => {
    const originalCaption = message.caption || '';
    
    if (message.document) {
        return {
            file_name: message.document.file_name,
            file_id: message.document.file_id,
            file_type: 'document',
            original_caption: originalCaption
        };
    } else if (message.photo) {
        return {
            file_name: 'photo.jpg',
            file_id: message.photo[message.photo.length - 1].file_id,
            file_type: 'photo',
            original_caption: originalCaption
        };
    } else if (message.video) {
        return {
            file_name: message.video.file_name || 'video.mp4',
            file_id: message.video.file_id,
            file_type: 'video',
            original_caption: originalCaption
        };
    } else if (message.animation) {
        return {
            file_name: 'animation.gif',
            file_id: message.animation.file_id,
            file_type: 'animation',
            original_caption: originalCaption
        };
    } else if (message.sticker) {
        return {
            file_name: 'sticker.webp',
            file_id: message.sticker.file_id,
            file_type: 'sticker',
            original_caption: originalCaption
        };
    }
    return null;
};

const sendFile = async (ctx, file) => {
    const caption = file.original_caption || '';
    switch (file.file_type) {
        case 'document':
            return await ctx.telegram.sendDocument(ctx.chat.id, file.file_id, { caption });
        case 'photo':
            return await ctx.telegram.sendPhoto(ctx.chat.id, file.file_id, { caption });
        case 'video':
            return await ctx.telegram.sendVideo(ctx.chat.id, file.file_id, { caption });
        case 'animation':
            return await ctx.telegram.sendAnimation(ctx.chat.id, file.file_id, { caption });
        case 'sticker':
            return await ctx.telegram.sendSticker(ctx.chat.id, file.file_id);
    }
};

const storeFileFromMessage = async (message, uniqueId, adminId) => {
    const fileData = getFileDataFromMessage(message);
    if (fileData) {
        const newFile = new File({
            ...fileData,
            stored_by: adminId,
            file_link: message.link,
            channel_id: FILE_DATABASE_CHANNEL,
            is_multiple: true,
            unique_id: uniqueId,
            message_id: message.message_id
        });
        await newFile.save();
        return true;
    }
    return false;
};

const checkChannelMembership = async (ctx, userId) => {
    try {
        const member = await ctx.telegram.getChatMember(FORCE_CHANNEL_ID, userId);
        return !['left', 'kicked'].includes(member.status);
    } catch (error) {
        console.error('Error checking channel membership:', error);
        return false;
    }
};

bot.command(['link', 'sl'], isAdmin, async (ctx) => {
    try {
        const args = ctx.message.text.split(' ').slice(1);
        if (args.length === 0) {
            await logger.command(
                ctx.from.id,
                ctx.message.text,
                `${ctx.from.first_name} (${ctx.from.username || 'Untitled'})` || 'Unknown',
                'Link command used',
                'FAILED',
                'No Link Provided'
            );
            return ctx.reply('Please provide the message link in the following format:\n/link https://t.me/c/xxxxx/123');
        }

        const messageId = extractMessageId(args[0]);
        if (!messageId) return ctx.reply('Invalid message link format.');

        const message = await getMessageFromChannel(ctx, messageId);
        if (!message) return ctx.reply('Message not found or not accessible.');

        const uniqueId = generateUniqueId();
        const stored = await storeFileFromMessage(message, uniqueId, ctx.from.id);

        if (stored) {
            const retrievalLink = `https://t.me/${ctx.botInfo.username}?start=${uniqueId}`;
            const shortUrl = await shortenLink(retrievalLink, uniqueId);
            
            const responseMessage = [
                '✅ File Stored Successfully!',
                `🔗 Original URL: ${retrievalLink}`,
                shortUrl ? `🔗 Shortened URL: ${shortUrl}` : '(URL shortening service unavailable)'
            ].join('\n');
        
            await ctx.reply(responseMessage);
        }
    } catch (error) {
        await logger.error(
            ctx.from.id,
            `${ctx.from.first_name} (${ctx.from.username || 'Untitled'})` || 'Unknown',
            'Link command used',
            'FAILED',
            error.message
        );
        console.error('Error storing file from link:', error);
        await ctx.reply('Error storing file. Please check if the link is from the file database channel channel.');
    }
});
bot.command(['batch', 'ml'], isAdmin, async (ctx) => {
    try {
        const args = ctx.message.text.split(' ').slice(1);
        if (args.length !== 2) {
            await logger.command(ctx.from.id, ctx.from.username || 'Unknown', 'Batch command used', 'FAILED', 'Invalid format');
            return ctx.reply('Format: /batch https://t.me/c/xxxxx/123 https://t.me/c/xxxxx/128');
        }

        const startId = parseInt(args[0].split('/').pop());
        const endId = parseInt(args[1].split('/').pop());
        
        if (!startId || !endId || endId < startId || endId - startId > 100) {
            return ctx.reply('Invalid range. Maximum range is 100 messages.');
        }

        const uniqueId = generateUniqueId();
        const progressMsg = await ctx.reply('Processing messages...');
        
        const messageIds = Array.from({ length: endId - startId + 1 }, (_, i) => startId + i);
        const BATCH_SIZE = 10;
        const files = [];
        
        for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
            const batch = messageIds.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (msgId) => {
                try {
                    const message = await ctx.telegram.forwardMessage(
                        ctx.chat.id,
                        FILE_DATABASE_CHANNEL,
                        msgId,
                        { disable_notification: true }
                    );
                    
                    if (message) {
                        const fileData = getFileDataFromMessage(message);
                        if (fileData) {
                            files.push({
                                ...fileData,
                                stored_by: ctx.from.id,
                                unique_id: uniqueId,
                                message_id: msgId
                            });
                        }
                    }
                    await ctx.telegram.deleteMessage(ctx.chat.id, message.message_id);
                } catch (error) {
                    console.error(`Error processing message ${msgId}:`, error);
                }
            }));
            
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                progressMsg.message_id,
                null,
                `Processing: ${Math.min(i + BATCH_SIZE, messageIds.length)}/${messageIds.length} messages`
            );
        }

        if (files.length > 0) {
            const retrievalLink = `https://t.me/${ctx.botInfo.username}?start=${uniqueId}`;
            const shortUrl = await shortenLink(retrievalLink, uniqueId);
            
            const responseMessage = [
                `✅ Stored ${files.length} files!`,
                `🔗 Original URL: ${retrievalLink}`,
                shortUrl ? `🔗 Shortened URL: ${shortUrl}` : '(URL shortening service unavailable)'
            ].join('\n');
        
            await ctx.reply(responseMessage);
        }
        await ctx.telegram.deleteMessage(ctx.chat.id, progressMsg.message_id);
        
    } catch (error) {
        await logger.error(ctx.from.id, ctx.from.username || 'Unknown', 'Batch command', 'FAILED', error.message);
        await ctx.reply('Error processing files. Please try again.');
    }
});

bot.command('start', async (ctx) => {
    try {
        await User.findOneAndUpdate(
            { user_id: ctx.from.id },
            {
                user_id: ctx.from.id,
                username: ctx.from.username,
                first_name: ctx.from.first_name,
                last_name: ctx.from.last_name
            },
            { upsert: true, new: true }
        );

        const uniqueId = ctx.message.text.split(' ')[1];
        
        if (uniqueId) {
            const files = await File.find({ unique_id: uniqueId }).sort({ message_id: 1 });
            if (!files.length) return ctx.reply('Files not found.');

            if (!ADMIN_IDS.includes(ctx.from.id)) {
                const isMember = await checkChannelMembership(ctx, ctx.from.id);
                if (!isMember) {
                    const joinKeyboard = Markup.inlineKeyboard([
                        Markup.button.url('Join Channel', `https://t.me/${FORCE_CHANNEL_USERNAME}`),
                        Markup.button.callback('✅ I\'ve Joined', `check_join_${uniqueId}`)
                    ]);
                    await ctx.reply('⚠️ To access the files, please join our channel first.', joinKeyboard);
                    return;
                }
            }

            const admin = files[0].stored_by ? await Admin.findOne({ admin_id: files[0].stored_by }) : null;

            await logger.command(
                ctx.from.id,
                `${ctx.from.first_name} (${ctx.from.username || 'Untitled'})` || 'Unknown',
                'File retrieval command used',
                'SUCCESS',
                `Retrieved ${files.length} files with URL: https://t.me/${ctx.botInfo.username}?start=${uniqueId}`
            );

            let sendingMsg = await ctx.reply(`⌛️ Sending ${files.length} file(s)...`);
            const sentMessages = [];

            for (const file of files) {
                try {
                    const sentMessage = await sendFile(ctx, file);
                    if (sentMessage) {
                        sentMessages.push(sentMessage.message_id);
                    }
                } catch (error) {
                    console.error(`Error sending file ${file.file_name}:`, error);
                }
            }

            await ctx.telegram.deleteMessage(ctx.chat.id, sendingMsg.message_id);
            const completionMsg = await ctx.reply('✅ All files sent!');
            sentMessages.push(completionMsg.message_id);

            if (AUTO_DELETE) {
                const warningMsg = await ctx.reply(`⚠️ 𝐀𝐥𝐞𝐫𝐭! 𝐅𝐢𝐥𝐞𝐬 𝐰𝐢𝐥𝐥 𝐛𝐞 𝐝𝐞𝐥𝐞𝐭𝐞𝐝 𝐢𝐧 ${DELETE_MINUTES} 𝐦𝐢𝐧𝐮𝐭𝐞𝐬 𝐭𝐨 𝐚𝐯𝐨𝐢𝐝 𝐜𝐨𝐩𝐲𝐫𝐢𝐠𝐡𝐭 𝐬𝐨 𝐟𝐨𝐫𝐰𝐚𝐫𝐝 𝐭𝐡𝐞𝐦 𝐧𝐨𝐰 𝐭𝐨 𝐤𝐞𝐞𝐩 𝐜𝐨𝐩𝐢𝐞𝐬!`);
                sentMessages.push(warningMsg.message_id);
            }

            if (AUTO_DELETE) {
                setTimeout(async () => {
                    try {
                        for (const msgId of sentMessages) {
                            await ctx.telegram.deleteMessage(ctx.chat.id, msgId);
                        }
                        await ctx.reply('🗑️ Files have been automatically deleted.');
                    } catch (error) {
                        console.error('Auto-delete error:', error);
                    }
                }, DELETE_MINUTES * 60 * 1000);
            }
        } else {
            await logger.command(
                ctx.from.id,
                `${ctx.from.first_name} (${ctx.from.username || 'Untitled'})` || 'Unknown',
                'start command used',
                'SUCCESS',
                'Welcome message sent!'
            );

            await ctx.replyWithPhoto(descriptions.welcome_image, {
                caption: `Hello ${ctx.from.first_name}\n\n${descriptions.welcome_text}`,
                parse_mode: 'Markdown',
                ...mainKeyboard
            });
        }
    } catch (error) {
        await logger.error(
            ctx.from.id,
            `${ctx.from.first_name} (${ctx.from.username || 'Untitled'})` || 'Unknown',
            'Start command used',
            'FAILED',
            error.message
        );
        await ctx.reply('Error starting bot. Please try again.');
    }
});

bot.action(/^check_join_(.+)/, async (ctx) => {
    const uniqueId = ctx.match[1];
    try {
        const isMember = await checkChannelMembership(ctx, ctx.from.id);
        if (!isMember) {
            await ctx.answerCbQuery('❌ You haven\'t joined the channel yet!');
        } else {
            await ctx.deleteMessage();
            await ctx.reply('Go back to the post and click again to get the files');
        }
    } catch (error) {
        await ctx.answerCbQuery('Error verifying membership.');
    }
});

// Helper function for menu actions
const handleMenuAction = async (ctx, action) => {
    try {
        const caption = action === 'home' 
            ? `Hello ${ctx.from.first_name}\n\n${descriptions[action]}`
            : descriptions[action];
            
        await ctx.editMessageCaption(caption, {
            parse_mode: 'Markdown',
            ...mainKeyboard
        });
    } catch (error) {
        console.error(`Error handling ${action} button:`, error);
    }
};

// Menu actions
bot.action('home', ctx => handleMenuAction(ctx, 'home'));
bot.action('support', ctx => handleMenuAction(ctx, 'support'));
bot.action('about', ctx => handleMenuAction(ctx, 'about'));
bot.action('commands', ctx => handleMenuAction(ctx, 'commands'));

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Health check server is running on port ${PORT}`);
});

const startBot = async () => {
    try {
        await bot.launch();
        console.log('✅ Bot is running...');
    } catch (error) {
        console.error('❌ Error starting bot:', error);
    }
};

startBot();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));