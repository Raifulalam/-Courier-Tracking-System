const express = require('express');
const { register, login, getCurrentUser, updateProfile, verifyEmail } = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.get('/me', verifyToken, getCurrentUser);
router.put('/profile', verifyToken, updateProfile);

module.exports = router;
