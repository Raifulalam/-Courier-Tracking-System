const mongoose = require('mongoose');

function getDatabaseStateLabel() {
    return ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';
}

function requireDatabaseConnection(req, res, next) {
    if (mongoose.connection.readyState === 1) {
        return next();
    }

    return res.status(503).json({
        message: 'The service is still connecting to the database. Please try again in a moment.',
        meta: {
            databaseState: getDatabaseStateLabel()
        }
    });
}

module.exports = {
    getDatabaseStateLabel,
    requireDatabaseConnection
};
