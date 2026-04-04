const jwt = require('jsonwebtoken');
const User = require('../models/User'); // ⬅️ make sure this path is correct

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ msg: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // ✅ Fetch user from DB
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ msg: 'User not found' });
        }

        if (!user.isActive) {
            return res.status(403).json({ msg: 'User account is inactive' });
        }

        req.user = user; // ✅ Attach full user document
        next();
    } catch (err) {
        return res.status(401).json({ msg: 'Invalid token' });
    }
};

const checkRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ msg: 'Access denied' });
        }
        next();
    };
};

module.exports = { verifyToken, checkRole };
