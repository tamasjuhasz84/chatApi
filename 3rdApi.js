import express from 'express'
import { Sequelize, QueryTypes } from 'sequelize'
import amqp from 'amqplib/callback_api.js'

const app = express()
const port = 3050
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite'
})

// lekérdezés eredményét változóba teszem
let rabbitMsg;
(async () => {
  const response = await sequelize.query('SELECT name FROM `registredUsers`', { type: QueryTypes.SELECT })
  rabbitMsg = response
})()
// Első kapcsolódás a RabbitMQ-hoz
amqp.connect('amqp://localhost', function (error0, connection) {
  if (error0) {
    throw error0
  }
  // csatorna létrehozása
  connection.createChannel(function (error1, channel) {
    if (error1) {
      throw error1
    }
    const queue = 'task_queue'
    const msg = JSON.stringify(rabbitMsg)
    const exchange = 'logs'
    const logMsg = 'A log küldés ideje: ' + new Date().toLocaleString()

    // Csatorna deklarálása
    // a durable a sort állítja tartósra vagy sem (mindkét oldalon kell). A tartós sor újraindítás esetén sem veszik el.
    channel.assertQueue(queue, {
      durable: true
    })
    // itt már Bufferként megy a queue-ra (fogadó oldalon kell a parse)
    // itt a persistent szintén azért van, hogy ne vesszenek el az üzik. A publisher confirms megoldás jobb.
    channel.sendToQueue(queue, Buffer.from(msg), { persistent: true })
    console.log(' Az üzenet el lett küldve a sorba: ', msg)
    // Elérhető exchange típusok: direct, topic, headers, fanout. Itt most fanout lesz
    channel.assertExchange(exchange, 'fanout', {
      durable: false
    })
    // a '' azért kell, mert nem akarjuk semmilyen sorba küldeni, csak a logokba
    channel.publish(exchange, '', Buffer.from(logMsg))
    console.log(' Ez a log lett elküldve: ', logMsg)
  })
  setTimeout(function () {
    connection.close()
    process.exit(0)
  }, 9000)
})

// Szerver indítása
app.listen(port, () => {
  console.log(`A szerver a http://localhost:${port} címen fut.`)
})
