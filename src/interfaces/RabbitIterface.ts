export enum PREFIX_QUEUE_TYPES {
    publish = 'pub',
    queue = 'que',
}

export interface PureSubject {
    name: string
    /**
     * default type:
     * +, sendToQueue => 'que'
     * +, publish => 'pub'
     */
    type: PREFIX_QUEUE_TYPES
}

export interface AssertQueueOpts {
    redeclare: boolean
}