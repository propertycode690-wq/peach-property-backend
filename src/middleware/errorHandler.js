const errorHandler = (err, req, res, next) => {
    console.error(err.stack); // Log error stack trace to console for backend tracking

    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    // We send back generic text in prod to avoid leaking logic
    const isProduction = process.env.NODE_ENV === 'production';

    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        stack: isProduction ? '🥞' : err.stack,
    });
};

const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

module.exports = { errorHandler, notFound };
