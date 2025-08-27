// CamAppServer/middleware/errorHandler.js
const logger = require('../utils/logger'); // Will create this next

const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Something went wrong.';

    // Log the full error for debugging (using your production logger)
    logger.error(`Error: ${message}, Path: ${req.path}, Method: ${req.method}`, { error: err.stack });

    // Send a generic error message to the client
    res.status(statusCode).json({
        message: 'An unexpected error occurred. Please try again later.'
        // In development, you might expose 'message' for easier debugging:
        // message: process.env.NODE_ENV === 'development' ? message : 'An unexpected error occurred. Please try again later.'
    });
};

module.exports = errorHandler;