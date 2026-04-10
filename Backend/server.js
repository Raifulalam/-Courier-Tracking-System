const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/authRoutes');
const shipmentRoutes = require('./routes/packageRoutes');
const adminRoutes = require('./routes/adminRoutes');
const agentRoutes = require('./routes/agentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
}));
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

const io = new Server(server, {
    cors: { origin: '*' }
});

app.set('io', io);

io.on('connection', (socket) => {
    socket.emit('system:connected', {
        ok: true,
        message: 'NexExpree realtime channel connected.'
    });

    socket.on('presence:join', ({ userId, role } = {}) => {
        if (userId) {
            socket.join(`user:${userId}`);
        }

        if (role) {
            socket.join(`role:${role}`);
        }
    });
});

app.get('/api/health', async (_req, res) => {
    res.status(200).json({
        ok: true,
        service: 'nexexpree-backend',
        databaseState: mongoose.connection.readyState,
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);

app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'API route not found.' });
});

app.use((err, _req, res, _next) => {
    console.error('Server error:', err);
    res.status(500).json({ message: 'Unexpected server error.' });
});

const PORT = process.env.PORT || 5000;

async function connectDatabase() {
    try {
        if (!process.env.MONGO_URI) {
            console.warn('MONGO_URI is missing. The API will start without a database connection.');
            return;
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected successfully.');
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        setTimeout(connectDatabase, 10000);
    }
}

server.listen(PORT, () => {
    console.log(`NexExpree API running on port ${PORT}`);

    if (!process.env.JWT_SECRET) {
        console.warn('JWT_SECRET is missing. Auth will not work until it is configured.');
    }

    connectDatabase();
});
