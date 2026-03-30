const express = require('express');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const {
    createPackage,
    updateStatus,
    getUserPackages,
    getPackageById,
    getAgentPackages,
    getSenderDashboard,
    getPublicTracking
} = require('../controllers/packageController');

const router = express.Router();

router.get('/public/:trackingNumber', getPublicTracking);

router.post('/', verifyToken, checkRole(['sender']), createPackage);
router.get('/mine', verifyToken, checkRole(['sender']), getUserPackages);
router.get('/agent', verifyToken, checkRole(['agent']), getAgentPackages);
router.get('/sender-dashboard', verifyToken, checkRole(['sender']), getSenderDashboard);
router.put('/:packageId/status', verifyToken, checkRole(['agent', 'admin']), updateStatus);
router.get('/:id', verifyToken, getPackageById);

module.exports = router;
