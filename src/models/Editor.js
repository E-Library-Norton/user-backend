const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Editor = sequelize.define(
  "Editor",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    nameKh: {
      type: DataTypes.STRING(255),
      field: "name_kh",
    },
    biography: {
      type: DataTypes.TEXT,
    },
    website: {
      type: DataTypes.STRING(255),
    },
  },
  {
    tableName: "editors",
    timestamps: false,
  }
);

module.exports = Editor;