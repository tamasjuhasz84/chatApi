import { Sequelize, QueryTypes } from "sequelize";
import { Server } from 'socket.io';
import ioClient from 'socket.io-client';

test('Adatbázis hossza', async () => {
  const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: "./database.sqlite"
  });
  const data = await sequelize.query("SELECT * FROM `registredUsers`", { type: QueryTypes.SELECT });
  const dataLenght = data.length;
  expect(dataLenght).toBeGreaterThanOrEqual(3);
});

test('Tamas-hoz tartozó jelszó', async () => {
  const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: "./database.sqlite"
  });
  const data = await sequelize.query("SELECT pw FROM `registredUsers` WHERE name LIKE :search_name",
  {
    replacements: { search_name: "Tamas" },
    type: QueryTypes.SELECT,
  });
  expect(data[0].pw.toString()).toContain("123");
});

test('Kiíratás tesztelése adatbázisból visszakapott szerkezettel', () => {
  const possibleUsers = [ { name: 'Tamas' }, { name: 'Balazs' }, { name: 'Anna' } ]
  for(var i = 0; i < possibleUsers.lengtth; i++) {
    expect(possibleUsers[i].name).toBe("Tamas Balazs Anna");
  }
});


const serverURL = 'http://localhost:5500';

describe('Socket.io kapcsolat tesztjei:', () => {
  let socketServer;
  let socket;
// a beforeall
  beforeAll((done) => {
    socketServer = new Server();
    socketServer.listen(5500);
    socket = ioClient.connect(serverURL);
    socket.on('connect', () => {
      done();
    });

    socket.on('error', (error) => {
      done(error);
    });
  });

  // az afterall
  afterAll(() => {
    if (socket.connected) {
      socket.disconnect();
    }
    socketServer.close();
  });

  // Van-e kapcsolat true vagy false
  test('Kapcsolódik-e a socket?', () => {
    expect(socket.connected).toBe(true);
  });
});