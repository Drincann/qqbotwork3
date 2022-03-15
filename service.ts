import { Bot, Message } from "mirai-js";
import { ChatBot, ChatBotFactory } from "./chat"; './chat'
import { config } from './config'
import cron from 'node-cron'
const adminQQ = new Set(config.adminQQ)
interface MiraiJSContext {
    type: 'FriendMessage' | 'GroupMessage';
    bot: Bot;
    text: string;
    sender: {
        id: number;
        group: {
            id: number;
        }
    };
}

export abstract class Service {
    protected constructor() { }
    protected state: 'open' | 'close' = 'open'
    abstract getStartWith(): string[]
    abstract service(data: MiraiJSContext): Promise<void>
    public open(): void {
        this.state = 'open'
    }
    public close(): void {
        this.state = 'close'
    }
}

// group normal
class ChatService extends Service {
    protected constructor() { super() }
    static instance: Service | null = null
    private chatBot: ChatBot | null = ChatBotFactory.createChatBot(config.whichBot as 'Turing' | 'MoLi')
    static getInstance(): Service {
        if (!ChatService.instance) {
            ChatService.instance = new ChatService()
        }
        return ChatService.instance
    }

    getStartWith(): string[] {
        return [""]
    }

    async service(data: MiraiJSContext): Promise<void> {
        if (data.type != 'GroupMessage') return
        if (this.state == 'close') return
        await data.bot.sendMessage({
            group: data.sender?.group?.id,
            message: await this.chatBot?.chat(data.text, data.sender?.id?.toString())
        })
    }

    checkBot(which: 'MoLi' | 'Turing'): void {
        if (which == 'MoLi') {
            this.chatBot = ChatBotFactory.createChatBot('MoLi')
        } else if (which == 'Turing') {
            this.chatBot = ChatBotFactory.createChatBot('Turing')
        } else {
            throw new Error('不支持的机器人')
        }
    }
}

// friend admin
class BotSwitcherService extends Service {
    protected constructor() { super() }
    static instance: Service | null = null;

    static getInstance(): Service {
        if (!BotSwitcherService.instance) {
            BotSwitcherService.instance = new BotSwitcherService()
        }
        return BotSwitcherService.instance
    }
    getStartWith(): string[] {
        return ["/setbot"]
    }

    async service(data: MiraiJSContext): Promise<void> {
        if (data.type != 'FriendMessage') return
        if (!adminQQ.has(data.sender?.id)) return
        const state: string | undefined = data.text.trim().match(/^\/setbot\s+(\w+)/)?.[1]
            ;
        if (state === 'open') {
            serviceMatchList.forEach(service => service.open())
        } else if (state === 'close') {
            serviceMatchList.forEach(service => service.close())
        } else {
            await data.bot.sendMessage({
                friend: data?.sender?.group?.id,
                message: new Message().addText(`请输入正确的命令, 用法 /setbot [open | close]`)
            })
            return
        }
        data.bot.sendMessage({
            friend: data.sender?.id,
            message: new Message().addText('设置成功'),
        })
    }
}

// friend admin
class BotTimerSwitcherService extends Service {
    protected constructor() { super() }
    static instance: Service | null = null;
    static getInstance(): Service {
        if (!BotTimerSwitcherService.instance) {
            BotTimerSwitcherService.instance = new BotTimerSwitcherService()
        }
        return BotTimerSwitcherService.instance
    }
    getStartWith(): string[] {
        return ["/setopen"]
    }

    async service(data: MiraiJSContext): Promise<void> {
        try {
            if (data.type != 'FriendMessage') return
            if (!adminQQ.has(data.sender?.id)) return
            const matched: RegExpMatchArray | null = data.text.trim().match(/^\/setopen\s+(\d{1,2}:\d{1,2})-(\d{1,2}:\d{1,2})/)
            const starttime = matched?.[1]
            const endtime = matched?.[2]
            if (starttime == undefined || endtime == undefined) {
                throw new Error('未匹配到有效起止时间')
            }

            const [starthour, startmin] = starttime.split(':')?.map(str => Number.parseInt(str))
            const [endhour, endmin] = endtime.split(':')?.map(str => Number.parseInt(str))
            if (starthour * 60 + startmin > endhour * 60 + endmin) {
                throw new Error('起始时间不能大于结束时间')
            }
            cron.getTasks().forEach(task => task.stop())
            cron.schedule(`* ${startmin} ${starthour} * * *`, () => {
                serviceMatchList.forEach(service => service.open())
            })
            cron.schedule(`* ${endmin} ${endhour} * * *`, () => {
                serviceMatchList.forEach(service => service.close())
            })
            data.bot.sendMessage({
                friend: data.sender?.id,
                message: new Message().addText('设置成功'),
            })

        } catch (e) {
            if (e instanceof Error) {
                await data.bot.sendMessage({
                    friend: data.sender?.id,
                    message: new Message().addText(`请输入正确的命令, 用法 /setopen HH:MM-HH:MM\n`).addText(`error: ${e.message}`)
                })
            }
        }
    }
}

// friend admin
class ChackBotService extends Service {
    protected constructor() { super() }
    static instance: Service | null = null
    static getInstance(): Service {
        if (!ChackBotService.instance) {
            ChackBotService.instance = new ChackBotService()
        }
        return ChackBotService.instance
    }
    getStartWith(): string[] {
        return ["/check"]
    }
    async service(data: MiraiJSContext): Promise<void> {
        if (data.type != 'FriendMessage') return
        if (!adminQQ.has(data.sender?.id)) return
        if (this.state === 'close') return
        try {

            const which = data.text.trim().match(/^\/check\s+(\w+)/)?.[1]
                ;
            (ChatService.getInstance() as ChatService).checkBot(which as 'MoLi' | 'Turing')
            await data.bot.sendMessage({
                friend: data.sender?.id,
                message: new Message().addText(`已切换至 ${which}`)
            })
        } catch (e) {
            await data.bot.sendMessage({
                friend: data.sender?.id,
                message: new Message().addText('请输入正确的命令, 用法 /check [MoLi | Turing]')
            })
        }
    }

}

const serviceMatchList: Service[] = [
    ChackBotService.getInstance(), BotTimerSwitcherService.getInstance(), BotSwitcherService.getInstance(), ChatService.getInstance()
]

export class ServiceFactory {
    static createService(text: string): Service | null {

        for (const service of serviceMatchList) {
            for (const perfix of service.getStartWith()) {
                if (text.startsWith(perfix)) return service
            }
        }

        return null;
    }
}
