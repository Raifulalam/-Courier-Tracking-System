const Package = require('../models/Package');
const Payment = require('../models/Payment');
const User = require('../models/User');
const {
    createNotificationsForUsers,
    emitNotificationEvents,
    emitShipmentUpdate,
    notifyRole
} = require('../utils/shipmentEvents');
const { generateToken } = require('../utils/security');
const { initiateGatewayPayment, verifyGatewayPayment } = require('../utils/paymentGateway');

const AGENT_SHARE_RATE = 0.7;
const ADMIN_SHARE_RATE = 0.3;

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

function buildMonthBuckets(rows = [], monthsBack = 6) {
    const now = new Date();
    const buckets = Array.from({ length: monthsBack }, (_, index) => {
        const bucketDate = new Date(now.getFullYear(), now.getMonth() - (monthsBack - index - 1), 1);
        const key = `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}`;

        return {
            key,
            label: bucketDate.toLocaleDateString(undefined, { month: 'short' }),
            gross: 0,
            agentShare: 0,
            adminShare: 0
        };
    });

    const bucketMap = new Map(buckets.map((item) => [item.key, item]));

    rows.forEach((row) => {
        const date = new Date(row.paidAt || row.createdAt);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const bucket = bucketMap.get(key);

        if (!bucket) {
            return;
        }

        bucket.gross += row.amount;
        bucket.agentShare += row.agentShare;
        bucket.adminShare += row.adminShare;
    });

    return buckets;
}

function normalizeEndDate(value) {
    const parsed = new Date(value);
    parsed.setHours(23, 59, 59, 999);
    return parsed;
}

exports.getEarningsSummary = async (req, res) => {
    const { fromDate = '', toDate = '', agentId = '' } = req.query;

    try {
        let shipmentQuery = {};

        if (req.user.role === 'agent') {
            shipmentQuery = { 'assignedAgent._id': req.user._id };
        } else if (agentId) {
            shipmentQuery = { 'assignedAgent._id': agentId };
        }

        const shipments = await Package.find(shipmentQuery)
            .select('trackingId assignedAgent sender receiver packageType paymentAmount paymentStatus')
            .lean();

        const shipmentIds = shipments.map((shipment) => shipment._id);
        const shipmentMap = new Map(shipments.map((shipment) => [String(shipment._id), shipment]));

        const paymentQuery = {
            status: 'Paid',
            ...(req.user.role === 'admin' || shipmentIds.length
                ? { shipmentId: { $in: shipmentIds } }
                : { shipmentId: { $in: [] } })
        };

        const payments = await Payment.find(paymentQuery).sort({ paidAt: -1, createdAt: -1 }).lean();

        const parsedFrom = fromDate ? new Date(fromDate) : null;
        const parsedTo = toDate ? normalizeEndDate(toDate) : null;

        let rows = payments.map((payment) => {
            const shipment = shipmentMap.get(String(payment.shipmentId));
            const amount = Number(payment.amount || 0);
            const agentShare = Number((amount * AGENT_SHARE_RATE).toFixed(2));
            const adminShare = Number((amount * ADMIN_SHARE_RATE).toFixed(2));

            return {
                ...payment,
                amount,
                agentShare,
                adminShare,
                shipmentId: payment.shipmentId,
                agentId: shipment?.assignedAgent?._id || null,
                agentName: shipment?.assignedAgent?.name || 'Unassigned',
                senderName: shipment?.sender?.name || 'Unknown sender',
                receiverName: shipment?.receiver?.name || 'Unknown receiver',
                packageType: shipment?.packageType || 'Shipment',
                paidAt: payment.paidAt || payment.createdAt
            };
        });

        rows = rows.filter((row) => {
            const paidAt = new Date(row.paidAt || row.createdAt);
            if (parsedFrom && paidAt < parsedFrom) {
                return false;
            }
            if (parsedTo && paidAt > parsedTo) {
                return false;
            }
            return true;
        });

        const totals = rows.reduce(
            (acc, row) => {
                acc.gross += row.amount;
                acc.agentShare += row.agentShare;
                acc.adminShare += row.adminShare;
                acc.transactions += 1;
                return acc;
            },
            { gross: 0, agentShare: 0, adminShare: 0, transactions: 0 }
        );

        const agentBreakdownMap = rows.reduce((acc, row) => {
            const key = String(row.agentId || 'unassigned');
            if (!acc[key]) {
                acc[key] = {
                    agentId: row.agentId,
                    agentName: row.agentName,
                    transactions: 0,
                    gross: 0,
                    agentShare: 0,
                    adminShare: 0
                };
            }

            acc[key].transactions += 1;
            acc[key].gross += row.amount;
            acc[key].agentShare += row.agentShare;
            acc[key].adminShare += row.adminShare;
            return acc;
        }, {});

        const agentBreakdown = Object.values(agentBreakdownMap).sort((left, right) => right.agentShare - left.agentShare);

        const availableAgents = req.user.role === 'admin'
            ? await User.find({ role: 'agent', isActive: true }).select('name email isAvailable').sort({ name: 1 }).lean()
            : [];

        return res.status(200).json({
            message: 'Earnings summary loaded successfully.',
            data: {
                shareRates: {
                    agent: AGENT_SHARE_RATE,
                    admin: ADMIN_SHARE_RATE
                },
                totals,
                monthlyBreakdown: buildMonthBuckets(rows),
                recentTransactions: rows.slice(0, 20),
                agentBreakdown,
                agents: availableAgents
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load earnings summary.' });
    }
};

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

exports.initiateGateway = async (req, res) => {
    const { shipmentId } = req.params;
    const { method } = req.body;

    try {
        const shipment = await Package.findById(shipmentId);
        if (!shipment) return res.status(404).json({ message: 'Shipment not found.' });

        if (!userCanAccessPayment(req.user, shipment)) {
            return res.status(403).json({ message: 'Not authorized for this payment.' });
        }

        if (shipment.paymentStatus === 'Paid') {
             return res.status(400).json({ message: 'Shipment is already paid.' });
        }

        const gatewayData = await initiateGatewayPayment(req, shipment, method, shipment.paymentAmount);
        
        return res.status(200).json({
            message: 'Gateway initiated',
            data: gatewayData
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Gateway initiation failed.' });
    }
};

exports.verifyGateway = async (req, res) => {
    const { method } = req.params;
    const queryData = req.query;

    try {
        const verification = await verifyGatewayPayment(method, queryData);
        
        if (!verification.success) {
            return res.status(400).json({ message: 'Verification failed.' });
        }

        const shipment = await Package.findById(verification.shipmentId);
        if (!shipment) return res.status(404).json({ message: 'Shipment not found during verification.' });

        if (shipment.paymentStatus === 'Paid') {
            return res.status(200).json({ message: 'Already paid.', data: { shipmentId: shipment._id } });
        }

        // Complete the payment automatically under the system
        const transactionId = verification.transactionId || `PAY-${generateToken(5).toUpperCase()}`;

        const payment = await Payment.create({
            shipmentId: shipment._id,
            trackingId: shipment.trackingId,
            amount: shipment.paymentAmount,
            currency: shipment.currency,
            method,
            status: 'Paid',
            paidByRole: 'system', // Verified via gateway hook
            transactionId,
            paidAt: new Date()
        });

        shipment.paymentStatus = 'Paid';
        await shipment.save();

        const message = `Payment completed securely via ${method} for shipment ${shipment.trackingId}.`;

        const userNotifications = await createNotificationsForUsers({
            userIds: [shipment.senderUser, shipment.receiverUser, shipment.assignedAgent?._id].filter(Boolean),
            type: 'payment.updated',
            title: `Payment Paid`,
            message,
            shipment,
            metadata: { paymentId: payment._id, transactionId, method }
        });

        emitNotificationEvents(req, userNotifications);
        emitShipmentUpdate(req, shipment, { kind: 'payment', paymentStatus: shipment.paymentStatus });

        return res.status(200).json({
            message: 'Payment verified successfully.',
            data: { shipmentId: shipment._id }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Payment verification failed.' });
    }
};
