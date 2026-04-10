const Package = require('../models/Package');
const User = require('../models/User');
const {
    STATUS_LABELS,
    isTransitionAllowed
} = require('../utils/packageLifecycle');
const {
    appendShipmentLog,
    createNotificationsForUsers,
    emitNotificationEvents,
    emitShipmentUpdate
} = require('../utils/shipmentEvents');
const { normalizeText } = require('../utils/validation');

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function summarizeShipments(shipments = []) {
    return shipments.reduce(
        (acc, shipment) => {
            acc.total += 1;

            if (shipment.status === 'Pending') acc.pending += 1;
            if (shipment.status === 'Assigned') acc.assigned += 1;
            if (['Picked Up', 'In Transit', 'Out for Delivery'].includes(shipment.status)) acc.inTransit += 1;
            if (shipment.status === 'Delivered') acc.delivered += 1;
            if (shipment.status === 'Cancelled') acc.cancelled += 1;

            return acc;
        },
        { total: 0, pending: 0, assigned: 0, inTransit: 0, delivered: 0, cancelled: 0 }
    );
}

function buildDailyTrend(shipments = []) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const counts = new Map();

    shipments.forEach((shipment) => {
        const date = new Date(shipment.createdAt);
        date.setHours(0, 0, 0, 0);
        const key = date.toISOString().slice(0, 10);
        counts.set(key, (counts.get(key) || 0) + 1);
    });

    return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(today);
        day.setDate(today.getDate() - (6 - index));
        const key = day.toISOString().slice(0, 10);

        return {
            date: key,
            label: day.toLocaleDateString(undefined, { weekday: 'short' }),
            count: counts.get(key) || 0
        };
    });
}

async function getAgentLoadMap() {
    const activeShipments = await Package.find({
        status: { $nin: ['Delivered', 'Cancelled'] },
        'assignedAgent._id': { $exists: true, $ne: null }
    }).select('assignedAgent').lean();

    return activeShipments.reduce((acc, shipment) => {
        const agentId = shipment.assignedAgent?._id;
        if (!agentId) {
            return acc;
        }

        const key = String(agentId);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
}

exports.getAllUsers = async (_req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 }).lean();
        const byRole = users.reduce((acc, user) => {
            acc[user.role] = (acc[user.role] || 0) + 1;
            return acc;
        }, {});

        return res.status(200).json({
            message: 'Users loaded successfully.',
            data: {
                users,
                byRole
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load users.' });
    }
};

exports.getAllPackages = async (req, res) => {
    const { status = 'All', search = '', date = '', page = 1, limit = 10 } = req.query;

    try {
        const query = {};

        if (status && status !== 'All') {
            query.status = status;
        }

        if (date) {
            const start = new Date(date);
            const end = new Date(date);
            end.setDate(end.getDate() + 1);
            query.createdAt = { $gte: start, $lt: end };
        }

        if (search) {
            const pattern = new RegExp(escapeRegex(search), 'i');
            query.$or = [
                { trackingId: pattern },
                { 'sender.name': pattern },
                { 'receiver.name': pattern },
                { deliveryAddress: pattern },
                { packageType: pattern }
            ];
        }

        const pageNumber = Math.max(Number(page) || 1, 1);
        const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 50);
        const skip = (pageNumber - 1) * pageSize;

        const [shipments, total, allShipments, users, loadMap] = await Promise.all([
            Package.find(query).sort({ updatedAt: -1 }).skip(skip).limit(pageSize).lean(),
            Package.countDocuments(query),
            Package.find().sort({ createdAt: -1 }).lean(),
            User.find().select('-password').lean(),
            getAgentLoadMap()
        ]);

        const agents = users
            .filter((user) => user.role === 'agent')
            .map((agent) => ({
                ...agent,
                currentAssignedDeliveries: loadMap[String(agent._id)] || 0
            }));

        const performance = agents
            .map((agent) => ({
                _id: agent._id,
                name: agent.name,
                isAvailable: agent.isAvailable,
                currentAssignedDeliveries: agent.currentAssignedDeliveries
            }))
            .sort((left, right) => right.currentAssignedDeliveries - left.currentAssignedDeliveries);

        const usersByRole = users.reduce((acc, user) => {
            acc[user.role] = (acc[user.role] || 0) + 1;
            return acc;
        }, {});

        return res.status(200).json({
            message: 'Admin shipment workspace loaded successfully.',
            data: {
                shipments,
                stats: summarizeShipments(allShipments),
                analytics: {
                    dailyVolume: buildDailyTrend(allShipments),
                    performance
                },
                agents,
                usersByRole
            },
            meta: {
                page: pageNumber,
                limit: pageSize,
                total,
                totalPages: Math.ceil(total / pageSize) || 1
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load admin workspace.' });
    }
};

exports.assignAgentToPackage = async (req, res) => {
    const { packageId } = req.params;
    const { agentId, note = '' } = req.body;

    try {
        const shipment = await Package.findById(packageId);
        if (!shipment) {
            return res.status(404).json({ message: 'Shipment not found.' });
        }

        if (!['Pending', 'Assigned'].includes(shipment.status)) {
            return res.status(400).json({ message: 'Only pending or already-assigned shipments can be reassigned.' });
        }

        const agent = await User.findById(agentId);
        if (!agent || agent.role !== 'agent') {
            return res.status(400).json({ message: 'Please select a valid delivery agent.' });
        }

        if (!agent.isActive) {
            return res.status(400).json({ message: 'The selected agent account is inactive.' });
        }

        if (!agent.isAvailable) {
            return res.status(400).json({ message: 'The selected agent is currently offline and cannot be assigned.' });
        }

        shipment.assignedAgent = {
            _id: agent._id,
            name: agent.name,
            email: agent.email,
            phone: agent.phone,
            isAvailable: agent.isAvailable
        };

        if (!isTransitionAllowed(shipment.status, 'Assigned') && shipment.status !== 'Assigned') {
            return res.status(400).json({
                message: `Cannot move shipment from ${shipment.status} to Assigned.`
            });
        }

        shipment.status = 'Assigned';
        await appendShipmentLog(
            shipment,
            'Assigned',
            req.user,
            normalizeText(note) || `Shipment assigned to ${agent.name}.`,
            shipment.pickupAddress
        );
        await shipment.save();

        const notifications = await createNotificationsForUsers({
            userIds: [shipment.senderUser, shipment.receiverUser, agent._id].filter(Boolean),
            type: 'shipment.assigned',
            title: `Shipment ${shipment.trackingId}`,
            message: `Shipment has been assigned to agent ${agent.name}.`,
            shipment,
            metadata: {
                agentId: agent._id,
                agentName: agent.name
            }
        });

        emitNotificationEvents(req, notifications);
        emitShipmentUpdate(req, shipment, { kind: 'assigned', agentId: agent._id });

        return res.status(200).json({
            message: 'Agent assigned successfully.',
            data: shipment
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to assign agent.' });
    }
};

exports.getAgents = async (_req, res) => {
    try {
        const [agents, loadMap] = await Promise.all([
            User.find({ role: 'agent', isActive: true }).select('-password').sort({ name: 1 }).lean(),
            getAgentLoadMap()
        ]);

        const payload = agents.map((agent) => ({
            ...agent,
            currentAssignedDeliveries: loadMap[String(agent._id)] || 0
        }));

        return res.status(200).json({
            message: 'Agents loaded successfully.',
            data: payload
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load agents.' });
    }
};
