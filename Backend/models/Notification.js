const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        role: { type: String, trim: true, default: '' },
        type: { type: String, trim: true, default: 'system' },
        title: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },
        shipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', default: null, index: true },
        trackingId: { type: String, trim: true, default: '' },
        metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
        isRead: { type: Boolean, default: false, index: true }
    },
    { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
