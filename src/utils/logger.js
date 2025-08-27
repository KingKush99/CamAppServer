// CamAppServer/utils/logger.js
const winston = require('winston');
require('winston-daily-rotate-file'); // For daily log rotation
const path = require('path');

const logDir = 'logs'; // Directory for log files

// Define custom log format
const logFormat = winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${message} ${stack ? `\n${stack}` : ''}`;
});

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info', // Log level
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }), // Include stack trace for errors
        winston.format.splat(), // Interpolate string arguments
        logFormat // Use the custom format defined above
    ),
    transports: [
        // Console transport for development
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(), // Add colors to console output
                winston.format.simple() // Simple format for console (no timestamp repetition)
            ),
            silent: process.env.NODE_ENV === 'test' // Don't log to console during tests
        }),
        // File transport for production logs (all levels)
        new winston.transports.DailyRotateFile({
            filename: path.join(logDir, 'application-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true, // Compress old log files
            maxSize: '20m', // Rotate file when it reaches 20MB
            maxFiles: '14d' // Keep logs for 14 days
        }),
        // File transport for error logs only
        new winston.transports.DailyRotateFile({
            filename: path.join(logDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            level: 'error' // Only log errors to this file
        })
    ],
    exceptionHandlers: [ // Catch uncaught exceptions
        new winston.transports.File({ filename: path.join(logDir, 'exceptions.log') })
    ],
    rejectionHandlers: [ // Catch unhandled promise rejections
        new winston.transports.File({ filename: path.join(logDir, 'rejections.log') })
    ]
});

module.exports = logger;