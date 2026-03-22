const logger = require('./logger');

const VECTOR_SEARCH_SERVICE_URL = (
  process.env.VECTOR_SEARCH_SERVICE_URL || 'http://localhost:8001'
).replace(/\/+$/, '');

async function parseServiceResponse(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text || 'Invalid response from vector search service' };
  }
}

async function requestVectorService(path, options = {}) {
  const response = await fetch(`${VECTOR_SEARCH_SERVICE_URL}${path}`, options);
  const payload = await parseServiceResponse(response);

  if (!response.ok) {
    const message =
      payload?.detail ||
      payload?.message ||
      `Vector search request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function toIndexPayload(book) {
  return {
    book_id: Number(book.id),
    image_url: book.coverUrl,
    cover_url: book.coverUrl,
    title: book.title,
    title_kh: book.titleKh ?? null,
    category: book.Category?.name ?? null,
    isbn: book.isbn ?? null,
  };
}

async function indexBookCover(book) {
  if (!book?.id || !book?.coverUrl) {
    return { indexed: false, skipped: true };
  }

  return requestVectorService('/books/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toIndexPayload(book)),
  });
}

async function deleteBookCover(bookId) {
  if (!bookId) return { deleted: false, skipped: true };

  return requestVectorService(`/books/${bookId}`, {
    method: 'DELETE',
  });
}

async function syncBookCover(book) {
  try {
    if (!book?.coverUrl) {
      return await deleteBookCover(book?.id);
    }

    return await indexBookCover(book);
  } catch (error) {
    logger.warn('Vector search sync failed', {
      bookId: book?.id ?? null,
      message: error.message,
      status: error.status ?? null,
    });
    return { synced: false, error: error.message };
  }
}

async function scanBookCover(file, { limit = 5, scoreThreshold } = {}) {
  if (!file?.buffer) {
    throw new Error('Image buffer is required for scan search');
  }

  const formData = new FormData();
  const blob = new Blob([file.buffer], {
    type: file.mimetype || 'image/jpeg',
  });

  formData.append('image', blob, file.originalname || 'scan.jpg');
  formData.append('limit', String(limit));

  if (scoreThreshold !== undefined && scoreThreshold !== null && scoreThreshold !== '') {
    formData.append('score_threshold', String(scoreThreshold));
  }

  return requestVectorService('/books/search', {
    method: 'POST',
    body: formData,
  });
}

module.exports = {
  indexBookCover,
  deleteBookCover,
  syncBookCover,
  scanBookCover,
};
