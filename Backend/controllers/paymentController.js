const Package = require('../models/Package');
const Payment = require('../models/Payment');
const {
    createNotificationsForUsers,
    emitNotificationEvents,
    emitShipmentUpdate,
    notifyRole
} = require('../utils/shipmentEvents');
const { generateToken } = require('../utils/security');

function userCanAccessPayment(user, shipment) {
    if (!user || !shipment) {
        return false;
    }

    if (user.role === 'admin') {
        return true;
    }

    if (user.role === 'sender' && String(shipment.senderUser) === String(user._id)) {
        return true;
    }

    if (user.role === 'receiver' && (
        String(shipment.receiverUser) === String(user._id) ||
        String(shipment.receiver?.email || '').toLowerCase() === String(user.email || '').toLowerCase() ||
        String(shipment.receiver?.phone || '') === String(user.phone || '')
    )) {
        return true;
    }

    if (user.role === 'agent' && String(shipment.assignedAgent?._id) === String(user._id)) {
        return true;
    }

    return false;
}

exports.getPayments = async (req, res) => {
    try {
        let shipmentIds = [];

        if (req.user.role === 'admin') {
            shipmentIds = null;
        } else if (req.user.role === 'sender') {
            const shipments = await Package.find({ senderUser: req.user._id }).select('_id').lean();
            shipmentIds = shipments.map((shipment) => shipment._id);
        } else if (req.user.role === 'receiver') {
            const receiverFilters = [{ receiverUser: req.user._id }];
            if (req.user.email) {
                receiverFilters.push({ 'receiver.email': String(req.user.email || '').toLowerCase() });
            }
            if (req.user.phone) {
                receiverFilters.push({ 'receiver.phone': String(req.user.phone || '') });
            }

            const shipments = await Package.find({
                $or: receiverFilters
            }).select('_id').lean();
            shipmentIds = shipments.map((shipment) => shipment._id);
        } else {
            const shipments = await Package.find({ 'assignedAgent._id': req.user._id }).select('_id').lean();
            shipmentIds = shipments.map((shipment) => shipment._id);
        }

        const query = shipmentIds ? { shipmentId: { $in: shipmentIds } } : {};
        const payments = await Payment.find(query).sort({ createdAt: -1 }).lean();

        return res.status(200).json({
            message: 'Payment history loaded successfully.',
            data: payments
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load payment history.' });
    }
};

exports.getShipmentPayments = async (req, res) => {
    try {
        const shipment = await Package.findById(req.params.shipmentId);
        if (!shipment) {
            return res.status(404).json({ message: 'Shipment not found.' });
        }

        if (!userCanAccessPayment(req.user, shipment)) {
            return res.status(403).json({ message: 'You are not allowed to view this payment history.' });
        }

        const payments = await Payment.find({ shipmentId: shipment._id }).sort({ createdAt: -1 }).lean();

        return res.status(200).json({
            message: 'Shipment payments loaded successfully.',
            data: payments
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load shipment payments.' });
    }
};

exports.payForShipment = async (req, res) => {
    const { shipmentId } = req.params;
    const { method = 'Mock Stripe', outcome = 'success', note = '' } = req.body;

    try {
        const shipment = await Package.findById(shipmentId);
        if (!shipment) {
            return res.status(404).json({ message: 'Shipment not found.' });
        }

        if (!userCanAccessPayment(req.user, shipment)) {
            return res.status(403).json({ message: 'You are not allowed to pay for this shipment.' });
        }

        const status = outcome === 'failed' ? 'Failed' : 'Paid';
        const transactionId = `PAY-${generateToken(5).toUpperCase()}`;

        const payment = await Payment.create({
            shipmentId: shipment._id,
            trackingId: shipment.trackingId,
            amount: shipment.paymentAmount,
            currency: shipment.currency,
            method,
            status,
            paidBy: req.user._id,
            paidByRole: req.user.role,
            transactionId,
            note,
            paidAt: status === 'Paid' ? new Date() : null
        });

        shipment.paymentStatus = status;
        await shipment.save();

        const message = status === 'Paid'
            ? `Payment completed for shipment ${shipment.trackingId}.`
            : `Payment failed for shipment ${shipment.trackingId}.`;

        const userNotifications = await createNotificationsForUsers({
            userIds: [shipment.senderUser, shipment.receiverUser, shipment.assignedAgent?._id].filter(Boolean),
            type: 'payment.updated',
            title: `Payment ${status}`,
            message,
            shipment,
            metadata: {
                paymentId: payment._id,
                transactionId,
                status,
                amount: shipment.paymentAmount
            }
        });

        const adminNotifications = await notifyRole({
            role: 'admin',
            type: 'payment.updated',
            title: `Payment ${status}`,
            message,
            shipment,
            metadata: {
                paymentId: payment._id,
                transactionId,
                status,
                amount: shipment.paymentAmount
            }
        });

        emitNotificationEvents(req, [...userNotifications, ...adminNotifications]);
        emitShipmentUpdate(req, shipment, { kind: 'payment', paymentStatus: shipment.paymentStatus });

        return res.status(200).json({
            message: status === 'Paid' ? 'Payment completed successfully.' : 'Payment failed.',
            data: payment
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to process payment.' });
    }
};
