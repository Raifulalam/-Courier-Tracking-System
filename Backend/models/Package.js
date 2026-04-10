const mongoose = require('mongoose');
const {
    PAYMENT_STATUSES,
    SHIPMENT_STATUSES,
    STATUS_LABELS,
    calculateShippingFee,
    generateTrackingNumber,
    getEstimatedDeliveryAt
} = require('../utils/packageLifecycle');

const actorSchema = new mongoose.Schema(
    {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: { type: String, trim: true, default: '' },
        role: { type: String, trim: true, default: '' }
    },
    { _id: false }
);

const personSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, trim: true, lowercase: true, default: '' },
        phone: { type: String, trim: true, default: '' },
        address: { type: String, required: true, trim: true }
    },
    { _id: false }
);

const statusUpdateSchema = new mongoose.Schema(
    {
        status: { type: String, enum: SHIPMENT_STATUSES, required: true },
        label: { type: String, trim: true, default: '' },
        note: { type: String, trim: true, default: '' },
        location: { type: String, trim: true, default: '' },
        timestamp: { type: Date, default: Date.now },
        actor: { type: actorSchema, default: () => ({}) }
    },
    { _id: false }
);

const assignedAgentSchema = new mongoose.Schema(
    {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: { type: String, trim: true, default: '' },
        email: { type: String, trim: true, default: '' },
        phone: { type: String, trim: true, default: '' },
        isAvailable: { type: Boolean, default: false }
    },
    { _id: false }
);

const shipmentSchema = new mongoose.Schema(
    {
        trackingId: {
            type: String,
            required: true,
            unique: true,
            index: true,
            default: generateTrackingNumber
        },
        senderUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        receiverUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
        sender: { type: personSchema, required: true },
        receiver: { type: personSchema, required: true },
        packageType: { type: String, required: true, trim: true },
        weight: { type: Number, required: true, min: 0.1 },
        serviceLevel: {
            type: String,
            enum: ['standard', 'express', 'same-day'],
            default: 'standard'
        },
        pickupAddress: { type: String, required: true, trim: true },
        deliveryAddress: { type: String, required: true, trim: true },
        notes: { type: String, trim: true, default: '' },
        status: { type: String, enum: SHIPMENT_STATUSES, default: 'Pending', index: true },
        assignedAgent: { type: assignedAgentSchema, default: null },
        paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'Unpaid', index: true },
        paymentAmount: { type: Number, min: 0, default: 0 },
        currency: { type: String, trim: true, default: 'USD' },
        otpHash: { type: String, trim: true, default: '' },
        otpExpiresAt: { type: Date, default: null },
        qrToken: { type: String, trim: true, default: '' },
        qrTokenHash: { type: String, trim: true, default: '' },
        qrExpiresAt: { type: Date, default: null },
        verificationMethod: { type: String, enum: ['otp', 'qr', ''], default: '' },
        receiverConfirmedAt: { type: Date, default: null },
        deliveryConfirmedBy: { type: actorSchema, default: null },
        outForDeliveryAt: { type: Date, default: null },
        deliveredAt: { type: Date, default: null },
        estimatedDeliveryAt: { type: Date, default: null },
        timeline: {
            type: [statusUpdateSchema],
            default: () => [{ status: 'Pending', label: STATUS_LABELS.Pending, note: 'Shipment created.' }]
        }
    },
    { timestamps: true }
);

shipmentSchema.index({ 'assignedAgent._id': 1, status: 1 });
shipmentSchema.index({ senderUser: 1, updatedAt: -1 });
shipmentSchema.index({ receiverUser: 1, updatedAt: -1 });
shipmentSchema.index({ status: 1, createdAt: -1 });

shipmentSchema.pre('validate', function syncShipmentDefaults(next) {
    if (!this.estimatedDeliveryAt) {
        this.estimatedDeliveryAt = getEstimatedDeliveryAt(this.serviceLevel, this.createdAt || new Date());
    }

    if (!this.paymentAmount) {
        this.paymentAmount = calculateShippingFee(this.weight, this.serviceLevel);
    }

    if (!this.timeline || this.timeline.length === 0) {
        this.timeline = [{ status: this.status, label: STATUS_LABELS[this.status], note: 'Shipment created.' }];
    }

    next();
});

module.exports = mongoose.models.Package || mongoose.model('Package', shipmentSchema, 'shipments');
