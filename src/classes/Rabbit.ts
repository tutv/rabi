import {Channel} from 'amqplib'
import {ConnectionBuilder} from './ConnectionBuilder'
import {ChannelBuilder} from './ChannelBuilder'
import {PREFIX_QUEUE_TYPES} from '../interfaces/RabbitIterface'
import {PublishOptions} from '../interfaces/PublishOptions'
import {MessageOptions} from './MessageOptions'
import {MessageData} from './MessageData'
import {BaseOptions, SubscribeOptions, WorkerOptions} from '../interfaces/SubscribeOptions'
import {OneShotHandler} from '../handlers/OneShotHandler'
import {WithRetryHandler} from '../handlers/WithRetryHandler'
import {JobHandler, JobHandlerConstructor, createExchangeName, createQueueName} from '../handlers/JobHandler'
import * as JobHandlerI from '../interfaces/JobHandlerInterface'

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

    public async subscribe(subject: string, opts: SubscribeOptions, handler: JobHandlerI.Handler, onError?: JobHandlerI.OnError) {
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
                // 'x-dead-letter-exchange': `${vQueueName}-retry`,
                'x-dead-letter-exchange': createExchangeName(vQueueName, JobHandlerI.RETRY_ADDITIONAL_QUEUE_TYPES.RETRY),
                /** Using queue name for routing key by default **/
                'x-dead-letter-routing-key': vQueueName,
            }
        })
        await channel.bindQueue(vQueueName, vSubject, '')

        const jobHandler = await this._createJobHandler(channel, vQueueName, opts)

        return jobHandler.run(handler, onError)
    }

    public async addJob(subject: string, payload: any, opts?: PublishOptions) {
        const vQueueName = this._injectPrefix(subject, PREFIX_QUEUE_TYPES.queue)
        const channel = await this.channelBuilder.getChannel()

        await channel.assertQueue(vQueueName, {
            durable: true,
            arguments: {
                // 'x-dead-letter-exchange': `${vQueueName}-retry`,
                'x-dead-letter-exchange': createExchangeName(vQueueName, JobHandlerI.RETRY_ADDITIONAL_QUEUE_TYPES.RETRY),
                /** Using queue name for routing key by default **/
                'x-dead-letter-routing-key': vQueueName,
            }
        })

        const buffer = MessageData.from(payload).toBuffer()
        const options = new MessageOptions(opts)

        return channel.sendToQueue(vQueueName, buffer, options.toObject())
    }

    public async processJob(subject: string, opts: WorkerOptions = {}, handler: JobHandlerI.Handler, onError?: JobHandlerI.OnError) {
        const vQueueName = this._injectPrefix(subject, PREFIX_QUEUE_TYPES.queue)
        const channel = await this.channelBuilder.getChannel()

        const jobHandler = await this._createJobHandler(channel, vQueueName, opts)

        return jobHandler.run(handler, onError)
    }

    private async _createJobHandler(channel: Channel, queueName: string, opts: BaseOptions): Promise<JobHandler> {
        const JobHandlerCtor = this._getJobHandler(opts)

        const jobHandler = new JobHandlerCtor(channel, queueName, opts)

        await jobHandler.initialize()

        return jobHandler
    }

    private _getJobHandler(opts: BaseOptions): JobHandlerConstructor {
        /** custom Handler */
        if (opts.JobHandler) {
            return opts.JobHandler
        } else {
            if (opts.oneShot) {
                return OneShotHandler
            }
        }

        return WithRetryHandler
    }

}

