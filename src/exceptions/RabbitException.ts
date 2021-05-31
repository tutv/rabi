import {MessageHeader} from '../classes/MessageHeader'

export class RabbitException extends Error {
    public code: string = ''
    public message: string = ''
    public headers: MessageHeader

    constructor(headers: MessageHeader, message?: string) {
        super(message)
        this.headers = headers
        this.message = message || ''
    }
}

export class RabbitJobExpired extends RabbitException {
    public code: string = 'JOB_EXPIRED'
}

export class RabbitExceedMaxRetries extends RabbitException {
    public code: string = 'JOB_EXCEED_MAX_RETRIES'
}

