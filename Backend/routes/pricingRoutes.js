const express = require('express');
const { getPricing, updatePricing, getPricingPreview } = require('../controllers/pricingController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', getPricing);
router.post('/preview', getPricingPreview);
router.put('/', verifyToken, checkRole(['admin']), updatePricing);

module.exports = router;
