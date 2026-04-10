const Package = require('../models/Package');
const {
    emitNotificationEvents,
    notifyRole
} = require('../utils/shipmentEvents');

function summarizeShipments(shipments = []) {
    return shipments.reduce(
        (acc, shipment) => {
            acc.total += 1;
            if (shipment.status === 'Assigned') acc.assigned += 1;
            if (['Picked Up', 'In Transit', 'Out for Delivery'].includes(shipment.status)) acc.inTransit += 1;
            if (shipment.status === 'Delivered') acc.delivered += 1;
            return acc;
        },
        { total: 0, assigned: 0, inTransit: 0, delivered: 0 }
    );
}

exports.getAssignedPackages = async (req, res) => {
    const { status = 'All' } = req.query;

    try {
        const query = { 'assignedAgent._id': req.user._id };
        if (status !== 'All') {
            query.status = status;
        }

        const shipments = await Package.find(query).sort({ updatedAt: -1 }).lean();

        return res.status(200).json({
            message: 'Assigned deliveries loaded successfully.',
            data: shipments,
            meta: summarizeShipments(shipments)
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load assigned deliveries.' });
    }
};

exports.toggleAvailability = async (req, res) => {
    const { isAvailable } = req.body;

    try {
        if (typeof isAvailable !== 'boolean') {
            return res.status(400).json({ message: 'isAvailable must be provided as true or false.' });
        }

        req.user.isAvailable = isAvailable;
        req.user.lastSeenAt = new Date();
        await req.user.save();

        const assignedCount = await Package.countDocuments({
            'assignedAgent._id': req.user._id,
            status: { $nin: ['Delivered', 'Cancelled'] }
        });

        const notifications = await notifyRole({
            role: 'admin',
            type: 'agent.availability',
            title: `Agent ${req.user.name}`,
            message: `${req.user.name} is now ${isAvailable ? 'online and available' : 'offline and unavailable'} for new assignments.`,
            shipment: null,
            metadata: {
                agentId: req.user._id,
                isAvailable
            }
        });

        emitNotificationEvents(req, notifications);

        const io = req.app.get('io');
        if (io) {
            io.emit('agents:availability', {
                kind: 'agent-availability',
                agentId: req.user._id,
                name: req.user.name,
                isAvailable,
                currentAssignedDeliveries: assignedCount
            });
            io.emit('dashboard:refresh', {
                kind: 'agent-availability',
                agentId: req.user._id,
                isAvailable
            });
        }

        return res.status(200).json({
            message: `Agent is now ${isAvailable ? 'online' : 'offline'}.`,
            data: {
                id: req.user._id,
                name: req.user.name,
                isAvailable: req.user.isAvailable,
                currentAssignedDeliveries: assignedCount
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to update availability.' });
    }
};

exports.getAgentDashboard = async (req, res) => {
    try {
        const shipments = await Package.find({ 'assignedAgent._id': req.user._id }).sort({ updatedAt: -1 }).lean();

        return res.status(200).json({
            message: 'Agent dashboard loaded successfully.',
            data: {
                isAvailable: req.user.isAvailable,
                stats: summarizeShipments(shipments),
                shipments
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load agent dashboard.' });
    }
};
