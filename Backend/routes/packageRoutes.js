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
    getPublicTracking
} = require('../controllers/packageController');
const { getPricing } = require('../controllers/pricingController');

const router = express.Router();

router.get('/track/:trackingId', getPublicTracking);
router.get('/pricing', verifyToken, getPricing);

router.post('/', verifyToken, checkRole(['sender']), createPackage);
router.get('/mine', verifyToken, checkRole(['sender']), getUserPackages);
router.get('/agent', verifyToken, checkRole(['agent']), getAgentPackages);
router.get('/sender/dashboard', verifyToken, checkRole(['sender']), getSenderDashboard);
router.put('/:packageId/status', verifyToken, checkRole(['agent', 'admin']), updateStatus);
router.post('/:packageId/verify-delivery', verifyToken, checkRole(['agent', 'admin']), verifyDelivery);
router.get('/:id', verifyToken, getPackageById);

module.exports = router;
