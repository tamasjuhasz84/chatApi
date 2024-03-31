import { Sequelize, QueryTypes } from "sequelize";

test('Adatbázis hossza', async () => {
  const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: "./database.sqlite"
  });
  const data = await sequelize.query("SELECT * FROM `registredUsers`", { type: QueryTypes.SELECT });
  const dataLenght = data.length;
  expect(dataLenght).toBeGreaterThanOrEqual(3);
});