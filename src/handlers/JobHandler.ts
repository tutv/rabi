import {Channel, ConsumeMessage} from 'amqplib'
import * as JobHandlerI from '../interfaces/JobHandlerInterface'
import {JobHandlerException} from '../exceptions/JobHandlerException'
import {Message} from '../interfaces/JobHandlerInterface'
import {safeParseJSON} from '../helpers/safeParseJSON'

const DEFAULT_CONSUMER_PREFETCH = 10

export function createExchangeName(name: string, type: string) {
    return `${name}.${type}`
}

export function createQueueName(name: string, type: string) {
    return `${name}.${type}`
}

export abstract class JobHandler {
    protected isInitialize: boolean = false

    protected constructor(protected readonly channel: Channel, protected readonly queueName: string, protected readonly opts?: any) {
        if (!this.channel) throw new JobHandlerException(`Channel not found.`)
    }

    public prefetch(count: number) {
        return this.channel.prefetch(count, false)
    }

    public async initialize(): Promise<boolean> {
        this.isInitialize = true

        return true
    }

    protected _getRoutingKey() {
        /** Using queue name for routing key by default **/
        return this.queueName
    }

    protected _getSpecifiedName(type: string): string {
        return createExchangeName(this.queueName, type)
    }

    public async run(handler: JobHandlerI.Handler, onError?: JobHandlerI.OnError) {
        if (!this.isInitialize) throw new JobHandlerException(`This handler hasn't initialized.`)

        // await this.prefetch(DEFAULT_CONSUMER_PREFETCH)
    }

    static JSONtoBuffer(json: Object) {
        const str = JSON.stringify(json)

        return Buffer.from(str)
    }

    static parseBufferToJSON(buf: Buffer) {
        const content = buf?.toString()

        if (!content) return null

        return safeParseJSON(content)
    }

    protected makeMessage(msg: ConsumeMessage): Message {
        const message: Message = msg
        if (msg.content) {
            message.body = JobHandler.parseBufferToJSON(msg.content)
        }

        return message
    }

    protected async callHandler(msg: ConsumeMessage, handler: JobHandlerI.Handler, meta?: Object) {
        const message = this.makeMessage(msg)
        return await handler(message, meta)
    }

    public async handle(msg: ConsumeMessage, handler: JobHandlerI.Handler, onError?: JobHandlerI.OnError) {
        return this.callHandler(msg, handler)
    }
}

export interface JobHandlerConstructor {
    new(channel: Channel, queueName: string, opts?: any): JobHandler
}