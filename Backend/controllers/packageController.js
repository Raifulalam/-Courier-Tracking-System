const DeliveryLog = require('../models/DeliveryLog');
const Package = require('../models/Package');
const Payment = require('../models/Payment');
const User = require('../models/User');
const {
    AGENT_STATUS_OPTIONS,
    ADMIN_STATUS_OPTIONS,
    STATUS_LABELS,
    calculateShippingFee,
    getEstimatedDeliveryAt,
    isTransitionAllowed
} = require('../utils/packageLifecycle');
const { generateOtpCode, generateToken, hashValue, isHashMatch } = require('../utils/security');
const {
    appendShipmentLog,
    buildActor,
    createNotificationsForUsers,
    emitNotificationEvents,
    emitShipmentUpdate,
    notifyRole
} = require('../utils/shipmentEvents');
const { isPositiveNumber, isValidEmail, isValidPhone, normalizeEmail, normalizeText } = require('../utils/validation');

function isReceiverLinked(currentUser, shipment) {
    if (!currentUser || !shipment) {
        return false;
    }

    if (shipment.receiverUser && String(shipment.receiverUser) === String(currentUser._id)) {
        return true;
    }

    const shipmentEmail = normalizeEmail(shipment.receiver?.email);
    const shipmentPhone = normalizeText(shipment.receiver?.phone);

    return Boolean(
        (shipmentEmail && shipmentEmail === normalizeEmail(currentUser.email)) ||
        (shipmentPhone && shipmentPhone === normalizeText(currentUser.phone))
    );
}

function userCanAccessShipment(currentUser, shipment) {
    if (!currentUser || !shipment) {
        return false;
    }

    if (currentUser.role === 'admin') {
        return true;
    }

    if (currentUser.role === 'sender') {
        return String(shipment.senderUser) === String(currentUser._id);
    }

    if (currentUser.role === 'agent') {
        return String(shipment.assignedAgent?._id) === String(currentUser._id);
    }

    if (currentUser.role === 'receiver') {
        return isReceiverLinked(currentUser, shipment);
    }

    return false;
}

function summarizeShipments(shipments = []) {
    return shipments.reduce(
        (acc, shipment) => {
            acc.total += 1;

            if (shipment.status === 'Pending') {
                acc.pending += 1;
            }

            if (shipment.status === 'Assigned') {
                acc.assigned += 1;
            }

            if (['Picked Up', 'In Transit', 'Out for Delivery'].includes(shipment.status)) {
                acc.inTransit += 1;
            }

            if (shipment.status === 'Delivered') {
                acc.delivered += 1;
            }

            if (shipment.status === 'Cancelled') {
                acc.cancelled += 1;
            }

            if (shipment.paymentStatus === 'Unpaid') {
                acc.unpaid += 1;
            }

            return acc;
        },
        { total: 0, pending: 0, assigned: 0, inTransit: 0, delivered: 0, cancelled: 0, unpaid: 0 }
    );
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeShipment(shipment, currentUser) {
    const data = shipment.toObject ? shipment.toObject() : { ...shipment };

    delete data.otpHash;
    delete data.qrTokenHash;

    const canSeeQr = ['admin', 'agent'].includes(currentUser?.role) || isReceiverLinked(currentUser, shipment);
    if (!canSeeQr) {
        delete data.qrToken;
    }

    if (currentUser?.role !== 'receiver') {
        delete data.deliveryOtp;
    }

    return data;
}

async function syncInitialPayment(shipment) {
    await Payment.create({
        shipmentId: shipment._id,
        trackingId: shipment.trackingId,
        amount: shipment.paymentAmount,
        currency: shipment.currency,
        method: 'pending',
        status: shipment.paymentStatus,
        note: 'Shipment created. Waiting for payment.'
    });
}

async function linkReceiverUser({ receiverEmail, receiverPhone }) {
    const filters = [];

    if (receiverEmail) {
        filters.push({ email: normalizeEmail(receiverEmail), role: 'receiver' });
    }

    if (receiverPhone) {
        filters.push({ phone: normalizeText(receiverPhone), role: 'receiver' });
    }

    if (!filters.length) {
        return null;
    }

    return User.findOne({ $or: filters, isActive: true }).select('_id role').lean();
}

async function createStakeholderNotifications(req, shipment, message, type, metadata = {}) {
    const recipients = [
        shipment.senderUser,
        shipment.receiverUser,
        shipment.assignedAgent?._id
    ].filter(Boolean);

    const notifications = await createNotificationsForUsers({
        userIds: recipients,
        type,
        title: `Shipment ${shipment.trackingId}`,
        message,
        shipment,
        metadata
    });

    const adminNotifications = await notifyRole({
        role: 'admin',
        type,
        title: `Shipment ${shipment.trackingId}`,
        message,
        shipment,
        metadata
    });

    emitNotificationEvents(req, [...notifications, ...adminNotifications]);
}

async function createInitialDeliveryLog(shipment) {
    const firstEvent = shipment.timeline?.[0];
    if (!firstEvent) {
        return;
    }

    await DeliveryLog.create({
        shipmentId: shipment._id,
        trackingId: shipment.trackingId,
        status: firstEvent.status,
        label: firstEvent.label,
        note: firstEvent.note,
        location: firstEvent.location,
        actor: firstEvent.actor,
        eventAt: firstEvent.timestamp
    });
}

exports.createPackage = async (req, res) => {
    const {
        senderName,
        senderPhone,
        senderEmail,
        receiverName,
        receiverPhone,
        receiverEmail,
        packageType,
        weight,
        pickupAddress,
        deliveryAddress,
        notes,
        serviceLevel = 'standard'
    } = req.body;

    try {
        if (!receiverName || !receiverPhone || !packageType || !weight || !pickupAddress || !deliveryAddress) {
            return res.status(400).json({
                message: 'Receiver details, package type, weight, pickup address, and delivery address are required.'
            });
        }

        if (!isValidPhone(receiverPhone)) {
            return res.status(400).json({ message: 'Please provide a valid receiver phone number.' });
        }

        if (receiverEmail && !isValidEmail(receiverEmail)) {
            return res.status(400).json({ message: 'Please provide a valid receiver email address.' });
        }

        if (senderPhone && !isValidPhone(senderPhone)) {
            return res.status(400).json({ message: 'Please provide a valid sender phone number.' });
        }

        if (senderEmail && !isValidEmail(senderEmail)) {
            return res.status(400).json({ message: 'Please provide a valid sender email address.' });
        }

        if (!isPositiveNumber(weight)) {
            return res.status(400).json({ message: 'Weight must be greater than zero.' });
        }

        const receiverUser = await linkReceiverUser({ receiverEmail, receiverPhone });
        const shipment = await Package.create({
            senderUser: req.user._id,
            receiverUser: receiverUser?._id || null,
            sender: {
                name: normalizeText(senderName) || req.user.name,
                email: normalizeEmail(senderEmail) || req.user.email,
                phone: normalizeText(senderPhone) || req.user.phone,
                address: normalizeText(pickupAddress)
            },
            receiver: {
                name: normalizeText(receiverName),
                email: normalizeEmail(receiverEmail),
                phone: normalizeText(receiverPhone),
                address: normalizeText(deliveryAddress)
            },
            packageType: normalizeText(packageType),
            weight: Number(weight),
            serviceLevel,
            pickupAddress: normalizeText(pickupAddress),
            deliveryAddress: normalizeText(deliveryAddress),
            notes: normalizeText(notes),
            paymentStatus: 'Unpaid',
            paymentAmount: calculateShippingFee(weight, serviceLevel),
            estimatedDeliveryAt: getEstimatedDeliveryAt(serviceLevel)
        });

        shipment.timeline[0].actor = buildActor(req.user);
        shipment.timeline[0].location = shipment.pickupAddress;
        shipment.timeline[0].note = 'Shipment created by sender.';
        await shipment.save();

        await Promise.all([
            createInitialDeliveryLog(shipment),
            syncInitialPayment(shipment),
            createStakeholderNotifications(
                req,
                shipment,
                'A new shipment has been created and is waiting for assignment.',
                'shipment.created'
            )
        ]);

        emitShipmentUpdate(req, shipment, { kind: 'created' });

        return res.status(201).json({
            message: 'Shipment created successfully.',
            data: sanitizeShipment(shipment, req.user)
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to create shipment.' });
    }
};

exports.updateStatus = async (req, res) => {
    const { packageId } = req.params;
    const { status, note = '', location = '' } = req.body;

    try {
        if (!status) {
            return res.status(400).json({ message: 'A shipment status is required.' });
        }

        if (status === 'Delivered') {
            return res.status(400).json({
                message: 'Use the delivery verification endpoint to complete delivery with OTP or QR verification.'
            });
        }

        const shipment = await Package.findById(packageId);
        if (!shipment) {
            return res.status(404).json({ message: 'Shipment not found.' });
        }

        if (req.user.role === 'agent' && String(shipment.assignedAgent?._id) !== String(req.user._id)) {
            return res.status(403).json({ message: 'You can only update shipments assigned to you.' });
        }

        const allowedByRole = req.user.role === 'admin' ? ADMIN_STATUS_OPTIONS : AGENT_STATUS_OPTIONS;
        if (!allowedByRole.includes(status)) {
            return res.status(400).json({ message: `Status "${status}" is not allowed for your role.` });
        }

        if (!isTransitionAllowed(shipment.status, status) && req.user.role !== 'admin') {
            return res.status(400).json({
                message: `Cannot move shipment from ${shipment.status} to ${status}.`
            });
        }

        shipment.status = status;

        if (status === 'Out for Delivery') {
            const otpCode = generateOtpCode();
            const qrToken = `NEXQR-${shipment.trackingId}-${generateToken(6)}`;
            const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);

            shipment.otpHash = hashValue(otpCode);
            shipment.otpExpiresAt = expiresAt;
            shipment.qrToken = qrToken;
            shipment.qrTokenHash = hashValue(qrToken);
            shipment.qrExpiresAt = expiresAt;
            shipment.outForDeliveryAt = new Date();

            await createStakeholderNotifications(
                req,
                shipment,
                shipment.paymentStatus === 'Paid'
                    ? 'Shipment is out for delivery. Use the OTP or QR token to verify the final handoff.'
                    : 'Shipment is out for delivery, but payment is still pending before final confirmation.',
                'shipment.out_for_delivery',
                {
                    otpCode,
                    qrToken,
                    expiresAt,
                    paymentStatus: shipment.paymentStatus
                }
            );
        }

        await appendShipmentLog(
            shipment,
            status,
            req.user,
            normalizeText(note) || STATUS_LABELS[status],
            normalizeText(location) || (status === 'Picked Up' ? shipment.pickupAddress : shipment.deliveryAddress)
        );

        await shipment.save();
        emitShipmentUpdate(req, shipment, { kind: 'status', status });

        return res.status(200).json({
            message: 'Shipment status updated successfully.',
            data: sanitizeShipment(shipment, req.user)
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to update shipment status.' });
    }
};

exports.verifyDelivery = async (req, res) => {
    const { packageId } = req.params;
    const { otp = '', qrToken = '' } = req.body;

    try {
        const shipment = await Package.findById(packageId);
        if (!shipment) {
            return res.status(404).json({ message: 'Shipment not found.' });
        }

        if (!userCanAccessShipment(req.user, shipment)) {
            return res.status(403).json({ message: 'You are not allowed to verify this shipment.' });
        }

        if (shipment.status !== 'Out for Delivery') {
            return res.status(400).json({ message: 'Delivery verification is only available once the shipment is out for delivery.' });
        }

        if (shipment.paymentStatus !== 'Paid') {
            return res.status(400).json({ message: 'Payment must be completed before final delivery confirmation.' });
        }

        const now = Date.now();
        const validOtp = otp && shipment.otpExpiresAt && shipment.otpExpiresAt.getTime() > now && isHashMatch(otp, shipment.otpHash);
        const validQr = qrToken &&
            shipment.qrExpiresAt &&
            shipment.qrExpiresAt.getTime() > now &&
            (shipment.qrToken === qrToken || isHashMatch(qrToken, shipment.qrTokenHash));

        if (!validOtp && !validQr) {
            return res.status(400).json({ message: 'Invalid or expired OTP / QR token.' });
        }

        const verificationMethod = validOtp ? 'otp' : 'qr';
        shipment.status = 'Delivered';
        shipment.verificationMethod = verificationMethod;
        shipment.receiverConfirmedAt = new Date();
        shipment.deliveryConfirmedBy = buildActor(req.user);
        shipment.deliveredAt = new Date();

        await appendShipmentLog(
            shipment,
            'Delivered',
            req.user,
            `Delivery confirmed using ${verificationMethod.toUpperCase()} verification.`,
            shipment.deliveryAddress
        );

        await shipment.save();

        await createStakeholderNotifications(
            req,
            shipment,
            `Shipment delivery has been verified using ${verificationMethod.toUpperCase()}.`,
            'shipment.delivered',
            { verificationMethod }
        );

        emitShipmentUpdate(req, shipment, { kind: 'delivered', verificationMethod });

        return res.status(200).json({
            message: 'Delivery verified successfully.',
            data: sanitizeShipment(shipment, req.user)
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to verify delivery.' });
    }
};

exports.getUserPackages = async (req, res) => {
    try {
        const shipments = await Package.find({ senderUser: req.user._id }).sort({ updatedAt: -1 }).lean();

        return res.status(200).json({
            message: 'Sender shipments loaded successfully.',
            data: shipments.map((shipment) => sanitizeShipment(shipment, req.user)),
            meta: summarizeShipments(shipments)
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load shipments.' });
    }
};

exports.getReceiverPackages = async (req, res) => {
    try {
        const filters = [{ receiverUser: req.user._id }];
        if (req.user.email) {
            filters.push({ 'receiver.email': normalizeEmail(req.user.email) });
        }
        if (req.user.phone) {
            filters.push({ 'receiver.phone': normalizeText(req.user.phone) });
        }

        const shipments = await Package.find({ $or: filters }).sort({ updatedAt: -1 }).lean();

        return res.status(200).json({
            message: 'Incoming shipments loaded successfully.',
            data: shipments.map((shipment) => sanitizeShipment(shipment, req.user)),
            meta: summarizeShipments(shipments)
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load incoming shipments.' });
    }
};

exports.getAgentPackages = async (req, res) => {
    try {
        const shipments = await Package.find({ 'assignedAgent._id': req.user._id }).sort({ updatedAt: -1 }).lean();

        return res.status(200).json({
            message: 'Assigned deliveries loaded successfully.',
            data: shipments.map((shipment) => sanitizeShipment(shipment, req.user)),
            meta: summarizeShipments(shipments)
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load assigned deliveries.' });
    }
};

exports.getPackageById = async (req, res) => {
    try {
        const shipment = await Package.findById(req.params.id);
        if (!shipment) {
            return res.status(404).json({ message: 'Shipment not found.' });
        }

        if (!userCanAccessShipment(req.user, shipment)) {
            return res.status(403).json({ message: 'You are not allowed to view this shipment.' });
        }

        const payments = await Payment.find({ shipmentId: shipment._id }).sort({ createdAt: -1 }).lean();

        return res.status(200).json({
            message: 'Shipment loaded successfully.',
            data: {
                ...sanitizeShipment(shipment, req.user),
                payments
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load shipment.' });
    }
};

exports.getSenderDashboard = async (req, res) => {
    try {
        const shipments = await Package.find({ senderUser: req.user._id }).sort({ updatedAt: -1 }).lean();
        const payments = await Payment.find({ paidBy: req.user._id }).sort({ createdAt: -1 }).lean();
        const stats = summarizeShipments(shipments);

        return res.status(200).json({
            message: 'Sender dashboard loaded successfully.',
            data: {
                stats,
                recentShipments: shipments.slice(0, 6).map((shipment) => sanitizeShipment(shipment, req.user)),
                deliveryHistory: shipments
                    .filter((shipment) => shipment.status === 'Delivered')
                    .slice(0, 6)
                    .map((shipment) => sanitizeShipment(shipment, req.user)),
                outstandingPayments: shipments
                    .filter((shipment) => shipment.paymentStatus !== 'Paid')
                    .slice(0, 6)
                    .map((shipment) => sanitizeShipment(shipment, req.user)),
                paymentHistory: payments.slice(0, 10)
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load sender dashboard.' });
    }
};

exports.getReceiverDashboard = async (req, res) => {
    try {
        const filters = [{ receiverUser: req.user._id }];
        if (req.user.email) {
            filters.push({ 'receiver.email': normalizeEmail(req.user.email) });
        }
        if (req.user.phone) {
            filters.push({ 'receiver.phone': normalizeText(req.user.phone) });
        }

        const shipments = await Package.find({ $or: filters }).sort({ updatedAt: -1 }).lean();
        const stats = summarizeShipments(shipments);

        return res.status(200).json({
            message: 'Receiver dashboard loaded successfully.',
            data: {
                stats,
                incomingShipments: shipments.slice(0, 8).map((shipment) => sanitizeShipment(shipment, req.user)),
                pendingVerification: shipments
                    .filter((shipment) => shipment.status === 'Out for Delivery')
                    .map((shipment) => sanitizeShipment(shipment, req.user))
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load receiver dashboard.' });
    }
};

exports.getPublicTracking = async (req, res) => {
    try {
        const trackingId = normalizeText(req.params.trackingId);
        const shipment = await Package.findOne({ trackingId: new RegExp(`^${escapeRegex(trackingId)}$`, 'i') }).lean();

        if (!shipment) {
            return res.status(404).json({ message: 'Tracking ID not found.' });
        }

        return res.status(200).json({
            message: 'Tracking details loaded successfully.',
            data: {
                _id: shipment._id,
                trackingId: shipment.trackingId,
                sender: { name: shipment.sender?.name },
                receiver: { name: shipment.receiver?.name },
                packageType: shipment.packageType,
                weight: shipment.weight,
                pickupAddress: shipment.pickupAddress,
                deliveryAddress: shipment.deliveryAddress,
                status: shipment.status,
                paymentStatus: shipment.paymentStatus,
                estimatedDeliveryAt: shipment.estimatedDeliveryAt,
                deliveredAt: shipment.deliveredAt,
                assignedAgent: shipment.assignedAgent
                    ? {
                        name: shipment.assignedAgent.name,
                        phone: shipment.assignedAgent.phone
                    }
                    : null,
                timeline: shipment.timeline
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to load tracking details.' });
    }
};
