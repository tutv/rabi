import {JobHandlerConstructor} from '../handlers/JobHandler'

export enum JobHandlerType {
    ONE_SHOT = 'OneShotHandler',
    WITH_RETRY = 'WithRetryHandler',
    ROLLING = 'RollingHandler',
}

export interface BaseOptions {
    JobHandler?: JobHandlerConstructor,
    oneShot?: boolean,
    noAck?: boolean,
    jobHandlerType?: JobHandlerType
    initialDelayTime?: number, // 5000
    maxRetires?: number, // 5
}

export interface SubscribeOptions extends BaseOptions {
    queue: string,
}

export interface WorkerOptions extends BaseOptions {
}