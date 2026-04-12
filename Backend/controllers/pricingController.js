const Pricing = require('../models/Pricing');

const getPricing = async (req, res) => {
    try {
        let pricing = await Pricing.findOne();
        if (!pricing) {
            pricing = await Pricing.create({});
        }
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
        res.status(200).json({ message: 'Pricing updated successfully', pricing });
    } catch (error) {
        res.status(500).json({ message: 'Error updating pricing.', error: error.message });
    }
};

module.exports = {
    getPricing,
    updatePricing
};
