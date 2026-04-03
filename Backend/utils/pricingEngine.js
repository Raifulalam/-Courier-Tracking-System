const Pricing = require('../models/Pricing');
const { normalizeLocationValue } = require('./locationCatalog');

function roundCurrency(value) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function getRouteType(senderLocation = {}, receiverLocation = {}) {
    const senderCity = normalizeLocationValue(senderLocation.city);
    const receiverCity = normalizeLocationValue(receiverLocation.city);
    const senderDistrict = normalizeLocationValue(senderLocation.district);
    const receiverDistrict = normalizeLocationValue(receiverLocation.district);
    const senderProvince = normalizeLocationValue(senderLocation.province);
    const receiverProvince = normalizeLocationValue(receiverLocation.province);

    if (senderCity && receiverCity && senderCity === receiverCity) {
        return 'sameCity';
    }

    if (senderDistrict && receiverDistrict && senderDistrict === receiverDistrict) {
        return 'sameDistrict';
    }

    if (senderProvince && receiverProvince && senderProvince === receiverProvince) {
        return 'sameProvince';
    }

    return 'differentProvince';
}

function getDeliveryMultiplier(deliveryType, pricing) {
    return deliveryType === 'express' ? Number(pricing.expressMultiplier || 1) : 1;
}

function calculateDeliveryPrice({
    senderLocation,
    receiverLocation,
    weight,
    deliveryType = 'normal',
    paymentMode = 'prepaid',
    pricing
}) {
    const normalizedWeight = Math.max(Number(weight || 0), 0);
    const routeType = getRouteType(senderLocation, receiverLocation);
    const basePrice = Number(pricing[routeType] || 0);
    const weightCharge = normalizedWeight * Number(pricing.perKgRate || 0);
    const deliveryMultiplier = getDeliveryMultiplier(deliveryType, pricing);
    const codCharge = paymentMode === 'cod' ? Number(pricing.codCharge || 0) : 0;
    const subtotal = (basePrice + weightCharge) * deliveryMultiplier;
    const totalPrice = subtotal + codCharge;

    return {
        routeType,
        basePrice: roundCurrency(basePrice),
        weight: normalizedWeight,
        weightCharge: roundCurrency(weightCharge),
        perKgRate: roundCurrency(pricing.perKgRate),
        deliveryType,
        deliveryMultiplier: roundCurrency(deliveryMultiplier),
        paymentMode,
        codCharge: roundCurrency(codCharge),
        totalPrice: roundCurrency(totalPrice)
    };
}

async function getPricingSettings() {
    let pricing = await Pricing.findOne().sort({ createdAt: 1 });

    if (!pricing) {
        pricing = await Pricing.create({});
    }

    return pricing;
}

module.exports = {
    calculateDeliveryPrice,
    getPricingSettings,
    getRouteType
};
