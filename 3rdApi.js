import express from "express";
import { Sequelize, Model, DataTypes, QueryTypes } from "sequelize";
import amqp from "amqplib/callback_api.js";

const app = express();
const port = 3050;
const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: "./database.sqlite",
});
const User = sequelize.define(
    "user",
    {
      name: DataTypes.TEXT,
      pw: DataTypes.INTEGER,
      mail: DataTypes.TEXT,
    },
    {
      tableName: "registredUsers",
      hooks: {
        beforeCreate: (user, options) => {
          if (user.name == "Admin") {
            throw new Error("Admin user cannot be created");
          }
        },
        afterCreate: (user, options) => {
          logger.info("Sikeresen regisztrált felhasználó: ", user.name);
        },
      },
    }
);

//lekérdezés eredményét változóba teszem
var rabbitMsg;
    (async () => {
      const response = await sequelize.query("SELECT name FROM `registredUsers`", { type: QueryTypes.SELECT });
      rabbitMsg = response
    })();
// Kapcsolódás a RabbitMQ-hez
amqp.connect('amqp://localhost', function(error0, connection) {
  if (error0) {
    throw error0;
  }
  //csatorna létrehozása
  connection.createChannel(function(error1, channel) {
    if (error1) {
      throw error1;
    }
    var queue = 'api_requests';
    var msg = JSON.stringify(rabbitMsg)

    // Csatorna deklarálása
    channel.assertQueue(queue, {
      durable: false
    });
    //itt már Bufferként megy a queue-ra (fogadó oldalon kell a parse)
    channel.sendToQueue(queue, Buffer.from(msg));
  });
});
  
  // Szerver indítása
  app.listen(port, () => {
    console.log(`A szerver a http://localhost:${port} címen fut.`);
  });