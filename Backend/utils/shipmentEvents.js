const DeliveryLog = require('../models/DeliveryLog');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { STATUS_LABELS } = require('./packageLifecycle');

function buildActor(user) {
    if (!user) {
        return { _id: null, name: 'System', role: 'system' };
    }

    return {
        _id: user._id,
        name: user.name,
        role: user.role
    };
}

function buildTimelineEntry(status, user, note = '', location = '') {
    return {
        status,
        label: STATUS_LABELS[status] || status,
        note,
        location,
        timestamp: new Date(),
        actor: buildActor(user)
    };
}

async function appendShipmentLog(shipment, status, user, note = '', location = '') {
    const entry = buildTimelineEntry(status, user, note, location);
    shipment.timeline.push(entry);

    await DeliveryLog.create({
        shipmentId: shipment._id,
        trackingId: shipment.trackingId,
        status,
        label: entry.label,
        note,
        location,
        actor: entry.actor,
        eventAt: entry.timestamp
    });

    return entry;
}

function uniqueIds(ids = []) {
    return [...new Set(ids.filter(Boolean).map((value) => String(value)))];
}

async function createNotificationsForUsers({ userIds = [], role = '', type = 'shipment', title, message, shipment, metadata = {} }) {
    const uniqueUserIds = uniqueIds(userIds);
    if (!uniqueUserIds.length) {
        return [];
    }

    const docs = await Notification.insertMany(
        uniqueUserIds.map((userId) => ({
            userId,
            role,
            type,
            title,
            message,
            shipmentId: shipment?._id || null,
            trackingId: shipment?.trackingId || '',
            metadata
        }))
    );

    return docs.map((doc) => doc.toObject());
}

async function notifyRole({ role, type = 'system', title, message, shipment, metadata = {} }) {
    const users = await User.find({ role, isActive: true }).select('_id role').lean();
    return createNotificationsForUsers({
        userIds: users.map((user) => user._id),
        role,
        type,
        title,
        message,
        shipment,
        metadata
    });
}

function emitSocketEvent(req, eventName, payload) {
    const io = req.app.get('io');
    if (io) {
        io.emit(eventName, payload);
    }
}

function emitNotificationEvents(req, notifications = []) {
    const io = req.app.get('io');
    if (!io || !notifications.length) {
        return;
    }

    notifications.forEach((notification) => {
        io.to(`user:${notification.userId}`).emit('notification:new', notification);
        if (notification.role) {
            io.to(`role:${notification.role}`).emit('notification:new', notification);
        }
    });
}

function emitShipmentUpdate(req, shipment, extras = {}) {
    const io = req.app.get('io');
    if (!io) {
        return;
    }

    const payload = {
        shipmentId: shipment._id,
        trackingId: shipment.trackingId,
        status: shipment.status,
        assignedAgent: shipment.assignedAgent,
        paymentStatus: shipment.paymentStatus,
        ...extras
    };

    io.emit('shipments:refresh', payload);
    io.emit('dashboard:refresh', payload);
    io.emit('shipment:updated', payload);
}

module.exports = {
    appendShipmentLog,
    buildActor,
    buildTimelineEntry,
    createNotificationsForUsers,
    emitNotificationEvents,
    emitShipmentUpdate,
    emitSocketEvent,
    notifyRole
};
