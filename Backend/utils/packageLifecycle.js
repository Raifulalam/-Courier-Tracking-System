const SHIPMENT_STATUSES = [
    'Pending',
    'Assigned',
    'Picked Up',
    'In Transit',
    'Out for Delivery',
    'Delivered',
    'Cancelled'
];

const PAYMENT_STATUSES = ['Paid', 'Unpaid', 'Failed'];
const DELIVERY_VERIFICATION_METHODS = ['otp', 'qr'];

const ADMIN_STATUS_OPTIONS = [
    'Pending',
    'Assigned',
    'Picked Up',
    'In Transit',
    'Out for Delivery',
    'Delivered',
    'Cancelled'
];

const AGENT_STATUS_OPTIONS = ['Picked Up', 'In Transit', 'Out for Delivery'];

const STATUS_TRANSITIONS = {
    Pending: ['Assigned', 'Cancelled'],
    Assigned: ['Picked Up', 'Cancelled'],
    'Picked Up': ['In Transit', 'Cancelled'],
    'In Transit': ['Out for Delivery', 'Cancelled'],
    'Out for Delivery': ['Delivered', 'Cancelled'],
    Delivered: [],
    Cancelled: []
};

const STATUS_LABELS = {
    Pending: 'Shipment booked and waiting for assignment',
    Assigned: 'Delivery agent assigned',
    'Picked Up': 'Package picked up from sender',
    'In Transit': 'Shipment is moving through the network',
    'Out for Delivery': 'Agent is heading to the receiver',
    Delivered: 'Delivery completed and verified',
    Cancelled: 'Shipment cancelled'
};

function generateTrackingNumber() {
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const random = Math.random().toString(36).slice(2, 10).toUpperCase();
    return `NEX-${stamp}-${random}`;
}

function getEstimatedDeliveryAt(serviceLevel = 'standard', createdAt = new Date()) {
    const estimated = new Date(createdAt);
    const hoursByService = {
        standard: 72,
        express: 24,
        'same-day': 8
    };

    estimated.setHours(estimated.getHours() + (hoursByService[serviceLevel] || hoursByService.standard));
    return estimated;
}

function calculateShippingFee(weight = 0, serviceLevel = 'standard') {
    const parsedWeight = Math.max(Number(weight) || 0, 0);
    const baseByService = {
        standard: 12,
        express: 18,
        'same-day': 24
    };

    const base = baseByService[serviceLevel] || baseByService.standard;
    const weightCharge = Math.max(parsedWeight, 1) * 2.75;
    return Number((base + weightCharge).toFixed(2));
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
    DELIVERY_VERIFICATION_METHODS,
    PAYMENT_STATUSES,
    SHIPMENT_STATUSES,
    STATUS_LABELS,
    calculateShippingFee,
    generateTrackingNumber,
    getEstimatedDeliveryAt,
    isTransitionAllowed
};
