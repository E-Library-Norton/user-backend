// controllers/book.controller.js
const { Op } = require('sequelize');
const { Book, Author, Category, Publisher, MaterialType, Department, Download } = require('../models');
const ResponseFormatter = require('../utils/responseFormatter');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/errors');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');


function uploadToCloudinary(file, folder, resourceType = 'auto') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type:   resourceType,
        use_filename:    true,
        unique_filename: true,
      },
      (err, result) => { if (err) reject(err); else resolve(result); }
    );
    streamifier.createReadStream(file.buffer).pipe(stream);
  });
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

      const offset = (Number(page) - 1) * Number(limit);
      const { count, rows } = await Book.findAndCountAll({
        where,
        include: BOOK_INCLUDE,
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

  // ── POST /api/books
  static async create(req, res, next) {
    try {
      const {
        title, titleKh, isbn, publicationYear, description,
        pages,
        categoryId, publisherId, departmentId, typeId,
        authorIds = [],   // [{ id, isPrimaryAuthor }] or [id, id]
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

      // Upload files to Cloudinary if provided
      let coverUrl = req.body.coverUrl ?? null;
      let pdfUrl   = req.body.pdfUrl   ?? null;

      if (req.files?.cover?.[0]) {
        const result = await uploadToCloudinary(req.files.cover[0], 'books/covers', 'image');
        coverUrl = result.secure_url;
      }
      if (req.files?.pdf?.[0]) {
        const result = await uploadToCloudinary(req.files.pdf[0], 'books/pdfs', 'raw');
        pdfUrl = result.secure_url;
      }

      const book = await Book.create({
        title, titleKh, isbn, publicationYear, description,
        coverUrl, pdfUrl, pages,
        categoryId, publisherId, departmentId, typeId, isActive,
      });

      // Attach authors
      if (parsedAuthorIds.length > 0) {
        const pairs = parsedAuthorIds.map((a) =>
          typeof a === 'object'
            ? { author_id: a.id, is_primary_author: a.isPrimaryAuthor ?? false }
            : { author_id: a, is_primary_author: false }
        );
        await Promise.all(pairs.map((p) =>
          book.addAuthor(p.author_id, { through: { isPrimaryAuthor: p.is_primary_author } })
        ));
      }

      const created = await Book.findOne({
        where: { id: book.id },
        include: BOOK_INCLUDE,
      });

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
        authorIds, isActive,
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

      // Upload new files to Cloudinary if provided
      let coverUrl = req.body.coverUrl;
      let pdfUrl   = req.body.pdfUrl;

      if (req.files?.cover?.[0]) {
        const result = await uploadToCloudinary(req.files.cover[0], 'books/covers', 'image');
        coverUrl = result.secure_url;
      }
      if (req.files?.pdf?.[0]) {
        const result = await uploadToCloudinary(req.files.pdf[0], 'books/pdfs', 'raw');
        pdfUrl = result.secure_url;
      }

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

      // Replace authors if provided
      if (parsedAuthorIds !== undefined) {
        await book.setAuthors([]); // clear
        if (parsedAuthorIds.length > 0) {
          await Promise.all(parsedAuthorIds.map((a) => {
            const id = typeof a === 'object' ? a.id : a;
            const isPrimary = typeof a === 'object' ? (a.isPrimaryAuthor ?? false) : false;
            return book.addAuthor(id, { through: { isPrimaryAuthor: isPrimary } });
          }));
        }
      }

      const updated = await Book.findOne({ where: { id: book.id }, include: BOOK_INCLUDE });
      return ResponseFormatter.success(res, updated, 'Book updated successfully');
    } catch (err) { next(err); }
  }

  // ── DELETE /api/books/:id (soft delete) 
  static async delete(req, res, next) {
    try {
      const book = await Book.findOne({ where: { id: req.params.id, isDeleted: false } });
      if (!book) throw new NotFoundError('Book not found');
      await book.update({ isDeleted: true, isActive: false });
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