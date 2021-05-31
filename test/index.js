require('dotenv').config({
    path: require('path').resolve(__dirname, '.env')
})

setImmediate(async () => {
    try {
        const conn = require('./connections/rabbit')
        const {Rabbit} = require('../dist/index')

        const rabbit = new Rabbit(conn)

        await rabbit.subscribe('TEST_P', {queue: 'test-queue'}, (msg, meta) => {
            console.log(msg)
            console.log(meta)
            throw Error('a')
        })

        await rabbit.processJob('TEST_Q', {}, (msg, meta) => {
            console.log(msg)
            console.log(meta)
            throw Error('a')
        })

        await rabbit.publish('TEST_P', {hello: 'word'})
        await rabbit.addJob('TEST_Q', {hello: 'word'})

    } catch (error) {
        console.log("ERROR", error)
    }
})
