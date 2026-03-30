const mongoose = require('mongoose');
const {
    PACKAGE_STATUSES,
    STATUS_LABELS,
    generateTrackingNumber,
    getEstimatedDeliveryAt
} = require('../utils/packageLifecycle');

const actorSchema = new mongoose.Schema(
    {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: { type: String, trim: true },
        role: { type: String, trim: true }
    },
    { _id: false }
);

const statusUpdateSchema = new mongoose.Schema(
    {
        status: { type: String, enum: PACKAGE_STATUSES, required: true },
        label: { type: String, trim: true },
        note: { type: String, trim: true, default: '' },
        location: { type: String, trim: true, default: '' },
        timestamp: { type: Date, default: Date.now },
        actor: actorSchema
    },
    { _id: false }
);

const assignedAgentSchema = new mongoose.Schema(
    {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: { type: String, trim: true },
        phone: { type: String, trim: true },
        email: { type: String, trim: true }
    },
    { _id: false }
);

const dimensionsSchema = new mongoose.Schema(
    {
        length: { type: Number, default: 0, min: 0 },
        width: { type: Number, default: 0, min: 0 },
        height: { type: Number, default: 0, min: 0 }
    },
    { _id: false }
);

const packageSchema = new mongoose.Schema(
    {
        trackingNumber: {
            type: String,
            required: true,
            unique: true,
            index: true,
            default: generateTrackingNumber
        },
        senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        senderSnapshot: {
            name: { type: String, trim: true, default: '' },
            email: { type: String, trim: true, default: '' },
            phone: { type: String, trim: true, default: '' }
        },
        receiverName: { type: String, required: true, trim: true },
        receiverPhone: { type: String, required: true, trim: true },
        receiverEmail: { type: String, trim: true, lowercase: true, default: '' },
        pickupAddress: { type: String, required: true, trim: true },
        deliveryAddress: { type: String, required: true, trim: true },
        itemType: { type: String, required: true, trim: true },
        parcelCategory: { type: String, trim: true, default: 'Parcel' },
        weight: { type: Number, required: true, min: 0 },
        dimensions: { type: dimensionsSchema, default: () => ({}) },
        declaredValue: { type: Number, default: 0, min: 0 },
        instructions: { type: String, trim: true, default: '' },
        deliveryType: { type: String, enum: ['normal', 'express', 'sameDay'], default: 'normal' },
        priority: { type: String, enum: ['standard', 'priority', 'critical'], default: 'standard' },
        paymentMode: { type: String, enum: ['prepaid', 'cod'], default: 'prepaid' },
        codAmount: { type: Number, default: 0, min: 0 },
        scheduledPickupAt: { type: Date, default: null },
        estimatedDeliveryAt: { type: Date, default: null },
        deliveredAt: { type: Date, default: null },
        status: { type: String, enum: PACKAGE_STATUSES, default: 'Requested', index: true },
        currentStatus: { type: String, enum: PACKAGE_STATUSES, default: 'Requested', index: true },
        statusUpdates: {
            type: [statusUpdateSchema],
            default: () => [{ status: 'Requested', label: STATUS_LABELS.Requested }]
        },
        assignedAgent: { type: assignedAgentSchema, default: null }
    },
    { timestamps: true }
);

packageSchema.index({ 'assignedAgent._id': 1, status: 1 });

packageSchema.pre('validate', function syncProfessionalDefaults(next) {
    if (!this.status) {
        this.status = 'Requested';
    }

    this.currentStatus = this.status;

    if (!this.estimatedDeliveryAt) {
        this.estimatedDeliveryAt = getEstimatedDeliveryAt(this.deliveryType, this.createdAt || new Date());
    }

    if (!this.statusUpdates || this.statusUpdates.length === 0) {
        this.statusUpdates = [{ status: this.status, label: STATUS_LABELS[this.status] }];
    }

    next();
});

module.exports = mongoose.model('Package', packageSchema);
