// controllers/book.controller.js
const { Op } = require('sequelize');
const { Book, Author, Editor, Category, Publisher, MaterialType, Department, Download } = require('../models');
const ResponseFormatter = require('../utils/responseFormatter');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/errors');
const { logActivity } = require('../utils/activityLogger');
const { uploadToCloudinary } = require('../utils/cloudR2Upload');
const { scanBookCover, syncBookCover, deleteBookCover } = require('../utils/vectorSearchService');
const { getIO, EVENTS } = require('../utils/socket');
const { broadcastNotification } = require('../utils/pushNotification');

// ── Helper: safely emit to admin room without crashing if Socket not ready ────
function emitToAdmin(event, payload) {
  try { getIO().to('admin').emit(event, payload); } catch { /* ignore */ }
}
// Also broadcast publicly so the student frontend receives book events
function emitPublic(event, payload) {
  try { getIO().emit(event, payload); } catch { /* ignore */ }
}

// ── Shared include for full book detail ───────────────────────────────────────
const BOOK_INCLUDE = [
  { model: Category, as: 'Category', attributes: ['id', 'name', 'nameKh'] },
  { model: Publisher, as: 'Publisher', attributes: ['id', 'name', 'nameKh'] },
  { model: Department, as: 'Department', attributes: ['id', 'name', 'code'] },
  { model: MaterialType, as: 'MaterialType', attributes: ['id', 'name', 'nameKh'] },
  {
    model: Author, as: 'Authors',
    attributes: ['id', 'name', 'nameKh'],
    through: { attributes: ['isPrimaryAuthor'] },
  },
  {
    model: Editor, as: 'Editors',
    attributes: ['id', 'name', 'nameKh'],
    through: { attributes: [] },
  },
  {
    model: Publisher, as: 'Publishers',
    attributes: ['id', 'name', 'nameKh'],
    through: { attributes: [] },
  },
];

class BookController {

  // ── GET /api/books 
  static async getAll(req, res, next) {
    try {
      const {
        page = 1, limit = 10,
        search = '',
        categoryId, publisherId, departmentId, typeId,
        publicationYear, isActive,
        yearFrom, yearTo, language, authorId,
        sortBy = 'created_at', sortOrder = 'DESC',
      } = req.query;

      const where = { isDeleted: false };

      if (search) {
        where[Op.or] = [
          { title: { [Op.iLike]: `%${search}%` } },
          { titleKh: { [Op.iLike]: `%${search}%` } },
          { isbn: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
        ];
      }
      if (categoryId) where.categoryId = categoryId;
      if (publisherId) where.publisherId = publisherId;
      if (departmentId) where.departmentId = departmentId;
      if (typeId) where.typeId = typeId;
      if (publicationYear) where.publicationYear = publicationYear;
      if (isActive !== undefined) where.isActive = isActive === 'true';

      // Advanced filters
      if (yearFrom || yearTo) {
        where.publicationYear = {
          ...(where.publicationYear || {}),
          ...(yearFrom ? { [Op.gte]: Number(yearFrom) } : {}),
          ...(yearTo   ? { [Op.lte]: Number(yearTo)   } : {}),
        };
      }
      if (language) where.language = language;

      // authorId filter — requires joining through BookAuthor
      const includeWithAuthorFilter = authorId
        ? BOOK_INCLUDE.map((inc) =>
            inc.as === 'Authors'
              ? { ...inc, where: { id: authorId }, required: true }
              : inc
          )
        : BOOK_INCLUDE;

      const offset = (Number(page) - 1) * Number(limit);
      const { count, rows } = await Book.findAndCountAll({
        where,
        include: includeWithAuthorFilter,
        order: [[sortBy, sortOrder.toUpperCase()]],
        limit: Number(limit),
        offset,
        distinct: true,
      });

      return ResponseFormatter.success(res, {
        books: rows,
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit)),
      });
    } catch (err) { next(err); }
  }

  // ── GET /api/books/:id 
  static async getById(req, res, next) {
    try {
      const book = await Book.findOne({
        where: { id: req.params.id, isDeleted: false },
        include: BOOK_INCLUDE,
      });
      if (!book) throw new NotFoundError('Book not found');

      // Increment view count
      await book.increment('views');

      return ResponseFormatter.success(res, book);
    } catch (err) { next(err); }
  }

  // ── POST /api/books/scan-search
  static async scanSearch(req, res, next) {
    try {
      const file =
        req.files?.image?.[0] ??
        req.files?.file?.[0] ??
        req.files?.cover?.[0] ??
        null;

      if (!file) {
        throw new ValidationError('Image file is required for scan search');
      }

      const rawLimit = Number(req.body?.limit ?? req.query?.limit ?? 5);
      const safeLimit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 10) : 5;
      const rawScoreThreshold = req.body?.scoreThreshold ?? req.query?.scoreThreshold;
      const scoreThreshold =
        rawScoreThreshold === undefined || rawScoreThreshold === ''
          ? undefined
          : Number(rawScoreThreshold);

      const vectorResults = await scanBookCover(file, {
        limit: safeLimit,
        scoreThreshold: Number.isFinite(scoreThreshold) ? scoreThreshold : undefined,
      });

      const matches = Array.isArray(vectorResults.matches) ? vectorResults.matches : [];
      const matchedIds = matches.map((match) => Number(match.book_id)).filter((id) => !Number.isNaN(id));

      if (matchedIds.length === 0) {
        return ResponseFormatter.success(res, {
          matches: [],
          total: 0,
          source: 'vector-search',
        });
      }

      const books = await Book.findAll({
        where: {
          id: { [Op.in]: matchedIds },
          isDeleted: false,
          isActive: true,
        },
        include: BOOK_INCLUDE,
      });

      const bookMap = new Map(books.map((book) => [Number(book.id), book]));
      const orderedMatches = matches
        .map((match) => {
          const book = bookMap.get(Number(match.book_id));
          if (!book) return null;

          return {
            ...book.toJSON(),
            similarityScore: Number(match.score),
            scanPayload: match.payload ?? {},
          };
        })
        .filter(Boolean);

      return ResponseFormatter.success(res, {
        matches: orderedMatches,
        total: orderedMatches.length,
        source: 'vector-search',
      });
    } catch (err) { next(err); }
  }

  // ── POST /api/books
  static async create(req, res, next) {
    try {
      const {
        title, titleKh, isbn, publicationYear, description,
        pages,
        categoryId, publisherId, departmentId, typeId,
        authorIds = [],   // legacy: [{ id, isPrimaryAuthor }] or [id, id]
        authorNames,      // preferred: ["David", "Samnang"] — find-or-create by name
        editorNames,      // ["Editor Name"] — find-or-create by name
        publisherNames,   // ["Publisher Name"] — find-or-create by name
        isActive = true,
      } = req.body;

      if (!title) throw new ValidationError('Title is required');

      // Check ISBN uniqueness
      if (isbn) {
        const exists = await Book.findOne({ where: { isbn } });
        if (exists) throw new ConflictError(`ISBN '${isbn}' already exists`);
      }

      // authorIds may arrive as a JSON string when sent via FormData
      let parsedAuthorIds = authorIds;
      if (typeof authorIds === 'string') {
        try { parsedAuthorIds = JSON.parse(authorIds); } catch { parsedAuthorIds = []; }
      }

      // Files are pre-uploaded via POST /api/upload/single — accept URLs from body
      const coverUrl = req.body.coverUrl ?? null;
      const pdfUrl   = req.body.pdfUrl   ?? null;

      const book = await Book.create({
        title, titleKh, isbn, publicationYear, description,
        coverUrl, pdfUrl, pages,
        categoryId, publisherId, departmentId, typeId, isActive,
      });

      // Parse authorNames (find-or-create by name)
      let parsedAuthorNames = authorNames;
      if (typeof authorNames === 'string') {
        try { parsedAuthorNames = JSON.parse(authorNames); } catch { parsedAuthorNames = []; }
      }
      if (!Array.isArray(parsedAuthorNames)) parsedAuthorNames = [];

      // Attach authors — prefer authorNames (find-or-create) over legacy authorIds
      if (parsedAuthorNames.length > 0) {
        for (let i = 0; i < parsedAuthorNames.length; i++) {
          const trimmed = String(parsedAuthorNames[i] ?? '').trim();
          if (!trimmed) continue;
          const [author] = await Author.findOrCreate({
            where: { name: trimmed },
            defaults: { name: trimmed },
          });
          await book.addAuthor(author.id, { through: { isPrimaryAuthor: i === 0 } });
        }
      } else if (parsedAuthorIds.length > 0) {
        const pairs = parsedAuthorIds.map((a) =>
          typeof a === 'object'
            ? { author_id: a.id, is_primary_author: a.isPrimaryAuthor ?? false }
            : { author_id: a, is_primary_author: false }
        );
        await Promise.all(pairs.map((p) =>
          book.addAuthor(p.author_id, { through: { isPrimaryAuthor: p.is_primary_author } })
        ));
      }

      // Attach editors — find-or-create by name
      let parsedEditorNames = editorNames;
      if (typeof editorNames === 'string') {
        try { parsedEditorNames = JSON.parse(editorNames); } catch { parsedEditorNames = []; }
      }
      if (!Array.isArray(parsedEditorNames)) parsedEditorNames = [];
      for (const raw of parsedEditorNames) {
        const trimmed = String(raw ?? '').trim();
        if (!trimmed) continue;
        const [editor] = await Editor.findOrCreate({
          where: { name: trimmed },
          defaults: { name: trimmed },
        });
        await book.addEditor(editor.id);
      }

      // Attach publishers — find-or-create by name
      let parsedPublisherNames = publisherNames;
      if (typeof publisherNames === 'string') {
        try { parsedPublisherNames = JSON.parse(publisherNames); } catch { parsedPublisherNames = []; }
      }
      if (!Array.isArray(parsedPublisherNames)) parsedPublisherNames = [];
      let firstPublisherId = null;
      for (const raw of parsedPublisherNames) {
        const trimmed = String(raw ?? '').trim();
        if (!trimmed) continue;
        const [publisher] = await Publisher.findOrCreate({
          where: { name: trimmed },
          defaults: { name: trimmed },
        });
        await book.addPublisher(publisher.id);
        if (!firstPublisherId) firstPublisherId = publisher.id;
      }
      if (firstPublisherId) await book.update({ publisherId: firstPublisherId });

      const created = await Book.findOne({
        where: { id: book.id },
        include: BOOK_INCLUDE,
      });

      await syncBookCover(created);

      // Log activity
      logActivity({
        userId: req.user?.id,
        action: 'uploaded',
        targetId: book.id,
        targetName: book.title,
        targetType: 'book'
      });

      // Real-time: notify admin room + public broadcast
      emitToAdmin(EVENTS.BOOK_CREATED, { book: created });
      emitPublic(EVENTS.BOOK_CREATED, { book: created });

      // Web Push: notify all subscribers of the new book
      broadcastNotification(
        '📚 New Book Added',
        `"${created.title}" is now available in the library.`,
        `/books/${created.id}`
      ).catch(() => {}); // fire-and-forget

      return ResponseFormatter.success(res, created, 'Book created successfully', 201);
    } catch (err) { next(err); }
  }

  // ── PUT /api/books/:id
  static async update(req, res, next) {
    try {
      const book = await Book.findOne({ where: { id: req.params.id, isDeleted: false } });
      if (!book) throw new NotFoundError('Book not found');

      const {
        title, titleKh, isbn, publicationYear, description,
        pages,
        categoryId, publisherId, departmentId, typeId,
        authorIds,   // legacy
        authorNames, // preferred: ["David", "Samnang"] — find-or-create by name
        editorNames, // ["Editor Name"] — find-or-create by name
        publisherNames, // ["Publisher Name"] — find-or-create by name
        isActive,
      } = req.body;

      // Check ISBN uniqueness (exclude self)
      if (isbn && isbn !== book.isbn) {
        const exists = await Book.findOne({ where: { isbn, id: { [Op.ne]: book.id } } });
        if (exists) throw new ConflictError(`ISBN '${isbn}' already exists`);
      }

      // authorIds may arrive as a JSON string when sent via FormData
      let parsedAuthorIds = authorIds;
      if (typeof authorIds === 'string') {
        try { parsedAuthorIds = JSON.parse(authorIds); } catch { parsedAuthorIds = undefined; }
      }

      // Files are pre-uploaded via POST /api/upload/single — accept URLs from body
      const coverUrl = req.body.coverUrl;
      const pdfUrl   = req.body.pdfUrl;

      await book.update({
        ...(title !== undefined && { title }),
        ...(titleKh !== undefined && { titleKh }),
        ...(isbn !== undefined && { isbn }),
        ...(publicationYear !== undefined && { publicationYear }),
        ...(description !== undefined && { description }),
        ...(coverUrl !== undefined && { coverUrl }),
        ...(pdfUrl !== undefined && { pdfUrl }),
        ...(pages !== undefined && { pages }),
        ...(categoryId !== undefined && { categoryId }),
        ...(publisherId !== undefined && { publisherId }),
        ...(departmentId !== undefined && { departmentId }),
        ...(typeId !== undefined && { typeId }),
        ...(isActive !== undefined && { isActive }),
      });

      // Parse authorNames for update
      let parsedAuthorNames = authorNames;
      if (typeof authorNames === 'string') {
        try { parsedAuthorNames = JSON.parse(authorNames); } catch { parsedAuthorNames = undefined; }
      }

      // Replace authors — prefer authorNames (find-or-create) over legacy authorIds
      if (Array.isArray(parsedAuthorNames)) {
        await book.setAuthors([]); // clear existing
        for (let i = 0; i < parsedAuthorNames.length; i++) {
          const trimmed = String(parsedAuthorNames[i] ?? '').trim();
          if (!trimmed) continue;
          const [author] = await Author.findOrCreate({
            where: { name: trimmed },
            defaults: { name: trimmed },
          });
          await book.addAuthor(author.id, { through: { isPrimaryAuthor: i === 0 } });
        }
      } else if (parsedAuthorIds !== undefined) {
        // Legacy authorIds path
        await book.setAuthors([]); // clear
        if (parsedAuthorIds.length > 0) {
          await Promise.all(parsedAuthorIds.map((a) => {
            const id = typeof a === 'object' ? a.id : a;
            const isPrimary = typeof a === 'object' ? (a.isPrimaryAuthor ?? false) : false;
            return book.addAuthor(id, { through: { isPrimaryAuthor: isPrimary } });
          }));
        }
      }

      // Replace editors — find-or-create by name
      let parsedEditorNames = editorNames;
      if (typeof editorNames === 'string') {
        try { parsedEditorNames = JSON.parse(editorNames); } catch { parsedEditorNames = undefined; }
      }
      if (Array.isArray(parsedEditorNames)) {
        await book.setEditors([]); // clear existing
        for (const raw of parsedEditorNames) {
          const trimmed = String(raw ?? '').trim();
          if (!trimmed) continue;
          const [editor] = await Editor.findOrCreate({
            where: { name: trimmed },
            defaults: { name: trimmed },
          });
          await book.addEditor(editor.id);
        }
      }

      // Replace publishers — find-or-create by name
      let parsedPublisherNames = publisherNames;
      if (typeof publisherNames === 'string') {
        try { parsedPublisherNames = JSON.parse(publisherNames); } catch { parsedPublisherNames = undefined; }
      }
      if (Array.isArray(parsedPublisherNames)) {
        await book.setPublishers([]);
        let firstPublisherId = null;
        for (const raw of parsedPublisherNames) {
          const trimmed = String(raw ?? '').trim();
          if (!trimmed) continue;
          const [publisher] = await Publisher.findOrCreate({
            where: { name: trimmed },
            defaults: { name: trimmed },
          });
          await book.addPublisher(publisher.id);
          if (!firstPublisherId) firstPublisherId = publisher.id;
        }
        if (firstPublisherId) await book.update({ publisherId: firstPublisherId });
      }

      const updated = await Book.findOne({ where: { id: book.id }, include: BOOK_INCLUDE });
      await syncBookCover(updated);
      // Log activity
      logActivity({
        userId: req.user?.id,
        action: 'updated',
        targetId: book.id,
        targetName: book.title,
        targetType: 'book'
      });

      // Real-time: notify admin room + public broadcast
      emitToAdmin(EVENTS.BOOK_UPDATED, { book: updated });
      emitPublic(EVENTS.BOOK_UPDATED, { book: updated });

      return ResponseFormatter.success(res, updated, 'Book updated successfully');
    } catch (err) { next(err); }
  }

  // ── DELETE /api/books/:id (soft delete) 
  static async delete(req, res, next) {
    try {
      const book = await Book.findOne({ where: { id: req.params.id, isDeleted: false } });
      if (!book) throw new NotFoundError('Book not found');
      try {
        await deleteBookCover(book.id);
      } catch {
        // Deleting the vector should not block the primary record deletion.
      }
      await book.update({ isDeleted: true, isActive: false });

      // Log activity
      logActivity({
        userId: req.user?.id,
        action: 'deleted',
        targetId: book.id,
        targetName: book.title,
        targetType: 'book'
      });

      // Real-time: notify admin room + public broadcast
      emitToAdmin(EVENTS.BOOK_DELETED, { bookId: book.id });
      emitPublic(EVENTS.BOOK_DELETED, { bookId: book.id });

      return ResponseFormatter.noContent(res, null, 'Book deleted successfully');
    } catch (err) { next(err); }
  }

  // ── GET /api/books/:id/downloads 
  static async getDownloads(req, res, next) {
    try {
      const book = await Book.findOne({ where: { id: req.params.id, isDeleted: false } });
      if (!book) throw new NotFoundError('Book not found');

      const { page = 1, limit = 20 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      const { count, rows } = await Download.findAndCountAll({
        where: { bookId: book.id },
        include: [{ model: require('../models').User, as: 'User', attributes: ['id', 'username', 'email'] }],
        order: [['downloadedAt', 'DESC']],
        limit: Number(limit),
        offset,
      });

      return ResponseFormatter.success(res, {
        downloads: rows, total: count,
        page: Number(page), totalPages: Math.ceil(count / Number(limit)),
      });
    } catch (err) { next(err); }
  }
}

module.exports = BookController;
