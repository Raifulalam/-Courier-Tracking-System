const express = require('express');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const {
    getAllUsers,
    getAllPackages,
    assignAgentToPackage,
    getAgents,
    updateUserManagement
} = require('../controllers/adminController');
const { getPricing, updatePricing } = require('../controllers/pricingController');

const router = express.Router();

router.get('/users', verifyToken, checkRole(['admin']), getAllUsers);
router.patch('/users/:userId', verifyToken, checkRole(['admin']), updateUserManagement);
router.get('/packages', verifyToken, checkRole(['admin']), getAllPackages);
router.get('/agents', verifyToken, checkRole(['admin']), getAgents);
router.put('/shipments/:packageId/assign', verifyToken, checkRole(['admin']), assignAgentToPackage);

router.get('/pricing', verifyToken, checkRole(['admin']), getPricing);
router.put('/pricing', verifyToken, checkRole(['admin']), updatePricing);

module.exports = router;
