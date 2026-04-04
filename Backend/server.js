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


// ✅ SIMPLE & SAFE CORS (FIXED)
app.use(cors({
    origin: "*",   // allow all (safe for now, restrict later)
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));

app.use(express.json());


// ✅ Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});


// ✅ Socket.io (FIXED CORS)
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.set('io', io);

io.on('connection', (socket) => {
    socket.emit('system:connected', {
        ok: true,
        message: 'Realtime channel connected.'
    });
});


// ✅ Health route
app.get('/api/health', (_req, res) => {
    res.json({
        ok: true,
        service: 'parcel-tracker-backend',
        databaseState: getDatabaseStateLabel(),
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString()
    });
});


// ⚠️ TEMP: Disable DB blocking middleware (important for deployment)
// Uncomment later if needed
/*
app.use((req, res, next) => {
  if (req.path === '/api/health' || req.path.startsWith('/api/locations')) {
    return next();
  }
  return requireDatabaseConnection(req, res, next);
});
*/


// ✅ Routes
app.use('/api/auth', authRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/package', packageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);


// ✅ 404 handler
app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'API route not found.' });
});


// ✅ Error handler
app.use((err, _req, res, _next) => {
    console.error('Server error:', err);
    res.status(500).json({ message: 'Unexpected server error.' });
});


// ✅ PORT FIX (IMPORTANT for Render)
const PORT = process.env.PORT || 5000;


// ✅ MongoDB connection
const mongoUri = process.env.MONGO_URI;

async function connectDatabase() {
    try {
        if (!mongoUri) {
            console.error('❌ MONGO_URI missing');
            return;
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✅ MongoDB connected');
    } catch (err) {
        console.error('MongoDB error:', err.message);
        setTimeout(connectDatabase, 10000);
    }
}


// ✅ Start server
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);

    if (!process.env.JWT_SECRET) {
        console.warn('⚠️ JWT_SECRET missing');
    }

    connectDatabase();
});