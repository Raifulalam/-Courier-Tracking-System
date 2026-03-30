const Package = require('../models/Package');
const {
    ADMIN_STATUS_OPTIONS,
    AGENT_STATUS_OPTIONS,
    STATUS_LABELS,
    getEstimatedDeliveryAt,
    isTransitionAllowed
} = require('../utils/packageLifecycle');

function buildActor(user) {
    return {
        _id: user._id,
        name: user.name,
        role: user.role
    };
}

function buildStatusUpdate(status, user, note = '', location = '') {
    return {
        status,
        label: STATUS_LABELS[status] || status,
        note: note?.trim() || '',
        location: location?.trim() || '',
        actor: buildActor(user),
        timestamp: new Date()
    };
}

function emitPackageEvent(req, eventName, payload) {
    const io = req.app.get('io');

    if (io) {
        io.emit(eventName, payload);
        io.emit('dashboard:refresh', { event: eventName, packageId: payload?._id || payload?.packageId });
    }
}

function userCanAccessPackage(currentUser, pkg) {
    if (!currentUser || !pkg) {
        return false;
    }

    if (currentUser.role === 'admin') {
        return true;
    }

    if (currentUser.role === 'sender') {
        return String(pkg.senderId) === String(currentUser._id);
    }

    if (currentUser.role === 'agent') {
        return String(pkg.assignedAgent?._id) === String(currentUser._id);
    }

    return false;
}

function mapPackageForPublicTracking(pkg) {
    return {
        _id: pkg._id,
        trackingNumber: pkg.trackingNumber,
        receiverName: pkg.receiverName,
        pickupAddress: pkg.pickupAddress,
        deliveryAddress: pkg.deliveryAddress,
        itemType: pkg.itemType,
        status: pkg.status,
        currentStatus: pkg.currentStatus,
        estimatedDeliveryAt: pkg.estimatedDeliveryAt,
        deliveredAt: pkg.deliveredAt,
        assignedAgent: pkg.assignedAgent
            ? {
                name: pkg.assignedAgent.name,
                phone: pkg.assignedAgent.phone
            }
            : null,
        statusUpdates: pkg.statusUpdates
    };
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getStatusBreakdown(packages) {
    return packages.reduce(
        (acc, pkg) => {
            acc.total += 1;

            if (['Requested', 'Approved', 'Scheduled'].includes(pkg.status)) {
                acc.pending += 1;
            }

            if (['Assigned', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delayed', 'Exception'].includes(pkg.status)) {
                acc.active += 1;
            }

            if (pkg.status === 'Delivered') {
                acc.delivered += 1;
            }

            if (pkg.status === 'Cancelled') {
                acc.cancelled += 1;
            }

            return acc;
        },
        { total: 0, pending: 0, active: 0, delivered: 0, cancelled: 0 }
    );
}

const createPackage = async (req, res) => {
    try {
        const {
            receiverName,
            receiverPhone,
            receiverEmail,
            pickupAddress,
            deliveryAddress,
            itemType,
            parcelCategory,
            weight,
            instructions,
            deliveryType,
            priority,
            paymentMode,
            codAmount,
            declaredValue,
            scheduledPickupAt,
            dimensions
        } = req.body;

        if (!receiverName || !receiverPhone || !pickupAddress || !deliveryAddress || !itemType || !weight) {
            return res.status(400).json({ message: 'Receiver, route, item, and weight details are required.' });
        }

        const packageDocument = await Package.create({
            senderId: req.user._id,
            senderSnapshot: {
                name: req.user.name,
                email: req.user.email,
                phone: req.user.phone
            },
            receiverName,
            receiverPhone,
            receiverEmail,
            pickupAddress,
            deliveryAddress,
            itemType,
            parcelCategory,
            weight: Number(weight),
            instructions,
            deliveryType,
            priority,
            paymentMode,
            codAmount: Number(codAmount || 0),
            declaredValue: Number(declaredValue || 0),
            scheduledPickupAt: scheduledPickupAt || null,
            estimatedDeliveryAt: getEstimatedDeliveryAt(deliveryType, scheduledPickupAt || new Date()),
            dimensions: {
                length: Number(dimensions?.length || 0),
                width: Number(dimensions?.width || 0),
                height: Number(dimensions?.height || 0)
            },
            status: 'Requested',
            currentStatus: 'Requested',
            statusUpdates: [buildStatusUpdate('Requested', req.user, 'Shipment request created.', pickupAddress)]
        });

        emitPackageEvent(req, 'package:created', packageDocument);

        return res.status(201).json({
            message: 'Shipment created successfully.',
            data: packageDocument
        });
    } catch (err) {
        return res.status(500).json({ message: 'Server error while creating shipment.', error: err.message });
    }
};

const updateStatus = async (req, res) => {
    try {
        const { packageId } = req.params;
        const { status, note, location } = req.body;

        if (!status) {
            return res.status(400).json({ message: 'A status value is required.' });
        }

        const pkg = await Package.findById(packageId);
        if (!pkg) {
            return res.status(404).json({ message: 'Shipment not found.' });
        }

        if (req.user.role === 'agent' && String(pkg.assignedAgent?._id) !== String(req.user._id)) {
            return res.status(403).json({ message: 'You can only update shipments assigned to you.' });
        }

        const allowedByRole = req.user.role === 'admin' ? ADMIN_STATUS_OPTIONS : AGENT_STATUS_OPTIONS;
        if (!allowedByRole.includes(status)) {
            return res.status(400).json({ message: `Status "${status}" is not allowed for your role.` });
        }

        if (!isTransitionAllowed(pkg.status, status) && req.user.role !== 'admin') {
            return res.status(400).json({ message: `Cannot move shipment from ${pkg.status} to ${status}.` });
        }

        pkg.status = status;
        pkg.currentStatus = status;

        if (status === 'Delivered') {
            pkg.deliveredAt = new Date();
        }

        pkg.statusUpdates.push(buildStatusUpdate(status, req.user, note, location || pkg.deliveryAddress));
        await pkg.save();

        emitPackageEvent(req, 'package:updated', pkg);

        return res.status(200).json({
            message: 'Shipment status updated successfully.',
            data: pkg
        });
    } catch (error) {
        return res.status(500).json({ message: 'Error updating shipment status.', error: error.message });
    }
};

const getUserPackages = async (req, res) => {
    try {
        const packages = await Package.find({ senderId: req.user._id }).sort({ updatedAt: -1 });

        return res.status(200).json({
            message: packages.length ? 'Shipments retrieved successfully.' : 'No shipments found for this sender.',
            data: packages,
            meta: getStatusBreakdown(packages)
        });
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching shipments.', error: error.message });
    }
};

const getPackageById = async (req, res) => {
    try {
        const pkg = await Package.findById(req.params.id);

        if (!pkg) {
            return res.status(404).json({ message: 'Shipment not found.' });
        }

        if (!userCanAccessPackage(req.user, pkg)) {
            return res.status(403).json({ message: 'You are not allowed to access this shipment.' });
        }

        return res.json({
            message: 'Shipment retrieved successfully.',
            data: pkg
        });
    } catch (err) {
        return res.status(500).json({ message: 'Internal server error.', error: err.message });
    }
};

const getAgentPackages = async (req, res) => {
    try {
        const packages = await Package.find({ 'assignedAgent._id': req.user._id }).sort({ updatedAt: -1 });

        return res.status(200).json({
            message: 'Assigned shipments fetched successfully.',
            data: packages,
            meta: getStatusBreakdown(packages)
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch assigned shipments.', error: error.message });
    }
};

const getSenderDashboard = async (req, res) => {
    try {
        const packages = await Package.find({ senderId: req.user._id }).sort({ updatedAt: -1 });
        const stats = getStatusBreakdown(packages);

        return res.status(200).json({
            message: 'Sender dashboard loaded successfully.',
            data: {
                stats,
                recentPackages: packages.slice(0, 5),
                upcomingDeliveries: packages
                    .filter(pkg => pkg.status !== 'Delivered' && pkg.status !== 'Cancelled')
                    .slice(0, 3)
            }
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load sender dashboard.', error: error.message });
    }
};

const getPublicTracking = async (req, res) => {
    try {
        const trackingNumber = req.params.trackingNumber?.trim();

        const pkg = await Package.findOne({
            trackingNumber: new RegExp(`^${escapeRegex(trackingNumber)}$`, 'i')
        });

        if (!pkg) {
            return res.status(404).json({ message: 'Tracking number not found.' });
        }

        return res.status(200).json({
            message: 'Tracking details loaded successfully.',
            data: mapPackageForPublicTracking(pkg)
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load tracking data.', error: error.message });
    }
};

module.exports = {
    createPackage,
    updateStatus,
    getUserPackages,
    getPackageById,
    getAgentPackages,
    getSenderDashboard,
    getPublicTracking
};
