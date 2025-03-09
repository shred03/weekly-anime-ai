const axios = require('axios');
const { Markup } = require('telegraf');
const Logger = require('../logs/Logs');
const Post = require('../models/Post');
const config = require('../config')

const TMDB_API_KEY = config.TMDB_API_KEY
const TMDB_BASE_URL = config.TMDB_BASE_URL

/**
 * Setup TV show post command functionality for the bot
 * @param {Telegraf} bot - Telegraf bot instance
 * @param {Object} logger - Logger instance for logging command usage
 * @param {Array} ADMIN_IDS - Array of admin IDs allowed to use this command
 */
const setupTVShowPostCommand = (bot, logger, ADMIN_IDS) => {
    const isAdmin = async (ctx, next) => {
        if (!ADMIN_IDS.includes(ctx.from.id)) {
            return ctx.reply('❌ 𝙊𝙣𝙡𝙮 𝙖𝙙𝙢𝙞𝙣𝙨 𝙘𝙖𝙣 𝙪𝙨𝙚 𝙩𝙝𝙞𝙨 𝙘𝙤𝙢𝙢𝙖𝙣𝙙');
        }
        return next();
    };

    /**
     * Fetches TV show data from TMDB API by show name
     * @param {string} showName - Name of the TV show to search
     * @returns {Object|null} - TV show data object or null if not found
     */
    const fetchTVShowData = async (showName) => {
        try {
            // Search for the TV show
            const searchResponse = await axios.get(`${TMDB_BASE_URL}/search/tv`, {
                params: {
                    api_key: TMDB_API_KEY,
                    query: showName,
                    include_adult: false,
                    language: 'en-US',
                    page: 1
                }
            });

            if (!searchResponse.data.results || searchResponse.data.results.length === 0) {
                return null;
            }

            // Get the first result (most relevant)
            const showId = searchResponse.data.results[0].id;

            // Get detailed TV show info with images
            const showResponse = await axios.get(`${TMDB_BASE_URL}/tv/${showId}`, {
                params: {
                    api_key: TMDB_API_KEY,
                    language: 'en-US',
                    append_to_response: 'images'
                }
            });

            return showResponse.data;
        } catch (error) {
            console.error('Error fetching TV show data:', error);
            return null;
        }
    };

    /**
     * Formats TV show genres into a string
     * @param {Array} genres - Array of genre objects
     * @returns {string} - Formatted genre string
     */
    const formatGenres = (genres) => {
        return genres.map(genre => genre.name).join(', ');
    };

    /**
     * Creates a formatted TV show post
     * @param {Object} showData - TV show data from TMDB
     * @param {string} downloadLink - Link for the download button
     * @returns {Object} - Formatted post with caption and keyboard
     */
    const createTVShowPost = (showData, downloadLink) => {
        const firstAirYear = showData.first_air_date ? 
            new Date(showData.first_air_date).getFullYear() : 'N/A';
            
        const genres = formatGenres(showData.genres);
        const synopsis = showData.overview || 'No synopsis available';
        const episodeRuntime = showData.episode_run_time && showData.episode_run_time.length > 0 ? 
            showData.episode_run_time[0] : "NA";
        const seasons = showData.number_of_seasons || "NA";
        const episodes = showData.number_of_episodes || "NA";
        
        function formatRuntime(minutes) {
            if (!minutes || isNaN(minutes)) return "NA";
            
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
          
            return hours > 0 
              ? `${hours} hr ${remainingMinutes} min`
              : `${remainingMinutes} min`;
        }
        const formattedRuntime = formatRuntime(episodeRuntime);
        
        // Create the caption with quote formatting
        const caption = `<b>${showData.name} (${firstAirYear})</b>
     
╭━━━━━━━ ✦ ✦ ✦ ━━━━━━━╮
 ▸ 𝗔𝘂𝗱𝗶𝗼: Hindi+English+Korean (E-subs)
 ▸ 𝗤𝘂𝗮𝗹𝗶𝘁𝘆: 480p | 720p | 1080p 
 ▸ 𝗚𝗲𝗻𝗿𝗲: ${genres}
 ▸ 𝗘𝗽𝗶𝘀𝗼𝗱𝗲 𝗟𝗲𝗻𝗴𝘁𝗵: ${formattedRuntime}
 ▸ 𝗦𝗲𝗮𝘀𝗼𝗻𝘀: ${seasons} | 𝗘𝗽𝗶𝘀𝗼𝗱𝗲𝘀: ${episodes}
╰━━━━━━━ ✦ ✦ ✦ ━━━━━━━╯     

<blockquote><b>Powered By: @K_DRAMA_HUBS</b></blockquote>`;

        // Create the download button
        const inlineKeyboard = Markup.inlineKeyboard([
            Markup.button.url('📥 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱 𝗡𝗼𝘄', downloadLink)
        ]);

        return {
            caption,
            keyboard: inlineKeyboard
        };
    };

    /**
     * Gets the backdrop image URL for a TV show in specified high resolution
     * @param {Object} showData - TV show data from TMDB
     * @returns {string|null} - Backdrop URL or null if not available
     */
    const getTVShowBackdropUrl = (showData) => {
        // Check if we have images appended to the response
        if (showData.images && showData.images.backdrops && showData.images.backdrops.length > 0) {
            // Sort backdrops by size to find HD ones (prefer 1920x1080 or 2560x1440)
            const backdrops = showData.images.backdrops.sort((a, b) => {
                // First try to find ones with exactly the desired resolutions
                const aIsPreferred = (a.width === 2560 && a.height === 1440) || (a.width === 1920 && a.height === 1080);
                const bIsPreferred = (b.width === 2560 && b.height === 1440) || (b.width === 1920 && b.height === 1080);
                
                if (aIsPreferred && !bIsPreferred) return -1;
                if (!aIsPreferred && bIsPreferred) return 1;
                
                // If neither or both match the preferred resolution, sort by total pixels (higher is better)
                return (b.width * b.height) - (a.width * a.height);
            });
            
            // Use the first (highest quality) backdrop
            return `https://image.tmdb.org/t/p/original${backdrops[0].file_path}`;
        } 
        // Fallback to the main backdrop
        else if (showData.backdrop_path) {
            return `https://image.tmdb.org/t/p/original${showData.backdrop_path}`;
        }
        
        // Fallback to poster if no backdrop is available
        if (showData.poster_path) {
            return `https://image.tmdb.org/t/p/original${showData.poster_path}`;
        }
        
        return null;
    };

    bot.command(['setsticker', 'ss'], isAdmin, async (ctx) => {
        try {
            // Check if a sticker is forwarded or mentioned
            const repliedMessage = ctx.message.reply_to_message;
            
            if (!repliedMessage || !repliedMessage.sticker) {
                return ctx.reply('❌ Please forward or reply to a sticker with this command');
            }

            const stickerId = repliedMessage.sticker.file_id;

            // Get the admin's current channel setting
            const postSetting = await Post.getLatestForAdmin(ctx.from.id);
            
            if (!postSetting) {
                return ctx.reply('❌ No channel set. Please use /setchannel command first.');
            }

            // Update the post setting with the sticker ID
            await Post.findOneAndUpdate(
                { adminId: ctx.from.id },
                { 
                    stickerId,
                    updatedAt: new Date()
                },
                { upsert: true, new: true }
            );

            await logger.command(
                ctx.from.id,
                `${ctx.from.first_name} (${ctx.from.username || 'Untitled'})` || 'Unknown',
                'Set sticker command used',
                'SUCCESS',
                `Sticker set: ${stickerId}`
            );

            return ctx.reply(`✅ Sticker has been set for your channel posts.`);
            
        } catch (error) {
            console.error('Error setting sticker:', error);
            await logger.error(
                ctx.from.id,
                `${ctx.from.first_name} (${ctx.from.username || 'Untitled'})` || 'Unknown',
                'Set sticker command used',
                'FAILED',
                error.message
            );
            return ctx.reply('Error setting sticker. Please try again.');
        }
    });

    bot.command(['setchannel', 'sc'], isAdmin, async (ctx) => {
        try {
            const args = ctx.message.text.split(' ').slice(1);
            
            if (args.length < 1) {
                return ctx.reply('Please provide a channel ID or username in the format: \n/setchannel @channelUsername\nor\n/setchannel -100xxxxxxxxxx');
            }

            let channelId = args[0];
            let channelUsername = null;

            // Handle username format
            if (channelId.startsWith('@')) {
                channelUsername = channelId.substring(1); // Remove the @ symbol
                try {
                    // Try to get the numeric ID from the username
                    const chat = await ctx.telegram.getChat(channelId);
                    channelId = chat.id.toString();
                } catch (error) {
                    return ctx.reply(`❌ Couldn't find the channel ${channelId}. Make sure the bot is added to the channel as an admin.`);
                }
            }

            // Verify the bot has permission to post in the channel
            try {
                const botMember = await ctx.telegram.getChatMember(channelId, ctx.botInfo.id);
                const requiredPermissions = ['can_post_messages'];
                
                const missingPermissions = requiredPermissions.filter(perm => !botMember[perm]);
                
                if (missingPermissions.length > 0) {
                    return ctx.reply(`❌ Bot lacks the necessary permissions in this channel. Please make the bot an admin with posting privileges.`);
                }
            } catch (error) {
                return ctx.reply('❌ Cannot verify bot permissions in this channel. Make sure the bot is an admin in the channel.');
            }

            // Save the channel setting
            await Post.findOneAndUpdate(
                { adminId: ctx.from.id },
                { 
                    channelId,
                    channelUsername,
                    adminId: ctx.from.id,
                    updatedAt: new Date()
                },
                { upsert: true, new: true }
            );

            await logger.command(
                ctx.from.id,
                `${ctx.from.first_name} (${ctx.from.username || 'Untitled'})` || 'Unknown',
                'Set channel command used',
                'SUCCESS',
                `Channel set to ${channelUsername ? '@' + channelUsername : channelId}`
            );

            return ctx.reply(`✅ Channel ${channelUsername ? '@' + channelUsername : channelId} has been set as your default posting channel.`);
            
        } catch (error) {
            console.error('Error setting channel:', error);
            await logger.error(
                ctx.from.id,
                `${ctx.from.first_name} (${ctx.from.username || 'Untitled'})` || 'Unknown',
                'Set channel command used',
                'FAILED',
                error.message
            );
            return ctx.reply('Error setting channel. Please try again.');
        }
    });

    // Register the TV show post command
    bot.command(['post', 'tp'], isAdmin, async (ctx) => {
        try {
            const args = ctx.message.text.split(' ').slice(1);
            
            // Check if command has the right format
            if (args.length < 2) {
                await logger.command(
                    ctx.from.id,
                    `${ctx.from.first_name} (${ctx.from.username || 'Untitled'})` || 'Unknown',
                    'TV post command used',
                    'FAILED',
                    'Invalid format'
                );
                return ctx.reply('Please use the format: /tvpost <showName> <downloadLink>');
            }

            // Extract download link (last argument)
            const downloadLink = args[args.length - 1];
            
            // Extract show name (all arguments except the last one)
            const showName = args.slice(0, args.length - 1).join(' ');

            // Fetch TV show data from TMDB
            const processingMsg = await ctx.reply('⌛ Fetching TV show data and HD backdrop...');
            const showData = await fetchTVShowData(showName);

            if (!showData) {
                await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
                await logger.command(
                    ctx.from.id,
                    `${ctx.from.first_name} (${ctx.from.username || 'Untitled'})` || 'Unknown',
                    'TV post command used',
                    'FAILED',
                    `TV show not found: ${showName}`
                );
                return ctx.reply(`❌ Could not find TV show: "${showName}"`);
            }

            // Create the TV show post
            const post = createTVShowPost(showData, downloadLink);
            
            // Get the TV show backdrop image in HD
            const backdropUrl = getTVShowBackdropUrl(showData);
            
            // Delete processing message
            await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
            
            // Get the admin's channel setting
            const postSetting = await Post.getLatestForAdmin(ctx.from.id);
            
            if (!postSetting) {
                await logger.command(
                    ctx.from.id,
                    `${ctx.from.first_name} (${ctx.from.username || 'Untitled'})` || 'Unknown',
                    'TV post command used',
                    'FAILED',
                    'No channel set'
                );
                return ctx.reply('❌ No channel set. Please use /setchannel command first.');
            }

            const channelInfo = postSetting.channelUsername ? 
                `@${postSetting.channelUsername}` : 
                postSetting.channelId;
            
            // Create unique ID for this post to use with action buttons
            const postId = `tv_${ctx.from.id}_${Date.now()}`;
            
            // Create confirmation buttons
            const confirmationButtons = Markup.inlineKeyboard([
                [
                    Markup.button.callback('✅ Post to Channel', `confirm_tv_post_${postId}`),
                    Markup.button.callback('❌ Cancel', `cancel_tv_post_${postId}`)
                ]
            ]);

            // Store the necessary post data with the postId
            bot.context.tvPostData = bot.context.tvPostData || {};
            bot.context.tvPostData[postId] = {
                showData,
                downloadLink,
                backdropUrl,
                post,
                channelId: postSetting.channelId,
                channelInfo
            };
            
            // Send post preview to admin with confirmation buttons
            if (backdropUrl) {
                await ctx.replyWithPhoto(backdropUrl, {
                    caption: `<b>Preview:</b>\n\n${post.caption}\n\n<i>Ready to post to ${channelInfo}</i>`,
                    parse_mode: 'HTML',
                    ...post.keyboard
                });
            } else {
                await ctx.reply(`<b>Preview:</b>\n\n${post.caption}\n\n<i>Ready to post to ${channelInfo}</i>`, {
                    parse_mode: 'HTML',
                    ...post.keyboard
                });
            }
            
            // Send confirmation message with buttons
            await ctx.reply('Would you like to post this TV show to your channel?', confirmationButtons);
            
            // Log the creation of post preview
            await logger.command(
                ctx.from.id,
                `${ctx.from.first_name} (${ctx.from.username || 'Untitled'})` || 'Unknown',
                'TV post command used',
                'SUCCESS',
                `Created post preview for TV show: ${showData.name}`
            );
            
        } catch (error) {
            console.error('Error in TV post command:', error);
            await logger.error(
                ctx.from.id,
                `${ctx.from.first_name} (${ctx.from.username || 'Untitled'})` || 'Unknown',
                'TV post command used',
                'FAILED',
                error.message
            );
            await ctx.reply('Error creating TV show post. Please try again.');
        }
    });
    
    // Handle confirm TV post action
    bot.action(/^confirm_tv_post_(.+)$/, async (ctx) => {
        try {
            const postId = ctx.match[1];
            
            // Access post data from bot context
            if (!bot.context.tvPostData || !bot.context.tvPostData[postId]) {
                await ctx.answerCbQuery('❌ TV show post data not found');
                return ctx.editMessageText('Unable to find TV show post data. Please create a new post.');
            }
            
            const postData = bot.context.tvPostData[postId];
            
            // Get the admin's channel setting again to ensure we have the latest
            const postSetting = await Post.getLatestForAdmin(ctx.from.id);
            
            // Send post to channel
            let sentMessage;
            if (postData.backdropUrl) {
                sentMessage = await ctx.telegram.sendPhoto(postData.channelId, postData.backdropUrl, {
                    caption: postData.post.caption,
                    parse_mode: 'HTML',
                    ...postData.post.keyboard
                });
            } else {
                sentMessage = await ctx.telegram.sendMessage(postData.channelId, postData.post.caption, {
                    parse_mode: 'HTML',
                    ...postData.post.keyboard
                });
            }

            // Forward sticker if set
            if (postSetting && postSetting.stickerId) {
                try {
                    await ctx.telegram.sendSticker(postData.channelId, postSetting.stickerId);
                } catch (stickerError) {
                    console.error('Error sending sticker:', stickerError);
                    // Optionally log the sticker sending error, but don't stop the post process
                }
            }
            
            // Show success message
            await ctx.answerCbQuery('✅ TV show post sent to channel!');
            await ctx.editMessageText(`✅ Post for "${postData.showData.name}" has been sent to ${postData.channelInfo} successfully!`);
            
            // Log successful post
            await logger.command(
                ctx.from.id,
                `${ctx.from.first_name} (${ctx.from.username || 'Untitled'})` || 'Unknown',
                'TV post to channel',
                'SUCCESS',
                `Posted ${postData.showData.name} to channel ${postData.channelInfo}`
            );
            
            // Clean up stored data
            delete bot.context.tvPostData[postId];
            
        } catch (error) {
            console.error('Error sending TV show post to channel:', error);
            await ctx.answerCbQuery('❌ Error sending TV show post');
            await ctx.editMessageText('Error sending TV show post to channel. Please check bot permissions and try again.');
            
            await logger.error(
                ctx.from.id,
                `${ctx.from.first_name} (${ctx.from.username || 'Untitled'})` || 'Unknown',
                'TV post to channel',
                'FAILED',
                error.message
            );
        }
    });
    
    // Handle cancel TV post action
    bot.action(/^cancel_tv_post_(.+)$/, async (ctx) => {
        try {
            const postId = ctx.match[1];
            
            // Clean up stored data if it exists
            if (bot.context.tvPostData && bot.context.tvPostData[postId]) {
                delete bot.context.tvPostData[postId];
            }
            
            await ctx.answerCbQuery('TV show post cancelled');
            await ctx.editMessageText('❌ TV show post cancelled.');
            
        } catch (error) {
            console.error('Error cancelling TV show post:', error);
            await ctx.answerCbQuery('Error cancelling TV show post');
            await ctx.editMessageText('Error occurred while cancelling TV show post.');
        }
    });
};

module.exports = setupTVShowPostCommand;