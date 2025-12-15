const { NotFoundError } = require('../utils/errors');

const notFound = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.method} ${req.originalUrl}`);
  next(error);
};

module.exports = notFound;
