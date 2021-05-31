import {connect} from 'amqplib'
import {ConnectionBuilder} from '../classes/ConnectionBuilder'


interface RabbitMQOptions {
    uri: string
}

export interface ChannelBuilderOption {
    channelPrefetch: number,
    consumerPrefetch: number,
}

export const createRabbitMQConnection = (opts: RabbitMQOptions, channelOpts?: ChannelBuilderOption): ConnectionBuilder => {
    const {uri} = opts
    const connection = connect(uri)

    return new ConnectionBuilder(connection, channelOpts)
}

