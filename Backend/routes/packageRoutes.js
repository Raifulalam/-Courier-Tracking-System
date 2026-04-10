const express = require('express');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const {
    createPackage,
    updateStatus,
    verifyDelivery,
    getUserPackages,
    getPackageById,
    getAgentPackages,
    getSenderDashboard,
    getReceiverPackages,
    getReceiverDashboard,
    getPublicTracking
} = require('../controllers/packageController');

const router = express.Router();

router.get('/track/:trackingId', getPublicTracking);

router.post('/', verifyToken, checkRole(['sender']), createPackage);
router.get('/mine', verifyToken, checkRole(['sender']), getUserPackages);
router.get('/receiver', verifyToken, checkRole(['receiver']), getReceiverPackages);
router.get('/agent', verifyToken, checkRole(['agent']), getAgentPackages);
router.get('/sender/dashboard', verifyToken, checkRole(['sender']), getSenderDashboard);
router.get('/receiver/dashboard', verifyToken, checkRole(['receiver']), getReceiverDashboard);
router.put('/:packageId/status', verifyToken, checkRole(['agent', 'admin']), updateStatus);
router.post('/:packageId/verify-delivery', verifyToken, checkRole(['receiver', 'agent', 'admin']), verifyDelivery);
router.get('/:id', verifyToken, getPackageById);

module.exports = router;
