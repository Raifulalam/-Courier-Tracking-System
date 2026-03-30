const express = require('express');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const { getAssignedPackages } = require('../controllers/agentController');

const router = express.Router();

router.get('/assigned', verifyToken, checkRole(['agent']), getAssignedPackages);

module.exports = router;
