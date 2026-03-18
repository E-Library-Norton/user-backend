const { Sequelize } = require("sequelize");
require("dotenv").config({ path: ['.env.local', '.env'] });

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  protocol: "postgres",
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // important for Render
    },
  },
});

module.exports = { sequelize };
