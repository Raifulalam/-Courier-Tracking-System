const Package = require('../models/Package');
const {
    ADMIN_STATUS_OPTIONS,
    AGENT_STATUS_OPTIONS,
    STATUS_LABELS,
    getEstimatedDeliveryAt,
    isTransitionAllowed
} = require('../utils/packageLifecycle');
const { formatLocationLabel, isValidLocation } = require('../utils/locationCatalog');
const { calculateDeliveryPrice, getPricingSettings } = require('../utils/pricingEngine');
const { isNonNegativeNumber, isPositiveNumber, isValidEmail, isValidPhone, normalizeText } = require('../utils/validation');

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

    if (currentUser.role === 'receiver') {
        const receiverEmail = String(pkg.receiverEmail || '').trim().toLowerCase();
        const receiverPhone = String(pkg.receiverPhone || '').trim();
        const currentEmail = String(currentUser.email || '').trim().toLowerCase();
        const currentPhone = String(currentUser.phone || '').trim();

        return Boolean(
            (receiverEmail && currentEmail && receiverEmail === currentEmail) ||
            (receiverPhone && currentPhone && receiverPhone === currentPhone)
        );
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
        shippingCharge: pkg.shippingCharge,
        pricingSnapshot: pkg.pricingSnapshot,
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
            dimensions,
            province,
            district,
            city
        } = req.body;

        if (!receiverName || !receiverPhone || !itemType || !weight) {
            return res.status(400).json({ message: 'Receiver, item, and weight details are required.' });
        }

        if (!isValidPhone(receiverPhone)) {
            return res.status(400).json({ message: 'Please provide a valid receiver phone number.' });
        }

        if (receiverEmail && !isValidEmail(receiverEmail)) {
            return res.status(400).json({ message: 'Please provide a valid receiver email address.' });
        }

        const senderLocation = {
            province: req.user.province,
            district: req.user.district,
            city: req.user.city
        };
        const receiverLocation = { province, district, city };
        const normalizedWeight = Number(weight);

        if (!isValidLocation(senderLocation)) {
            return res.status(400).json({
                message: 'Your sender profile is missing a valid province, district, and city.'
            });
        }

        if (!isValidLocation(receiverLocation)) {
            return res.status(400).json({
                message: 'Receiver destination must include a valid province, district, and city.'
            });
        }

        if (!isPositiveNumber(weight)) {
            return res.status(400).json({ message: 'Weight must be greater than zero.' });
        }

        if (paymentMode === 'cod' && !isPositiveNumber(codAmount)) {
            return res.status(400).json({ message: 'COD shipments must include a positive COD amount.' });
        }

        if (declaredValue && !isNonNegativeNumber(declaredValue)) {
            return res.status(400).json({ message: 'Declared value must be a non-negative number.' });
        }

        if (scheduledPickupAt && Number.isNaN(new Date(scheduledPickupAt).getTime())) {
            return res.status(400).json({ message: 'Scheduled pickup time is invalid.' });
        }

        const pricing = await getPricingSettings();
        const pricingSnapshot = calculateDeliveryPrice({
            senderLocation,
            receiverLocation,
            weight: normalizedWeight,
            deliveryType,
            paymentMode,
            pricing
        });
        const pickupAddress = formatLocationLabel(senderLocation);
        const deliveryAddress = formatLocationLabel(receiverLocation);

        const packageDocument = await Package.create({
            senderId: req.user._id,
            senderSnapshot: {
                name: req.user.name,
                email: req.user.email,
                phone: req.user.phone
            },
            receiverName: normalizeText(receiverName),
            receiverPhone: normalizeText(receiverPhone),
            receiverEmail: normalizeText(receiverEmail),
            senderLocation,
            receiverLocation,
            pickupAddress,
            deliveryAddress,
            itemType: normalizeText(itemType),
            parcelCategory: normalizeText(parcelCategory) || 'Parcel',
            weight: normalizedWeight,
            instructions: normalizeText(instructions),
            deliveryType,
            priority,
            paymentMode,
            codAmount: Number(codAmount || 0),
            declaredValue: Number(declaredValue || 0),
            shippingCharge: pricingSnapshot.totalPrice,
            pricingSnapshot,
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
        } else if (pkg.deliveredAt) {
            pkg.deliveredAt = null;
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
        const packages = await Package.find({ senderId: req.user._id }).sort({ updatedAt: -1 }).lean();

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
        const pkg = await Package.findById(req.params.id).lean();

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
        const packages = await Package.find({ 'assignedAgent._id': req.user._id }).sort({ updatedAt: -1 }).lean();

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
        const packages = await Package.find({ senderId: req.user._id }).sort({ updatedAt: -1 }).lean();
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

const getReceiverPackages = async (req, res) => {
    try {
        const receiverEmail = String(req.user.email || '').trim().toLowerCase();
        const receiverPhone = String(req.user.phone || '').trim();
        const receiverFilters = [];

        if (receiverEmail) {
            receiverFilters.push({ receiverEmail });
        }

        if (receiverPhone) {
            receiverFilters.push({ receiverPhone });
        }

        if (receiverFilters.length === 0) {
            return res.status(200).json({
                message: 'Receiver account has no matching contact identifier for incoming shipments yet.',
                data: [],
                meta: getStatusBreakdown([])
            });
        }

        const packages = await Package.find({ $or: receiverFilters }).sort({ updatedAt: -1 }).lean();

        return res.status(200).json({
            message: 'Incoming shipments loaded successfully.',
            data: packages,
            meta: getStatusBreakdown(packages)
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch incoming shipments.', error: error.message });
    }
};

const getReceiverDashboard = async (req, res) => {
    try {
        const receiverEmail = String(req.user.email || '').trim().toLowerCase();
        const receiverPhone = String(req.user.phone || '').trim();
        const receiverFilters = [];

        if (receiverEmail) {
            receiverFilters.push({ receiverEmail });
        }

        if (receiverPhone) {
            receiverFilters.push({ receiverPhone });
        }

        const packages = receiverFilters.length
            ? await Package.find({ $or: receiverFilters }).sort({ updatedAt: -1 }).lean()
            : [];
        const stats = getStatusBreakdown(packages);

        return res.status(200).json({
            message: 'Receiver dashboard loaded successfully.',
            data: {
                stats,
                incomingPackages: packages.slice(0, 5),
                activePackages: packages
                    .filter(pkg => !['Delivered', 'Cancelled'].includes(pkg.status))
                    .slice(0, 3)
            }
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load receiver dashboard.', error: error.message });
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
    getReceiverPackages,
    getReceiverDashboard,
    getPublicTracking
};
