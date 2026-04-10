const crypto = require('crypto');

function hashValue(value = '') {
    return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function generateOtpCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken(bytes = 16) {
    return crypto.randomBytes(bytes).toString('hex');
}

function isHashMatch(rawValue, hashedValue) {
    if (!rawValue || !hashedValue) {
        return false;
    }

    return hashValue(rawValue) === hashedValue;
}

module.exports = {
    generateOtpCode,
    generateToken,
    hashValue,
    isHashMatch
};
