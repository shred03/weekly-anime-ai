const axios = require('axios');

module.exports = function setupRedeploy(bot, isAdmin, logger) {
    bot.command('redeploy', isAdmin, async (ctx) => {
        try {
            // Get SHA from environment variable (should be set by your CI/CD)
            const commitSHA = process.env.KOYEB_GIT_COMMIT_SHA || process.env.COMMIT_SHA;
            
            if (!commitSHA || !/^[0-9a-f]{40}$/.test(commitSHA)) {
                throw new Error('Valid Git SHA not available in environment variables');
            }

            const response = await axios.post(
                `https://app.koyeb.com/v1/services/${process.env.KOYEB_SERVICE_ID}/redeploy`,
                {
                    deployment_group: process.env.KOYEB_DEPLOYMENT_GROUP || "live",
                    sha: commitSHA,
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

            await ctx.reply(`🚀 Redeploy initiated successfully!\nCommit: ${commitSHA.substring(0, 7)}`);
            await logger.command(
                ctx.from.id,
                ctx.from.username || 'Unknown',
                'Redeploy command',
                'SUCCESS',
                `Redeploy triggered for commit: ${commitSHA}`
            );
        } catch (error) {
            console.error('Redeploy error:', error.response?.data || error.message);
            await ctx.reply(`❌ Redeploy failed: ${error.message}\nEnsure your deployment includes COMMIT_SHA environment variable`);
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