const express = require('express');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const {
    getPayments,
    getShipmentPayments,
    payForShipment
} = require('../controllers/paymentController');

const router = express.Router();

router.get('/', verifyToken, checkRole(['admin', 'sender', 'receiver', 'agent']), getPayments);
router.get('/:shipmentId', verifyToken, checkRole(['admin', 'sender', 'receiver', 'agent']), getShipmentPayments);
router.post('/:shipmentId/pay', verifyToken, checkRole(['admin', 'sender', 'receiver']), payForShipment);

module.exports = router;
