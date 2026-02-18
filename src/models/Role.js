// src/models/Role.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Role = sequelize.define(
  "Role",
  {
    id: {
      type: DataTypes.BIGINT,
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
    tableName: "roles",
    timestamps: false,
  }
);

Role.associate = function (models) {
  Role.belongsToMany(models.User, {
    through: "users_roles",
    foreignKey: "role_id",
    otherKey: "user_id",
    as: "Users",
    timestamps: false,
  });
  Role.belongsToMany(models.Permission, {
    through: "roles_permissions",
    foreignKey: "role_id",
    otherKey: "permission_id",
    as: "Permissions",
    timestamps: false,
  });
};

module.exports = Role;