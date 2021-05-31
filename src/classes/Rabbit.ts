import {ConnectionBuilder} from "./ConnectionBuilder"
import {ChannelBuilder} from "./ChannelBuilder"
import {PREFIX_QUEUE_TYPES} from "../interfaces/RabbitIterface"
import {PublishOptions} from "../interfaces/PublishOptions"
import {MessageOptions} from "./MessageOptions"
import {MessageData} from "./MessageData"
import {SubscribeOptions} from "../interfaces/SubscribeOptions"
import {Handler, OnError} from "../interfaces/JobHandlerInterface"


export class Rabbit {
    static PREFIX_QUEUE_TYPES = PREFIX_QUEUE_TYPES

    private readonly connection: ConnectionBuilder
    private readonly channelBuilder: ChannelBuilder
    public readonly prefix: string = ''

    constructor(connection: ConnectionBuilder, prefix?: string) {
        this.connection = connection
        this.channelBuilder = ChannelBuilder.getChannelBuilder(this.connection)
        this.prefix = prefix || 'rabi'
    }

    private _injectPrefix(name: string, type: string): string {
        return `${this.prefix}:${type}.${name}`
    }

    public async publish(subject: string, data: any, opts?: PublishOptions) {
        const channel = await this.channelBuilder.getChannel()

        const vSubject = this._injectPrefix(subject, PREFIX_QUEUE_TYPES.publish)

        /** assert exchange with eventName */
        await channel.assertExchange(vSubject, 'fanout', {
            durable: true,
        })

        const options = new MessageOptions(opts)
        const buffer = MessageData.from(data).toBuffer()

        return channel.publish(vSubject, subject, buffer, options.toObject())
    }

    public async subscribe(subject: string, opts: SubscribeOptions, handler: Handler, onError?: OnError) {
        const vSubject = this._injectPrefix(subject, PREFIX_QUEUE_TYPES.publish)
        const channel = await this.channelBuilder.getChannel()

        await channel.assertExchange(vSubject, 'fanout', {
            durable: true,
            autoDelete: false,
        })

        const {queue} = opts

        const vQueueName = this._injectPrefix(`${queue}.${subject}`, PREFIX_QUEUE_TYPES.publish)
        await channel.assertQueue(vQueueName, {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': `${vQueueName}-retry`,
                /** Using queue name for routing key by default **/
                'x-dead-letter-routing-key': vQueueName,
            }
        })
        await channel.bindQueue(vQueueName, vSubject, '')
    }
}

