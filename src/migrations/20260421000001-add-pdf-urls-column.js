'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('books', 'pdf_urls', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Array of additional PDF file URLs',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('books', 'pdf_urls');
  },
};
