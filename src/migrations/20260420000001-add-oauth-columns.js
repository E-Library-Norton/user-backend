'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'oauth_provider', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('users', 'oauth_id', {
      type: Sequelize.STRING(256),
      allowNull: true,
      defaultValue: null,
    });
    // Allow password to be null for OAuth users
    await queryInterface.changeColumn('users', 'password', {
      type: Sequelize.STRING(256),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'oauth_provider');
    await queryInterface.removeColumn('users', 'oauth_id');
    await queryInterface.changeColumn('users', 'password', {
      type: require('sequelize').DataTypes.STRING(256),
      allowNull: false,
    });
  },
};
