const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Author = sequelize.define(
    "Author",
    {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        nameKh: {
            type: DataTypes.STRING(255),
            field: 'name_kh',
        },
        biography: {
            type: DataTypes.TEXT,
        },
        website: {
            type: DataTypes.STRING(255),
        },
    },
    {
        tableName: "authors",
        timestamps: false,
    }
);

module.exports = Author;