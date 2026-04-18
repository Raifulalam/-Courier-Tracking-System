function normalizeEmail(value = '') {
    return String(value || '').trim().toLowerCase();
}

function normalizeText(value = '') {
    return String(value || '').trim();
}

function isValidEmail(value = '') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function isValidPhone(value = '') {
    if (!value) return false;

    // Remove spaces, dashes, parentheses
    const cleaned = value.replace(/[\s\-()]/g, '');

    // 📱 Mobile: +977 optional, starts with 97/98, total 10 digits
    const mobilePattern = /^(?:\+977)?9[78]\d{8}$/;

    // ☎️ Landline: +977 optional, area code (1–3 digits) + 6–7 digits
    const landlinePattern = /^(?:\+977)?[1-9]\d{1,2}\d{6,7}$/;

    return mobilePattern.test(cleaned) || landlinePattern.test(cleaned)
}

function isPositiveNumber(value) {
    const parsed = Number(value);
    return !Number.isNaN(parsed) && parsed > 0;
}

function isNonNegativeNumber(value) {
    const parsed = Number(value);
    return !Number.isNaN(parsed) && parsed >= 0;
}

module.exports = {
    isNonNegativeNumber,
    isPositiveNumber,
    isValidEmail,
    isValidPhone,
    normalizeEmail,
    normalizeText
};
