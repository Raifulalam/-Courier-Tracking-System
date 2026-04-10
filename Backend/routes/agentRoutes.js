const express = require('express');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const {
    getAssignedPackages,
    toggleAvailability,
    getAgentDashboard
} = require('../controllers/agentController');

const router = express.Router();

router.get('/assigned', verifyToken, checkRole(['agent']), getAssignedPackages);
router.get('/dashboard', verifyToken, checkRole(['agent']), getAgentDashboard);
router.patch('/availability', verifyToken, checkRole(['agent']), toggleAvailability);

module.exports = router;
