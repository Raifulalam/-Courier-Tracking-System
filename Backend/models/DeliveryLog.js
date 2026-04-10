const mongoose = require('mongoose');
const { SHIPMENT_STATUSES } = require('../utils/packageLifecycle');

const deliveryLogSchema = new mongoose.Schema(
    {
        shipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', required: true, index: true },
        trackingId: { type: String, required: true, trim: true, index: true },
        status: { type: String, enum: SHIPMENT_STATUSES, required: true },
        label: { type: String, trim: true, default: '' },
        note: { type: String, trim: true, default: '' },
        location: { type: String, trim: true, default: '' },
        actor: {
            _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            name: { type: String, trim: true, default: '' },
            role: { type: String, trim: true, default: '' }
        },
        eventAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

deliveryLogSchema.index({ shipmentId: 1, eventAt: 1 });

module.exports = mongoose.models.DeliveryLog || mongoose.model('DeliveryLog', deliveryLogSchema);
