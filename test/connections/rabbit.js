const {createRabbitMQConnection} = require('../../dist')

const rabbit = createRabbitMQConnection({
    uri: process.env.RABBITMQ_URI || ''
})

module.exports = rabbit
