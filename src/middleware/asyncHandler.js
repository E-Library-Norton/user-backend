/**
 * Wraps an async function to catch any errors and pass them to the next middleware.
 * Eliminates the need for try/catch blocks in every controller method.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
