import { Bot, Middleware } from 'mirai-js'
import { config } from './config'
import { ServiceFactory } from './service'

(async () => {
    try {
        const bot = new Bot()
        await bot.open({
            verifyKey: config.verifyKey,
            baseUrl: config.baseUrl,
            qq: config.qq
        });

        const botSet: Set<number> = new Set()

        bot.on('GroupMessage', new Middleware()
            .groupFilter(config.groupList, true)
            .textProcessor()
            .messageIdProcessor()
            .use(async (ctx, next) => {
                if (botSet.has(ctx.sender?.id) || (await bot.getUserProfile({ qq: ctx.sender?.id })).level == 0) {
                    ctx.bot.recall({ messageId: ctx.messageId })
                    botSet.add(ctx.sender?.id)
                    return
                }
                await next()
            })
            .done(async (ctx) => {
                try {
                    await ServiceFactory.createService(ctx.text)?.service(ctx)
                } catch (e) {
                    console.error(e)
                }
            }))
        bot.on('FriendMessage', new Middleware()
            .textProcessor()
            .done(async (ctx) => {
                try {
                    await ServiceFactory.createService(ctx.text)?.service(ctx)
                } catch (e) {
                    console.error(e)
                }
            }))
    } catch (e) {
        console.error(e)
    }
})();