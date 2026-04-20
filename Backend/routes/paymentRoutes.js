const express = require('express');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const {
    getPayments,
    getShipmentPayments,
    payForShipment,
    getEarningsSummary,
    initiateGateway,
    verifyGateway
} = require('../controllers/paymentController');

const router = express.Router();

router.get('/', verifyToken, checkRole(['admin', 'sender', 'receiver', 'agent']), getPayments);
router.get('/earnings/summary', verifyToken, checkRole(['admin', 'agent']), getEarningsSummary);

// Gateway Routes
router.post('/:shipmentId/initiate', verifyToken, checkRole(['admin', 'sender', 'receiver']), initiateGateway);
router.get('/verify/:method', verifyGateway); // Publicly accessible to handle provider callbacks

router.get('/:shipmentId', verifyToken, checkRole(['admin', 'sender', 'receiver', 'agent']), getShipmentPayments);
router.post('/:shipmentId/pay', verifyToken, checkRole(['admin', 'sender', 'receiver']), payForShipment);

module.exports = router;
