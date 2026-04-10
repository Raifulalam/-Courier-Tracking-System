const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const {
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead
} = require('../controllers/notificationController');

const router = express.Router();

router.get('/', verifyToken, getNotifications);
router.patch('/read-all', verifyToken, markAllNotificationsRead);
router.patch('/:id/read', verifyToken, markNotificationRead);

module.exports = router;
