import {Channel, ConsumeMessage} from 'amqplib'
import {JobHandler} from './JobHandler'
import * as JobHandlerI from '../interfaces/JobHandlerInterface'
import {findY, findX} from '../helpers/QuadraticRoot'
import logger from '../helpers/logger'


export class WithRetryHandler extends JobHandler {

    private readonly option: JobHandlerI.RetryOption

    constructor(channel: Channel, queueName: string, option?: JobHandlerI.RetryOption) {
        super(channel, queueName)
        this.option = Object.assign({}, JobHandlerI.DEFAULT_RETRY_OPTION, option)
    }

    public async initialize(): Promise<boolean> {

        /** Assert Original Queue */
        await this.channel.assertQueue(this.queueName, {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': this._getSpecifiedName(JobHandlerI.RETRY_ADDITIONAL_QUEUE_TYPES.RETRY),
                /** Using queue name for routing key by default **/
                'x-dead-letter-routing-key': this._getRoutingKey(),
            }
        })

        /** Assert Exchange for additional queue =>
         *      + RETRY
         *      + REQUEUE
         *      + ERROR
         */
        await Promise.all([
            JobHandlerI.RETRY_ADDITIONAL_QUEUE_TYPES.RETRY,
            JobHandlerI.RETRY_ADDITIONAL_QUEUE_TYPES.REQUEUE,
        ].map(this._assertExchange.bind(this)))

        /** Assert Retry Queue and bind to Retry Exchange */
        await this.channel.assertQueue(
            this._getSpecifiedName(JobHandlerI.RETRY_ADDITIONAL_QUEUE_TYPES.RETRY),
            {
                durable: true,
                arguments: {
                    'x-dead-letter-exchange': this._getSpecifiedName(JobHandlerI.RETRY_ADDITIONAL_QUEUE_TYPES.REQUEUE),
                    'x-message-ttl': this.option.initialDelayTime,
                    /** Using queue name for routing key by default **/
                    'x-dead-letter-routing-key': this._getRoutingKey(),
                }
            },
        )
        await this.channel.bindQueue(
            this._getSpecifiedName(JobHandlerI.RETRY_ADDITIONAL_QUEUE_TYPES.RETRY),
            this._getSpecifiedName(JobHandlerI.RETRY_ADDITIONAL_QUEUE_TYPES.RETRY),
            this._getRoutingKey(),
        )

        /** Binding Original Queue to Requeue Exchange */
        await this.channel.bindQueue(
            this.queueName,
            this._getSpecifiedName(JobHandlerI.RETRY_ADDITIONAL_QUEUE_TYPES.REQUEUE),
            this._getRoutingKey(),
        )

        await this.channel.assertQueue(
            this._getSpecifiedName(JobHandlerI.RETRY_ADDITIONAL_QUEUE_TYPES.ERROR),
            {
                durable: true,
                arguments: {
                    'x-message-ttl': JobHandlerI.DEFAULT_TTL_QUEUES.ERROR,
                }
            },
        )

        return super.initialize()
    }

    private async _assertExchange(type: string) {
        await this.channel.assertExchange(this._getSpecifiedName(type), this.option.exchangeType || JobHandlerI.DEFAULT_RETRY_OPTION.exchangeType, {
            durable: true,
        })
    }

    protected _getRoutingKey() {
        /** Using queue name for routing key by default **/
        return this.option.routingKey || this.queueName
    }

    protected _getSpecifiedName(type: string): string {
        return `${this.option.prefixQueueName || this.queueName}-${type}`
    }

    /**
     * To decide need to delay more we calculate the real Retry time
     *
     * Suppose Delay Formula is : DELAY_TIME * (retry_time)^2
     * x = retry_time
     * y = count_time
     *
     * So the equation is:
     * y = x ^ 2 + (x - 1) ^ 2 => y = 2x ^ 2 - 2x + 1 => 2x ^ 2 - 2x + (1 - y) = 0
     * finding x in this equation we obtain retry_time = x if x is integer
     */
    private static _findRetryTime(count: number): number {
        if (count <= 0) return 0

        const x = findX(2, -2, 1 - count)

        // if x === null so we return 99999 indicate that this job exceed maximum retries
        if (x === null) return 99999

        return x
    }

    /** if retryTime is not integer we need delay more */
    private static _needDelayMore(retryTime: number, totalCount: number) {
        if (retryTime <= 0) return false

        const integerOfRetryTime = parseInt(retryTime + '', 10)

        return findY(2, -2, 1, integerOfRetryTime) < totalCount
    }

    public async run(handler: JobHandlerI.Handler, onError?: JobHandlerI.OnError) {
        await super.run(handler, onError)

        const {channel, queueName} = this

        await channel.consume(queueName, (msg: ConsumeMessage | null) => {
            if (!msg) return false

            return this.handle(msg, handler, onError)
        }, {
            noAck: false,
        })
    }

    public async handle(msg: ConsumeMessage, handler: JobHandlerI.Handler, onError?: JobHandlerI.OnError) {
        const headers = msg?.properties?.headers || {}
        const xDeath = headers['x-death'] || []
        const totalCount = (xDeath[0] || {count: 0}).count

        const retryTime = WithRetryHandler._findRetryTime(totalCount)

        if (WithRetryHandler._needDelayMore(retryTime, totalCount)) {
            await this.channel.reject(msg, false)

            logger(`delay more`)

            return
        }

        try {
            const result = await this.callHandler(msg, handler, {retry_count: retryTime})

            await this.channel.ack(msg, false)
            logger(`ack`)

            return result
        } catch (error) {
            logger(error)

            const maxRetries = this.option.maxRetires || JobHandlerI.DEFAULT_RETRY_OPTION.maxRetries

            if (retryTime < maxRetries) {
                await this._handleRetryMsg(msg)
            } else {
                await this._handleErrorMsg(msg, error)
            }

            if (onError) {
                onError(error)
            }
        }
    }

    private async _handleRetryMsg(msg: ConsumeMessage) {
        await this.channel.reject(msg, false)

        logger(`retry`)
    }

    private async _handleErrorMsg(msg: ConsumeMessage, error: Error) {
        await this.channel.ack(msg, false)

        const headers = msg.properties?.headers || {}
        const contentJSON = {
            data: null,
            error: error.message,
            stack: error.stack,
        }
        if (msg.content) {
            const data = JobHandler.parseBufferToJSON(msg.content)

            if (data) {
                contentJSON.data = data
            }
        }

        await this.channel.sendToQueue(
            this._getSpecifiedName(JobHandlerI.RETRY_ADDITIONAL_QUEUE_TYPES.ERROR),
            JobHandler.JSONtoBuffer(contentJSON),
            {headers: headers},
        )

        logger(`error`)
    }

}