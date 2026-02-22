const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Publisher = sequelize.define(
    "Publisher",
    {
        id: {
            type: DataTypes.INTEGER,
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
        address: {
            type: DataTypes.TEXT,
        },
        contactEmail: {
            type: DataTypes.STRING(255),
            field: 'contact_email',
        },
    },
    {
        tableName: "publishers",
        timestamps: false,
    }
);

module.exports = Publisher;