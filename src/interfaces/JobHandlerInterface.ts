import {Channel, ConsumeMessage} from 'amqplib'

export interface JobOption {
    manually?: boolean,
}

export interface RetryOption extends JobOption {
    initialDelayTime?: number, // 5000
    maxRetires?: number, // 5
    exchangeType?: string, // 'direct'
    prefixQueueName?: string,
    routingKey?: string,
}

export const DEFAULT_RETRY_OPTION = {
    initialDelayTime: 1000 * 5, // five seconds
    maxRetries: 5,
    exchangeType: 'direct',
}

export enum RETRY_ADDITIONAL_QUEUE_TYPES {
    RETRY = 'retry',
    REQUEUE = 'requeue',
    ERROR = 'error'
}

export enum ROLLING_ADDITIONAL_QUEUE_TYPES {
    PENDING = 'pending',
    ACTIVE = 'active',
}

export enum DEFAULT_TTL_QUEUES {
    // RETRY = 1000 * 60 * 2, // two minutes
    ERROR = 1000 * 60 * 60 * 24 * 30, // one month
}

export interface Message extends ConsumeMessage {
    body?: object | string
}

export type Handler = (msg: Message, meta?: Object) => any

export type OnError = (error: Error) => void