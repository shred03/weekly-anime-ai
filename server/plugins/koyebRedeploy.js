const axios = require('axios');

/**
 * Setup Koyeb redeployment command plugin
 * @param {Object} bot - Telegraf bot instance
 * @param {Object} logger - Logger instance for logging operations
 * @param {Array} adminIds - Array of admin user IDs
 * @param {String} koyebApiKey - Koyeb API key
 * @param {String} koyebServiceId - Koyeb service ID
 */
function setupKoyebRedeploy(bot, logger, adminIds, koyebApiKey, koyebServiceId) {
    if (!koyebApiKey || !koyebServiceId) {
        console.warn('⚠️ Koyeb redeployment configuration is incomplete. The redeploy command will not work.');
        return;
    }

    const isAdmin = (ctx, next) => {
        if (!adminIds.includes(ctx.from.id)) {
            return ctx.reply('❌ Only admins can use this command');
        }
        return next();
    };

    bot.command(['restart', 'redeploy'], isAdmin, async (ctx) => {
        try {
            const progressMsg = await ctx.reply('🔄 Initiating redeployment on Koyeb...');

            // Send redeployment request to Koyeb API
            const response = await axios.post(
                `https://app.koyeb.com/v1/services/${koyebServiceId}/deployments`,
                {}, // Koyeb expects an empty object in the request body
                {
                    headers: {
                        'Authorization': `Bearer ${koyebApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.status === 201) {
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    progressMsg.message_id,
                    null,
                    '✅ Redeployment initiated successfully! The bot will restart shortly.'
                );

                await logger.command(
                    ctx.from.id,
                    ctx.from.username || 'Unknown',
                    'Bot redeploy command used',
                    'SUCCESS',
                    'Bot redeployment triggered on Koyeb'
                );
            } else {
                throw new Error(`Koyeb API returned unexpected status: ${response.status}`);
            }
        } catch (error) {
            console.error('Koyeb redeployment error:', error);
            
            let errorMessage = '❌ Failed to redeploy the bot';
            if (error.response) {
                errorMessage += `: ${error.response.data.message || error.response.statusText}`;
            } else if (error.message) {
                errorMessage += `: ${error.message}`;
            }
            
            await ctx.reply(errorMessage);
            
            await logger.error(
                ctx.from.id,
                ctx.from.username || 'Unknown',
                'Bot redeploy command',
                'FAILED',
                error.message || 'Unknown error'
            );
        }
    });

    console.log('✅ Koyeb redeployment plugin initialized');
}

module.exports = setupKoyebRedeploy;
