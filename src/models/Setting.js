// src/models/Setting.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Setting = sequelize.define(
    "Setting",
    {
        key: {
            type: DataTypes.STRING(100),
            primaryKey: true,
            allowNull: false,
            unique: true,
        },
        value: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        group: {
            type: DataTypes.STRING(50),
            allowNull: true,
            defaultValue: "general",
        },
        type: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: "string", // string, json, boolean, number
        },
    },
    {
        tableName: "settings",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    }
);

module.exports = Setting;
