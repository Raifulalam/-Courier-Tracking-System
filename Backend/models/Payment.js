const mongoose = require('mongoose');
const { PAYMENT_STATUSES } = require('../utils/packageLifecycle');

const paymentSchema = new mongoose.Schema(
    {
        shipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', required: true, index: true },
        trackingId: { type: String, required: true, trim: true, index: true },
        amount: { type: Number, required: true, min: 0 },
        currency: { type: String, trim: true, default: 'NPR' },
        method: { type: String, trim: true, default: 'mock' },
        status: { type: String, enum: PAYMENT_STATUSES, default: 'Unpaid', index: true },
        paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        paidByRole: { type: String, trim: true, default: '' },
        transactionId: { type: String, trim: true, default: '' },
        note: { type: String, trim: true, default: '' },
        paidAt: { type: Date, default: null }
    },
    { timestamps: true }
);

paymentSchema.index({ shipmentId: 1, createdAt: -1 });

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
