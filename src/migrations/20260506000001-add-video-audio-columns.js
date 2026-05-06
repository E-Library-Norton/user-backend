'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add videoUrl column
    await queryInterface.addColumn('books', 'video_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'URL to book introduction video',
    });

    // Add audioUrl column
    await queryInterface.addColumn('books', 'audio_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'URL to book audio narration',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove audioUrl column
    await queryInterface.removeColumn('books', 'audio_url');

    // Remove videoUrl column
    await queryInterface.removeColumn('books', 'video_url');
  },
};
