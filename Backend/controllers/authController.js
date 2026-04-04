const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isValidLocation } = require('../utils/locationCatalog');
const { isValidEmail, isValidPhone, normalizeEmail, normalizeText } = require('../utils/validation');

function buildAuthPayload(user) {
    return {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        province: user.province,
        district: user.district,
        city: user.city,
        role: user.role,
        hub: user.hub,
        isActive: user.isActive
    };
}

function createSignedToken(user) {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is missing from Backend/.env');
    }

    return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: '1d'
    });
}

async function canRegisterAsAdmin(adminInviteCode) {
    const adminCount = await User.countDocuments({ role: 'admin' });

    if (adminCount === 0) {
        return true;
    }

    const expectedSecret = process.env.ADMIN_REGISTRATION_SECRET;
    return Boolean(expectedSecret && adminInviteCode === expectedSecret);
}

exports.register = async (req, res) => {
    const { name, email, password, role, phone, hub, province, district, city, adminInviteCode } = req.body;

    try {
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required.' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ message: 'Please provide a valid email address.' });
        }

        if (String(password).length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
        }

        if (phone && !isValidPhone(phone)) {
            return res.status(400).json({ message: 'Please provide a valid phone number.' });
        }

        const selectedRole = role || 'sender';
        const hasAnyLocation = province || district || city;

        if (!['sender', 'receiver', 'agent', 'admin'].includes(selectedRole)) {
            return res.status(400).json({ message: 'The selected account role is not allowed.' });
        }

        if (selectedRole === 'admin' && !(await canRegisterAsAdmin(adminInviteCode))) {
            return res.status(403).json({
                message: 'Admin registration requires a valid invite code once an admin account already exists.'
            });
        }

        if (selectedRole === 'sender' && !isValidLocation({ province, district, city })) {
            return res.status(400).json({ message: 'A valid province, district, and city are required for senders.' });
        }

        if (selectedRole !== 'sender' && hasAnyLocation && !isValidLocation({ province, district, city })) {
            return res.status(400).json({ message: 'The selected province, district, and city combination is invalid.' });
        }

        const normalizedEmail = normalizeEmail(email);
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
            name: normalizeText(name),
            email: normalizedEmail,
            password: hashedPassword,
            role: selectedRole,
            phone: normalizeText(phone),
            hub: normalizeText(hub),
            province: normalizeText(province),
            district: normalizeText(district),
            city: normalizeText(city)
        });

        return res.status(201).json({
            message: 'Account created successfully.',
            data: buildAuthPayload(newUser)
        });
    } catch (err) {
        return res.status(400).json({ message: err.message || 'Registration failed.' });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const user = await User.findOne({ email: normalizeEmail(email) });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (!user.isActive) {
            return res.status(403).json({ message: 'This account has been deactivated. Contact an administrator.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        const token = createSignedToken(user);

        return res.json({
            message: 'Login successful.',
            token,
            user: buildAuthPayload(user)
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || 'Login failed.' });
    }
};

exports.getCurrentUser = async (req, res) => {
    return res.status(200).json({
        message: 'Authenticated user loaded successfully.',
        data: buildAuthPayload(req.user)
    });
};

exports.updateProfile = async (req, res) => {
    try {
        const { name, phone, hub, province, district, city } = req.body;

        if (name !== undefined && !normalizeText(name)) {
            return res.status(400).json({ message: 'Name cannot be empty.' });
        }

        if (phone && !isValidPhone(phone)) {
            return res.status(400).json({ message: 'Please provide a valid phone number.' });
        }

        const nextLocation = {
            province: province !== undefined ? normalizeText(province) : req.user.province,
            district: district !== undefined ? normalizeText(district) : req.user.district,
            city: city !== undefined ? normalizeText(city) : req.user.city
        };

        const hasLocationInput = province !== undefined || district !== undefined || city !== undefined;
        if (hasLocationInput && !isValidLocation(nextLocation)) {
            return res.status(400).json({ message: 'Please select a valid province, district, and city combination.' });
        }

        if (req.user.role === 'sender' && !isValidLocation(nextLocation)) {
            return res.status(400).json({ message: 'Sender accounts must keep a valid province, district, and city.' });
        }

        if (name !== undefined) req.user.name = normalizeText(name);
        if (phone !== undefined) req.user.phone = normalizeText(phone);
        if (hub !== undefined) req.user.hub = normalizeText(hub);
        if (province !== undefined) req.user.province = nextLocation.province;
        if (district !== undefined) req.user.district = nextLocation.district;
        if (city !== undefined) req.user.city = nextLocation.city;

        await req.user.save();

        return res.status(200).json({
            message: 'Profile updated successfully.',
            data: buildAuthPayload(req.user)
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || 'Failed to update profile.' });
    }
};
