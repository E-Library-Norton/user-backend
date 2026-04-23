'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'is_email_verified', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });
    await queryInterface.addColumn('users', 'email_verify_token', {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'is_email_verified');
    await queryInterface.removeColumn('users', 'email_verify_token');
  },
};
