const jwt = require('jsonwebtoken');
const User = require('../models/User'); // ⬅️ make sure this path is correct

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization token is required.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ message: 'JWT_SECRET is missing from the backend environment configuration.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // ✅ Fetch user from DB
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ message: 'Authenticated user was not found.' });
        }

        if (!user.isActive) {
            return res.status(403).json({ message: 'This user account is inactive.' });
        }

        req.user = user; // ✅ Attach full user document
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
};

const checkRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied for this account role.' });
        }
        next();
    };
};

module.exports = { verifyToken, checkRole };
