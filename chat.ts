import axios from 'axios'
import { config } from './config'
import { Message } from 'mirai-js'


export abstract class ChatBot {
    abstract chat(text: string, who: string): Promise<Message>
}

class MoLiChatBot extends ChatBot {
    constructor() { super() }
    private async callApi(text: string, who: string): Promise<Message> {
        const result = await axios.post('https://i.mly.app/reply', {
            content: text,
            type: 2,
            from: who,
            to: config.groupList?.[0] ?? 'defaultGroup'
        }, {
            headers: {
                'Api-Key': config.moliApiKey,
                'Api-Secret': config.moliApiSecret
            }
        })
        if (result.data?.data?.length != 0) {
            // 1: 文本, 2: 图片 image, 3: 文档, 4: 音频 voice, 9: 其它文件
            const msg = new Message()
            result.data?.data?.forEach((item: any) => {
                if (item.typed == 1) {
                    msg.addText(item.content)
                } else if (item.typed == 2) {
                    msg.addImageUrl('https://files.molicloud.com/' + item.content)
                } else if (item.typed == 3) {
                    msg.addText(item.content)
                } else if (item.typed == 4) {
                    msg.addVoiceUrl('https://files.molicloud.com/' + item.content)
                }
            })
            return msg.addText('')
        } else {
            throw new Error(result.data?.message)
        }
    }
    chat(text: string, who: string): Promise<Message> {
        return this.callApi(text, who)
    }
}

class TuringChatBot extends ChatBot {
    constructor() { super() }
    private async callApi(text: string, who: string): Promise<Message> {
        const result = await axios.post('http://openapi.turingapi.com/openapi/api/v2', {
            perception: {
                inputText: {
                    text
                }
            },
            userInfo: {
                apiKey: config.turingApiKey,
                userId: who
            }
        })
        if (result.data?.results?.length != 0) {
            // 文本(text);连接(url);音频(voice);视频(video);图片(image);图文(news)
            const msg = new Message()
            result.data?.results?.forEach((result: any) => {
                if (result.resultType == 'text') {
                    msg.addText(result.values.text)
                } else if (result.resultType == 'url') {
                    msg.addText(result.values.url)
                } else if (result.resultType == 'image') {
                    msg.addImageUrl(result.values.image)
                } else if (result.resultType == 'voice') {
                    msg.addVoiceUrl(result.values.voice)
                }
            })
            return msg.addText('')
        } else {
            throw new Error(result.data?.message)
        }
    }
    chat(text: string, who: string): Promise<Message> {
        return this.callApi(text, who)
    }
}

export class ChatBotFactory {
    static createChatBot(type: "MoLi" | "Turing"): ChatBot | null {
        if (type == "MoLi") {
            return new MoLiChatBot()
        } else if (type == "Turing") {
            return new TuringChatBot()
        }
        return null
    }
}