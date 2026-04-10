const express = require('express');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const {
    getAllUsers,
    getAllPackages,
    assignAgentToPackage,
    getAgents
} = require('../controllers/adminController');

const router = express.Router();

router.get('/users', verifyToken, checkRole(['admin']), getAllUsers);
router.get('/packages', verifyToken, checkRole(['admin']), getAllPackages);
router.get('/agents', verifyToken, checkRole(['admin']), getAgents);
router.put('/shipments/:packageId/assign', verifyToken, checkRole(['admin']), assignAgentToPackage);

module.exports = router;
