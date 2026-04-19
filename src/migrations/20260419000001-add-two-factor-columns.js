'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'two_factor_enabled', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });

    await queryInterface.addColumn('users', 'two_factor_secret', {
      type: Sequelize.STRING(256),
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'face_descriptor', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'face_descriptor');
    await queryInterface.removeColumn('users', 'two_factor_secret');
    await queryInterface.removeColumn('users', 'two_factor_enabled');
  },
};
