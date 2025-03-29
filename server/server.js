const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();
const File = require('./models/File');
const Admin = require('./models/Admin');
const User = require('./models/User');
const setupBroadcast = require('./plugins/broadcast');
const descriptions = require('./script');
const shortenLink = require('./plugins/shortner');
const express = require('express');
const Logger = require('./logs/Logs');
const app = express();
const setupStats = require('./plugins/stats')
const setupPostCommand = require('./post/post');
const config = require('./config');
const setupTVPostCommand = require('./post/tvpost');
const {FORCE_CHANNELS} = require('./plugins/force');

const DATABASE_NAME = process.env.DATABASE_NAME

mongoose.connect(process.env.MONGODB_URI,{
    dbName: DATABASE_NAME,
    retryWrites: true,
    w: 'majority'
})
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

const bot = new Telegraf(config.BOT_TOKEN);
const ADMIN_IDS = config.ADMIN_IDS.split(',').map(id => parseInt(id));
const DATABASE_FILE_CHANNELS = config.DATABASE_FILE_CHANNELS.split(',').map(id => id.trim());
const AUTO_DELETE = config.AUTO_DELETE_FILES;
const DELETE_MINUTES = config.AUTO_DELETE_TIME;
const logger = new Logger(bot, config.LOG_CHANNEL_ID);
setupBroadcast(bot, logger);
setupStats(bot, logger)
setupPostCommand(bot, logger, ADMIN_IDS);
setupTVPostCommand(bot, logger, ADMIN_IDS);


const mainKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🏠 Home', 'home')],
    [
        Markup.button.callback('📌Join Channels', 'join_channels'),
        Markup.button.callback('ℹ️ About', 'about')
    ],
    [Markup.button.callback('📋 Commands', 'commands')],
]);

const isAdmin = async (ctx, next) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) {
        return ctx.reply('❌ 𝙊𝙣𝙡𝙮 𝙖𝙙𝙢𝙞𝙣𝙨 𝙘𝙖𝙣 𝙪𝙨𝙚 𝙩𝙝𝙞𝙨 𝙘𝙤𝙢𝙢𝙖𝙣𝙙');
    }
    return next();
};

const generateUniqueId = () => crypto.randomBytes(8).toString('hex');


const extractMessageInfo = (link) => {
    try {
        const url = new URL(link);
        const pathParts = url.pathname.split('/').filter(p => p !== '');
        
        // Handle numeric channel IDs (e.g., https://t.me/c/1234567890/123)
        if (pathParts[0] === 'c' && pathParts.length >= 3) {
            const channelId = `-100${pathParts[1]}`;
            const messageId = parseInt(pathParts[2]);
            return { channelId, messageId };
        }
        // Handle username-based links (e.g., https://t.me/my_channel/123)
        else if (pathParts.length >= 2) {
            const username = pathParts[0];
            const messageId = parseInt(pathParts[1]);
            return { username, messageId };
        }
        return null;
    } catch (error) {
        return null;
    }
};

const resolveChannelId = async (ctx, identifier) => {
    try {
        if (identifier.startsWith('@')) {
            const chat = await ctx.telegram.getChat(identifier);
            return chat.id.toString();
        }
        return identifier;
    } catch (error) {
        console.error('Channel resolution error:', error);
        return null;
    }
};

const getMessageFromChannel = async (ctx, channelIdOrUsername, messageId) => {
    try {
        const forwardedMsg = await ctx.telegram.forwardMessage(
            ctx.chat.id,
            channelIdOrUsername,
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

const storeFileFromMessage = async (message, uniqueId, adminId, channelId) => {
    const fileData = getFileDataFromMessage(message);
    if (fileData) {
        const newFile = new File({
            ...fileData,
            stored_by: adminId,
            file_link: message.link || 'NA',
            channel_id: channelId,
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
        for (const channel of FORCE_CHANNELS) {
            try {
                const member = await ctx.telegram.getChatMember(channel.id, userId);
                // If user is not a member of any one channel, return false
                if (['left', 'kicked'].includes(member.status)) {
                    return false;
                }
            } catch (error) {
                console.error(`Error checking membership for channel ${channel.id}:`, error);
                return false; // Assume failure means the user isn't a member
            }
        }
        return true; // If loop completes, user is a member of all channels
    } catch (error) {
        console.error('Error in checkChannelMembership:', error);
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
                'Failed to store',
                'No Link Provided'
            );
            return ctx.reply('Please provide the message link in the following format:\n/link https://t.me/c/xxxxx/123');
        }

        const messageInfo = extractMessageInfo(args[0]);
        if (!messageInfo) return ctx.reply('Invalid message link format.');

        // Resolve channel identifier
        const channelIdentifier = messageInfo.channelId || `@${messageInfo.username}`;
        const targetChannelId = await resolveChannelId(ctx, channelIdentifier);
        
        if (!targetChannelId || !DATABASE_FILE_CHANNELS.includes(targetChannelId)) {
            return ctx.reply('❌ This channel is not allowed for file storage.');
        }

        const message = await getMessageFromChannel(ctx, targetChannelId, messageInfo.messageId);
        if (!message) return ctx.reply('Message not found or not accessible.');

        const uniqueId = generateUniqueId();
        const stored = await storeFileFromMessage(message, uniqueId, ctx.from.id, targetChannelId);

        if (stored) {
            const retrievalLink = `https://t.me/${ctx.botInfo.username}?start=${uniqueId}`;
            const shortUrl = await shortenLink(retrievalLink, uniqueId);
            
            const responseMessage = [
                `✅ File stored successfully!`,
                `🔗 Original URL: <code>${retrievalLink}</code>`,
                `🔗 Short URL: <code>${shortUrl}</code>`
            ].join('\n');
        
            await ctx.reply(responseMessage, {parse_mode: 'HTML'});

            await logger.command(
                ctx.from.id,
                `${ctx.from.first_name} (${ctx.from.username || 'Untitled'})` || 'Unknown',
                'Link command used',
                'SUCCESS',
                `Single file stored \nURL: ${retrievalLink}`
            );
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
        await ctx.reply('Error storing file. Please check if the link is from an allowed channel.');
    }
});

bot.command(['batch', 'ml'], isAdmin, async (ctx) => {
    try {
        const args = ctx.message.text.split(' ').slice(1);
        if (args.length !== 2) {
            await logger.command(ctx.from.id, ctx.from.username || 'Unknown', 'Batch command used', 'FAILED', 'Invalid format');
            return ctx.reply('Format: /batch https://t.me/c/xxxxx/123 https://t.me/c/xxxxx/128');
        }

        // Extract message info from both links
        const startInfo = extractMessageInfo(args[0]);
        const endInfo = extractMessageInfo(args[1]);
        if (!startInfo || !endInfo) return ctx.reply('Invalid message links.');

        // Resolve channel IDs
        const startChannelId = await resolveChannelId(ctx, startInfo.channelId || `@${startInfo.username}`);
        const endChannelId = await resolveChannelId(ctx, endInfo.channelId || `@${endInfo.username}`);
        
        // Validate channels
        if (!startChannelId || !endChannelId) return ctx.reply('Invalid channel in links.');
        if (startChannelId !== endChannelId) return ctx.reply('Both links must be from the same channel.');
        if (!DATABASE_FILE_CHANNELS.includes(startChannelId)) {
            return ctx.reply('❌ This channel is not allowed for file storage.');
        }

        // Validate message range
        if (endInfo.messageId < startInfo.messageId || endInfo.messageId - startInfo.messageId > 100) {
            return ctx.reply('Invalid range. Maximum range is 100 messages.');
        }

        const uniqueId = generateUniqueId();
        const progressMsg = await ctx.reply('Processing messages...');
        
        const messageIds = Array.from(
            { length: endInfo.messageId - startInfo.messageId + 1 },
            (_, i) => startInfo.messageId + i
        );

        const BATCH_SIZE = 10;
        const files = [];
        
        for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
            const batch = messageIds.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (msgId) => {
                try {
                    const message = await ctx.telegram.forwardMessage(
                        ctx.chat.id,
                        startChannelId,
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
                                channel_id: startChannelId,
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
            // Save all files to database
            await File.insertMany(files);
            
            const retrievalLink = `https://t.me/${ctx.botInfo.username}?start=${uniqueId}`;
            const shortUrl = await shortenLink(retrievalLink, uniqueId);
            
            
            const responseMessage = [
                `✅ Stored ${files.length} files!`,
                `🔗 Original URL: <code>${retrievalLink}</code>`,
                `🔗 Short URL: <code>${shortUrl}</code>`
            ].join('\n');
        
            await ctx.reply(responseMessage, {parse_mode: 'HTML'});

            await logger.command(
                ctx.from.id,
                ctx.from.username || 'Unknown',
                'Batch command used',
                'SUCCESS',
                `Total ${files.length} files stored \n URL: ${retrievalLink}`,
            );
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
                    // Create buttons for all channels
                    const channelButtons = FORCE_CHANNELS.map(channel => 
                        Markup.button.url(`Join ${channel.name}`, `https://t.me/${channel.username}`),
                        Markup.button.url(`Try Again`, `https://t.me/${ctx.botInfo.username}?start=${uniqueId}`)
                    );
                    
                    // Add the check button at the end
                    const checkButton = Markup.button.callback('✅ I\'ve Joined', `check_join_${uniqueId}`);
                    const tryAgainButton = Markup.button.url(`Try Again`, `https://t.me/${ctx.botInfo.username}?start=${uniqueId}`);

                    const buttonRows = [
                        ...channelButtons.map(button => [button]), 
                        [checkButton],                             
                        [tryAgainButton]                           
                    ];
                    
                    const joinKeyboard = Markup.inlineKeyboard(buttonRows);
                    
                    await ctx.reply('😊 To access the files, please join of our channels:', joinKeyboard);
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

            if (AUTO_DELETE) {
                const warningMsg = await ctx.reply(`⚠️ Warning! These files will be automatically deleted in ${DELETE_MINUTES} minutes. Forward them now to keep copies!`);
                sentMessages.push(warningMsg.message_id);
            }

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
                setTimeout(async () => {
                    try {
                        for (const msgId of sentMessages) {
                            await ctx.telegram.deleteMessage(ctx.chat.id, msgId);
                        }

                        const fileDeleteWarningMsg = '<blockquote>🗑️ Files have been automatically deleted.</blockquote>';

                        await ctx.reply(fileDeleteWarningMsg, {parse_mode: 'HTML'});
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
            await ctx.answerCbQuery('😒 You haven\'t joined the channels yet!');
        } else {
            await ctx.deleteMessage();
            await ctx.reply('😍 Thank you for joining!');
        }
    } catch (error) {
        console.error('Error verifying membership:', error);
        await ctx.answerCbQuery('Error verifying channel membership.');
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
bot.action('join_channels', ctx => handleMenuAction(ctx, 'join_channels'));
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