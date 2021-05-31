import {Channel, ConsumeMessage} from "amqplib"


export class QueueHandler {
    private readonly channel: Channel
    private readonly queueName: string
    private readonly handler: Function

    constructor(channel: Channel, queueName: string, handler: Function) {
        this.channel = channel
        this.queueName = queueName
        this.handler = handler
    }

    public prefetch(count: number) {
        return this.channel.prefetch(count)
    }

    public async handle() {
        const {channel, handler, queueName} = this

        await channel.consume(queueName, async (msg: ConsumeMessage | null) => {
            if (!msg) return false

            try {
                await handler(msg)
                channel.ack(msg)
            } catch (error) {
                channel.reject(msg, true)
            }
        }, {
            noAck: false
        })
    }
}


