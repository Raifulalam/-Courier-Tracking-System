const DeliveryAssignment = require('../models/DeliveryAssignment');
const Package = require('../models/Package');
const User = require('../models/User');
const { STATUS_LABELS } = require('../utils/packageLifecycle');

function emitAdminPackageEvent(req, eventName, payload) {
    const io = req.app.get('io');

    if (io) {
        io.emit(eventName, payload);
        io.emit('dashboard:refresh', { event: eventName, packageId: payload?._id || payload?.packageId });
    }
}

function buildStatusUpdate(status, user, note, location = '') {
    return {
        status,
        label: STATUS_LABELS[status] || status,
        note: note || '',
        location,
        timestamp: new Date(),
        actor: {
            _id: user._id,
            name: user.name,
            role: user.role
        }
    };
}

const getAllUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select('-password')
            .sort({ createdAt: -1 })
            .lean();

        const byRole = users.reduce((acc, user) => {
            acc[user.role] = (acc[user.role] || 0) + 1;
            return acc;
        }, {});

        return res.json({
            message: 'Users fetched successfully.',
            data: {
                users,
                byRole
            }
        });
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching users.', error: error.message });
    }
};

const getAllPackages = async (req, res) => {
    try {
        const packages = await Package.find().sort({ updatedAt: -1 }).lean();

        const overview = packages.reduce(
            (acc, pkg) => {
                acc.total += 1;
                acc[pkg.status] = (acc[pkg.status] || 0) + 1;
                return acc;
            },
            { total: 0 }
        );

        return res.json({
            message: 'Shipments fetched successfully.',
            data: {
                packages,
                overview,
                recentActivity: packages.slice(0, 8)
            }
        });
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching shipments.', error: error.message });
    }
};

const deletePackage = async (req, res) => {
    try {
        const deleted = await Package.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({ message: 'Shipment not found.' });
        }

        emitAdminPackageEvent(req, 'package:deleted', { packageId: deleted._id });

        return res.json({ message: 'Shipment deleted successfully.' });
    } catch (err) {
        return res.status(500).json({ message: 'Failed to delete shipment.', error: err.message });
    }
};

const assignAgentToPackage = async (req, res) => {
    try {
        const { packageId } = req.params;
        const { agentId, notes } = req.body;

        const pkg = await Package.findById(packageId);
        if (!pkg) {
            return res.status(404).json({ message: 'Shipment not found.' });
        }

        const agent = await User.findById(agentId);
        if (!agent || agent.role !== 'agent') {
            return res.status(400).json({ message: 'Invalid agent selected.' });
        }
        if (!agent.isActive) {
            return res.status(400).json({ message: 'The selected agent account is inactive.' });
        }

        pkg.assignedAgent = {
            _id: agent._id,
            name: agent.name,
            phone: agent.phone,
            email: agent.email
        };
        pkg.status = 'Assigned';
        pkg.currentStatus = 'Assigned';
        pkg.statusUpdates.push(
            buildStatusUpdate(
                'Assigned',
                req.user,
                notes || `Shipment assigned to ${agent.name}.`,
                pkg.pickupAddress
            )
        );

        await pkg.save();

        await DeliveryAssignment.create({
            packageId: pkg._id,
            agentId: agent._id,
            assignedBy: req.user._id,
            notes
        });

        emitAdminPackageEvent(req, 'package:updated', pkg);

        return res.json({
            message: 'Agent assigned successfully.',
            data: pkg
        });
    } catch (error) {
        return res.status(500).json({ message: 'Error assigning agent.', error: error.message });
    }
};

module.exports = {
    getAllUsers,
    getAllPackages,
    deletePackage,
    assignAgentToPackage
};
