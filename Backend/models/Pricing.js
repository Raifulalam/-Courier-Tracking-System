const mongoose = require('mongoose');

const pricingSchema = new mongoose.Schema(
    {
        sameCity: { type: Number, required: true, min: 0, default: 75 },
        sameDistrict: { type: Number, required: true, min: 0, default: 100 },
        sameProvince: { type: Number, required: true, min: 0, default: 150 },
        differentProvince: { type: Number, required: true, min: 0, default: 200 },
        perKgRate: { type: Number, required: true, min: 0, default: 2.5 },
        expressMultiplier: { type: Number, required: true, min: 1, default: 1.35 },
        codCharge: { type: Number, required: true, min: 0, default: 50 },
        currency: { type: String, default: 'NPR' }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Pricing', pricingSchema);
