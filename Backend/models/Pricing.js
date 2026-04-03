const mongoose = require('mongoose');

const pricingSchema = new mongoose.Schema(
    {
        sameCity: { type: Number, required: true, min: 0, default: 80 },
        sameDistrict: { type: Number, required: true, min: 0, default: 140 },
        sameProvince: { type: Number, required: true, min: 0, default: 260 },
        differentProvince: { type: Number, required: true, min: 0, default: 420 },
        perKgRate: { type: Number, required: true, min: 0, default: 35 },
        expressMultiplier: { type: Number, required: true, min: 1, default: 1.35 },
        codCharge: { type: Number, required: true, min: 0, default: 50 }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Pricing', pricingSchema);
