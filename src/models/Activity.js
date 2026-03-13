const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Activity = sequelize.define(
    "Activity",
    {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
        },
        userId: {
            type: DataTypes.BIGINT,
            allowNull: true,
            field: 'user_id',
        },
        action: {
            type: DataTypes.STRING(50), // e.g., 'created', 'updated', 'deleted', 'login', 'download'
            allowNull: false,
        },
        targetId: {
            type: DataTypes.BIGINT,
            allowNull: true,
            field: 'target_id',
        },
        targetName: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'target_name',
        },
        targetType: {
            type: DataTypes.STRING(50), // e.g., 'book', 'user', 'category'
            allowNull: false,
            field: 'target_type',
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at',
        },
    },
    {
        tableName: "activities",
        timestamps: false,
    }
);

module.exports = Activity;
