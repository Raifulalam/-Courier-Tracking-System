const express = require('express');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const {
    getAllUsers,
    getAllPackages,
    deletePackage,
    assignAgentToPackage
} = require('../controllers/adminController');

const router = express.Router();

router.get('/users', verifyToken, checkRole(['admin']), getAllUsers);
router.get('/packages', verifyToken, checkRole(['admin']), getAllPackages);
router.delete('/package/:id', verifyToken, checkRole(['admin']), deletePackage);
router.put('/assign/:packageId', verifyToken, checkRole(['admin']), assignAgentToPackage);

module.exports = router;
