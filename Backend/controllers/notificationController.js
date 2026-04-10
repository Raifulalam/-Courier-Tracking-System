const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        const unreadCount = notifications.filter((notification) => !notification.isRead).length;

        return res.status(200).json({
            message: 'Notifications loaded successfully.',
            data: notifications,
            meta: { unreadCount }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load notifications.' });
    }
};

exports.markNotificationRead = async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { isRead: true },
            { new: true }
        ).lean();

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found.' });
        }

        return res.status(200).json({
            message: 'Notification marked as read.',
            data: notification
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to update notification.' });
    }
};

exports.markAllNotificationsRead = async (req, res) => {
    try {
        await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });

        return res.status(200).json({
            message: 'All notifications marked as read.'
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to mark notifications as read.' });
    }
};
