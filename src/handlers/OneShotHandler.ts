import {Channel, ConsumeMessage} from 'amqplib'
import {JobHandler} from './JobHandler'
import logger from '../helpers/logger'
import * as JobHandlerI from '../interfaces/JobHandlerInterface'

export class OneShotHandler extends JobHandler {

    private readonly noAck: boolean

    constructor(channel: Channel, queueName: string, options?: { noAck?: boolean }) {
        super(channel, queueName)
        this.noAck = !!options?.noAck
    }

    async initialize(): Promise<boolean> {
        /** Assert Original Queue */
        await this.channel.assertQueue(this.queueName, {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': this._getSpecifiedName(JobHandlerI.RETRY_ADDITIONAL_QUEUE_TYPES.RETRY),
                /** Using queue name for routing key by default **/
                'x-dead-letter-routing-key': this._getRoutingKey(),
            }
        })

        return super.initialize()
    }

    public async run(handler: JobHandlerI.Handler, onError?: JobHandlerI.OnError) {
        await super.run(handler, onError)

        const {channel, queueName} = this

        await channel.consume(queueName, (msg: ConsumeMessage | null) => {
            if (!msg) return false

            return this.handle(msg, handler, onError)
        }, {
            noAck: this.noAck
        })
    }

    public async handle(msg: ConsumeMessage, handler: JobHandlerI.Handler, onError?: JobHandlerI.OnError) {
        try {
            const result = await this.callHandler(msg, handler)

            return result
        } catch (error) {
            logger(error)

            if (onError) {
                onError(error)
            }
        } finally {
            if (!this.noAck) {
                await this.channel.ack(msg, false)
            }
        }
    }

}