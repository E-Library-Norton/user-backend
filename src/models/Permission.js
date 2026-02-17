// src/models/Permission.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Permission = sequelize.define(
  "Permission",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "permissions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

Permission.associate = function (models) {
  Permission.belongsToMany(models.Role, {
    through: "roles_permissions",
    foreignKey: "permission_id",
    otherKey: "role_id",
    as: "Roles",
    timestamps: false,
  });
  Permission.belongsToMany(models.User, {
    through: "users_permissions",
    foreignKey: "permission_id",
    otherKey: "user_id",
    as: "Users",
    timestamps: false,
  });
};

module.exports = Permission;