const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { getDatabaseStateLabel, requireDatabaseConnection } = require('./middleware/databaseReady');

const authRoutes = require('./routes/authRoutes');
const packageRoutes = require('./routes/packageRoutes');
const adminRoutes = require('./routes/adminRoutes');
const agentRoutes = require('./routes/agentRoutes');
const locationRoutes = require('./routes/locationRoutes');
const pricingRoutes = require('./routes/pricingRoutes');

dotenv.config();

const app = express();
const server = http.createServer(app);
const defaultOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173'
];
const allowedOrigins = (process.env.CLIENT_URL || defaultOrigins.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const allowAnyOrigin = allowedOrigins.includes('*');
const corsOriginHandler = (origin, callback) => {
    if (!origin || allowAnyOrigin || allowedOrigins.includes(origin)) {
        return callback(null, true);
    }

    return callback(new Error('CORS policy blocked this origin.'));
};
const io = new Server(server, { cors: { origin: allowAnyOrigin ? true : allowedOrigins } });

app.use(cors({ origin: corsOriginHandler }));
app.use(express.json());
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

app.set('io', io); // This allows access to io in any controller via req.app.get('io')

io.on('connection', (socket) => {
    socket.emit('system:connected', { ok: true, message: 'Realtime channel connected.' });
});

app.get('/api/health', (_req, res) => {
    res.json({
        ok: true,
        service: 'parcel-tracker-backend',
        databaseState: getDatabaseStateLabel(),
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

app.use((req, res, next) => {
    if (req.path === '/api/health' || req.path.startsWith('/api/locations')) {
        return next();
    }

    return requireDatabaseConnection(req, res, next);
});

app.use('/api/auth', authRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/package', packageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);

app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'API route not found.' });
});

app.use((err, _req, res, _next) => {
    console.error('Unhandled server error:', err);

    if (err.message === 'CORS policy blocked this origin.') {
        return res.status(403).json({
            message: 'This frontend origin is not allowed by the backend CORS configuration. Update CLIENT_URL in Backend/.env.'
        });
    }

    res.status(500).json({ message: 'Unexpected server error.' });
});

const PORT = process.env.PORT || 5000;
const mongoUri = process.env.MONGO_URI;
let isConnectingToMongo = false;

async function connectDatabase() {
    if (!mongoUri) {
        console.error('MongoDB connection error: MONGO_URI is missing from Backend/.env');
        return;
    }

    if (isConnectingToMongo || mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
        return;
    }

    isConnectingToMongo = true;

    try {
        console.log('Connecting to MongoDB...');

        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000
        });
        console.log('MongoDB connected successfully.');
    } catch (err) {
        if (err.code === 'ENOTFOUND') {
            console.error(
                'MongoDB connection error: could not resolve the MongoDB host. Check the cluster hostname in MONGO_URI and confirm your internet/DNS connection.'
            );
        }

        console.error('MongoDB connection error:', err.message);
        console.log('Retrying MongoDB connection in 15 seconds...');
        setTimeout(connectDatabase, 15000);
    } finally {
        isConnectingToMongo = false;
    }
}

mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected.');
    setTimeout(connectDatabase, 5000);
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Server startup failed: port ${PORT} is already in use.`);
        return;
    }

    console.error('Server startup failed:', error.message);
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);

    if (!process.env.JWT_SECRET) {
        console.warn('Warning: JWT_SECRET is missing from Backend/.env. Login and protected routes will fail until it is set.');
    }

    connectDatabase();
});
