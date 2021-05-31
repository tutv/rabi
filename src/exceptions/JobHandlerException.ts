
export class JobHandlerException extends Error {
    constructor(message?: string) {
        super(
            `${message || 'No message.'}`,
        )
    }

}