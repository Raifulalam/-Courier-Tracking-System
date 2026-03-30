const mongoose = require('mongoose');

const deliveryAssignmentSchema = new mongoose.Schema(
    {
        packageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Package',
            required: true,
            index: true
        },
        agentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        notes: {
            type: String,
            trim: true,
            default: ''
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('DeliveryAssignment', deliveryAssignmentSchema);
