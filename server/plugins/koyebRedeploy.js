const axios = require('axios');

module.exports = function setupRedeploy(bot, isAdmin, logger) {
    bot.command('redeploy', isAdmin, async (ctx) => {
        try {
            const response = await axios.post(
                `https://app.koyeb.com/v1/services/${process.env.KOYEB_SERVICE_ID}/redeploy`,
                {
                    deployment_group: process.env.KOYEB_DEPLOYMENT_GROUP || "live",
                    sha: process.env.KOYEB_SHA || "latest",
                    use_cache: true,
                    skip_build: false
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.KOYEB_API_KEY}`
                    }
                }
            );

            await ctx.reply('🚀 Redeploy initiated successfully!\nStatus: ' + response.data.status);
            await logger.command(
                ctx.from.id,
                ctx.from.username || 'Unknown',
                'Redeploy command',
                'SUCCESS',
                `Redeploy triggered by admin`
            );
        } catch (error) {
            console.error('Redeploy error:', error.response?.data || error.message);
            await ctx.reply('❌ Redeploy failed: ' + (error.response?.data?.message || error.message));
            await logger.error(
                ctx.from.id,
                ctx.from.username || 'Unknown',
                'Redeploy command',
                'FAILED',
                error.message
            );
        }
    });
};