const dotenv = require('dotenv');
dotenv.config({ path: ['.env.local', '.env'] });

const { Op } = require('sequelize');
const { sequelize } = require('../src/config/database');
const { Book, Category } = require('../src/models');
const { syncBookCover } = require('../src/utils/vectorSearchService');

const BATCH_SIZE = Number(process.env.VECTOR_BACKFILL_BATCH_SIZE || 25);

async function main() {
  await sequelize.authenticate();

  const total = await Book.count({
    where: {
      isDeleted: false,
      isActive: true,
      coverUrl: { [Op.ne]: null },
    },
  });

  console.log(`Backfilling vectors for ${total} books...`);

  let processed = 0;

  while (processed < total) {
    const books = await Book.findAll({
      where: {
        isDeleted: false,
        isActive: true,
        coverUrl: { [Op.ne]: null },
      },
      include: [
        { model: Category, as: 'Category', attributes: ['id', 'name', 'nameKh'] },
      ],
      order: [['id', 'ASC']],
      limit: BATCH_SIZE,
      offset: processed,
    });

    for (const book of books) {
      const result = await syncBookCover(book);

      if (result?.indexed) {
        console.log(`Indexed book ${book.id}: ${book.title}`);
      } else if (result?.skipped) {
        console.log(`Skipped book ${book.id}: ${book.title}`);
      } else {
        console.warn(`Failed to index book ${book.id}: ${book.title}`);
      }
    }

    processed += books.length;
  }

  console.log('Vector backfill completed.');
}

main()
  .catch((error) => {
    console.error('Vector backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close().catch(() => undefined);
  });
