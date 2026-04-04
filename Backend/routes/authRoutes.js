const express = require('express');
const { register, login, getCurrentUser, updateProfile } = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', verifyToken, getCurrentUser);
router.put('/profile', verifyToken, updateProfile);

module.exports = router;
