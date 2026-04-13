const Pricing = require('../models/Pricing');
const NodeCache = require('node-cache');
const pricingCache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour

const getPricing = async (req, res) => {
    try {
        const cachedPricing = pricingCache.get('pricing_config');
        if (cachedPricing) {
            return res.status(200).json(cachedPricing);
        }

        let pricing = await Pricing.findOne();
        if (!pricing) {
            pricing = await Pricing.create({});
        }
        
        pricingCache.set('pricing_config', pricing);
        res.status(200).json(pricing);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching pricing configuration.', error: error.message });
    }
};

const updatePricing = async (req, res) => {
    try {
        const { sameCity, sameDistrict, sameProvince, differentProvince, perKgRate, expressMultiplier, codCharge } = req.body;
        
        let pricing = await Pricing.findOne();
        if (!pricing) {
            pricing = new Pricing();
        }

        if (sameCity !== undefined) pricing.sameCity = sameCity;
        if (sameDistrict !== undefined) pricing.sameDistrict = sameDistrict;
        if (sameProvince !== undefined) pricing.sameProvince = sameProvince;
        if (differentProvince !== undefined) pricing.differentProvince = differentProvince;
        if (perKgRate !== undefined) pricing.perKgRate = perKgRate;
        if (expressMultiplier !== undefined) pricing.expressMultiplier = expressMultiplier;
        if (codCharge !== undefined) pricing.codCharge = codCharge;

        await pricing.save();
        
        // Invalidate cache immediately when config is updated
        pricingCache.del('pricing_config');

        res.status(200).json({ message: 'Pricing updated successfully', pricing });
    } catch (error) {
        res.status(500).json({ message: 'Error updating pricing.', error: error.message });
    }
};

module.exports = {
    getPricing,
    updatePricing
};
