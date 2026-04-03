const express = require('express');
const { getPricing, updatePricing } = require('../controllers/pricingController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', getPricing);
router.put('/', verifyToken, checkRole(['admin']), updatePricing);

module.exports = router;
