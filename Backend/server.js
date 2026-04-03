const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/authRoutes');
const packageRoutes = require('./routes/packageRoutes');
const adminRoutes = require('./routes/adminRoutes');
const agentRoutes = require('./routes/agentRoutes');
const locationRoutes = require('./routes/locationRoutes');
const pricingRoutes = require('./routes/pricingRoutes');

dotenv.config();

const app = express();
const server = http.createServer(app);
const clientOrigin = process.env.CLIENT_URL || '*';
const io = new Server(server, { cors: { origin: clientOrigin } });

app.use(cors({ origin: clientOrigin === '*' ? true : clientOrigin }));
app.use(express.json());

app.set('io', io); // This allows access to io in any controller via req.app.get('io')

io.on('connection', (socket) => {
    socket.emit('system:connected', { ok: true, message: 'Realtime channel connected.' });
});

app.get('/api/health', (_req, res) => {
    res.json({
        ok: true,
        service: 'parcel-tracker-backend',
        timestamp: new Date().toISOString()
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/package', packageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);

const PORT = process.env.PORT || 5000;
const mongoUri = process.env.MONGO_URI;

async function startServer() {
    if (!mongoUri) {
        console.error('MongoDB connection error: MONGO_URI is missing from Backend/.env');
        process.exit(1);
    }

    try {
        await mongoose.connect(mongoUri);

        server.listen(PORT, () => {
            console.log(`MongoDB connected. Server running on port ${PORT}`);
        });
    } catch (err) {
        if (err.code === 'ENOTFOUND') {
            console.error(
                'MongoDB connection error: could not resolve the MongoDB host. Check the cluster hostname in MONGO_URI and confirm your internet/DNS connection.'
            );
        }

        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    }
}

startServer();
