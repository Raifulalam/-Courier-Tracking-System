const PACKAGE_STATUSES = [
    'Requested',
    'Approved',
    'Scheduled',
    'Assigned',
    'Picked Up',
    'In Transit',
    'Out for Delivery',
    'Delivered',
    'Delayed',
    'Exception',
    'Cancelled'
];

const ADMIN_STATUS_OPTIONS = [
    'Approved',
    'Scheduled',
    'Assigned',
    'Delayed',
    'Exception',
    'Cancelled',
    'Delivered'
];

const AGENT_STATUS_OPTIONS = [
    'Picked Up',
    'In Transit',
    'Out for Delivery',
    'Delivered',
    'Delayed',
    'Exception'
];

const STATUS_TRANSITIONS = {
    Requested: ['Approved', 'Cancelled'],
    Approved: ['Scheduled', 'Assigned', 'Cancelled'],
    Scheduled: ['Assigned', 'Picked Up', 'Cancelled'],
    Assigned: ['Picked Up', 'Delayed', 'Exception', 'Cancelled'],
    'Picked Up': ['In Transit', 'Delayed', 'Exception'],
    'In Transit': ['Out for Delivery', 'Delayed', 'Exception'],
    'Out for Delivery': ['Delivered', 'Delayed', 'Exception'],
    Delayed: ['In Transit', 'Out for Delivery', 'Delivered', 'Exception', 'Cancelled'],
    Exception: ['In Transit', 'Out for Delivery', 'Cancelled'],
    Delivered: [],
    Cancelled: []
};

const STATUS_LABELS = {
    Requested: 'Order requested',
    Approved: 'Order approved',
    Scheduled: 'Pickup scheduled',
    Assigned: 'Courier assigned',
    'Picked Up': 'Parcel picked up',
    'In Transit': 'In transit',
    'Out for Delivery': 'Out for delivery',
    Delivered: 'Delivered successfully',
    Delayed: 'Delayed',
    Exception: 'Delivery exception',
    Cancelled: 'Cancelled'
};

function generateTrackingNumber() {
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `PTR-${stamp}-${random}`;
}

function getEstimatedDeliveryAt(serviceLevel, createdAt = new Date()) {
    const scheduled = new Date(createdAt);
    const hoursByService = {
        sameDay: 8,
        express: 24,
        normal: 72
    };

    scheduled.setHours(scheduled.getHours() + (hoursByService[serviceLevel] || hoursByService.normal));
    return scheduled;
}

function isTransitionAllowed(currentStatus, nextStatus) {
    if (!currentStatus || currentStatus === nextStatus) {
        return true;
    }

    return (STATUS_TRANSITIONS[currentStatus] || []).includes(nextStatus);
}

module.exports = {
    ADMIN_STATUS_OPTIONS,
    AGENT_STATUS_OPTIONS,
    PACKAGE_STATUSES,
    STATUS_LABELS,
    generateTrackingNumber,
    getEstimatedDeliveryAt,
    isTransitionAllowed
};
