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
    if (!value) {
        return false;
    }

    return /^[+]?[0-9\s\-()]{7,20}$/.test(normalizeText(value));
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
