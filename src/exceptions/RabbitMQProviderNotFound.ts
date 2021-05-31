export class RabbitMQProviderNotFound extends Error {
    constructor(message?: string) {
        super(
            `RabbitMQProviderNotFound: ${message || 'Unknown Error'}`,
        )
    }
}

