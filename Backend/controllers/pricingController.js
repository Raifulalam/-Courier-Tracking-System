const { calculateDeliveryPrice, getPricingSettings } = require('../utils/pricingEngine');

const pricingFields = [
    'sameCity',
    'sameDistrict',
    'sameProvince',
    'differentProvince',
    'perKgRate',
    'expressMultiplier',
    'codCharge'
];

function parsePricingPayload(body = {}) {
    return pricingFields.reduce((acc, field) => {
        if (body[field] !== undefined) {
            acc[field] = Number(body[field]);
        }

        return acc;
    }, {});
}

function hasInvalidPricingValues(payload = {}) {
    return Object.values(payload).some((value) => Number.isNaN(value) || value < 0);
}

const getPricing = async (_req, res) => {
    try {
        const pricing = await getPricingSettings();

        return res.status(200).json({
            message: 'Pricing configuration loaded successfully.',
            data: pricing
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load pricing configuration.', error: error.message });
    }
};

const updatePricing = async (req, res) => {
    try {
        const updates = parsePricingPayload(req.body);

        if (!Object.keys(updates).length) {
            return res.status(400).json({ message: 'At least one pricing field is required.' });
        }

        if (hasInvalidPricingValues(updates)) {
            return res.status(400).json({ message: 'Pricing values must be valid non-negative numbers.' });
        }

        if (updates.expressMultiplier !== undefined && updates.expressMultiplier < 1) {
            return res.status(400).json({ message: 'Express multiplier must be at least 1.' });
        }

        const pricing = await getPricingSettings();
        Object.assign(pricing, updates);
        await pricing.save();

        return res.status(200).json({
            message: 'Pricing configuration updated successfully.',
            data: pricing
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update pricing configuration.', error: error.message });
    }
};

const getPricingPreview = async (req, res) => {
    try {
        const pricing = await getPricingSettings();
        const breakdown = calculateDeliveryPrice({
            senderLocation: req.body.senderLocation,
            receiverLocation: req.body.receiverLocation,
            weight: req.body.weight,
            deliveryType: req.body.deliveryType,
            paymentMode: req.body.paymentMode,
            pricing
        });

        return res.status(200).json({
            message: 'Pricing preview generated successfully.',
            data: breakdown
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to generate pricing preview.', error: error.message });
    }
};

module.exports = {
    getPricing,
    updatePricing,
    getPricingPreview
};
