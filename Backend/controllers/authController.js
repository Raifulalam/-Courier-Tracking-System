const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const crypto = require('crypto');
const { isValidEmail, isValidPhone, normalizeEmail, normalizeText } = require('../utils/validation');
const { sendVerificationMail } = require('../utils/mailer');

function buildAuthPayload(user) {
    return {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        city: user.city,
        state: user.state,
        country: user.country,
        role: user.role,
        hub: user.hub,
        isActive: user.isActive,
        isAvailable: user.isAvailable,
        lastSeenAt: user.lastSeenAt
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
    const {
        name,
        email,
        password,
        role = 'sender',
        phone,
        address,
        city,
        state,
        country,
        hub,
        adminInviteCode
    } = req.body;

    try {
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required.' });
        }

        if (!['admin', 'sender', 'agent'].includes(role)) {
            return res.status(400).json({ message: 'Invalid account role selected.' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ message: 'Please enter a valid email address.' });
        }

        if (phone && !isValidPhone(phone)) {
            return res.status(400).json({ message: 'Please enter a valid phone number.' });
        }

        if (String(password).length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
        }

        if (role === 'admin' && !(await canRegisterAsAdmin(adminInviteCode))) {
            return res.status(403).json({
                message: 'Admin registration requires a valid invite code once an admin already exists.'
            });
        }

        const normalizedEmail = normalizeEmail(email);
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
            name: normalizeText(name),
            email: normalizedEmail,
            password: hashedPassword,
            phone: normalizeText(phone),
            address: normalizeText(address),
            city: normalizeText(city),
            state: normalizeText(state),
            country: normalizeText(country) || 'Nepal',
            hub: normalizeText(hub),
            role,
            isAvailable: role === 'agent' ? false : undefined,
            verificationToken
        });

        // Fire and forget email dispatch

        await sendVerificationMail(newUser.email, verificationToken);

        return res.status(201).json({
            message: 'Account created successfully. Please check your email for the verification link.',
            data: buildAuthPayload(newUser)
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Registration failed.' });
    }
};

exports.verifyEmail = async (req, res) => {
    const { token } = req.body;
    try {
        if (!token) {
            return res.status(400).json({ message: 'Verification token is missing.' });
        }

        const user = await User.findOne({ verificationToken: token });
        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired verification token.' });
        }

        user.isEmailVerified = true;
        user.verificationToken = null;
        await user.save();

        return res.status(200).json({ message: 'Email address verified successfully. You may now log in.' });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Verification failed.' });
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
            return res.status(403).json({ message: 'This account is inactive. Please contact an administrator.' });
        }

        if (!user.isEmailVerified) {
            return res.status(403).json({ message: 'Please verify your email address before logging in.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        user.lastSeenAt = new Date();
        await user.save();

        return res.status(200).json({
            message: 'Login successful.',
            token: createSignedToken(user),
            user: buildAuthPayload(user)
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Login failed.' });
    }
};

exports.getCurrentUser = async (req, res) => {
    return res.status(200).json({
        message: 'Authenticated user loaded successfully.',
        data: buildAuthPayload(req.user)
    });
};

exports.updateProfile = async (req, res) => {
    const { name, phone, address, city, state, country, hub } = req.body;

    try {
        if (name !== undefined && !normalizeText(name)) {
            return res.status(400).json({ message: 'Name cannot be empty.' });
        }

        if (phone && !isValidPhone(phone)) {
            return res.status(400).json({ message: 'Please enter a valid phone number.' });
        }

        if (name !== undefined) req.user.name = normalizeText(name);
        if (phone !== undefined) req.user.phone = normalizeText(phone);
        if (address !== undefined) req.user.address = normalizeText(address);
        if (city !== undefined) req.user.city = normalizeText(city);
        if (state !== undefined) req.user.state = normalizeText(state);
        if (country !== undefined) req.user.country = normalizeText(country);
        if (hub !== undefined) req.user.hub = normalizeText(hub);
        req.user.lastSeenAt = new Date();

        await req.user.save();

        return res.status(200).json({
            message: 'Profile updated successfully.',
            data: buildAuthPayload(req.user)
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to update profile.' });
    }
};

exports.resendVerification = async (req, res) => {

    const { email } = req.body;
    try {
        if (!email) {
            return res.status(400).json({ message: 'Email is required.' });
        }

        const normalizedEmail = normalizeEmail(email);
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({ message: 'No registered account found with this email.' });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ message: 'This email is already verified. You can log in directly.' });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        user.verificationToken = verificationToken;
        await user.save();

        // Fire and forget email dispatch

        await sendVerificationMail(user.email, verificationToken);

        return res.status(200).json({ message: 'A fresh verification link has been sent to your email address.' });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to resend verification email.' });
    }
};
