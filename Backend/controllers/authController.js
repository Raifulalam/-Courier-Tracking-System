const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function buildAuthPayload(user) {
    return {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        hub: user.hub,
        isActive: user.isActive
    };
}

exports.register = async (req, res) => {
    const { name, email, password, role, phone, hub } = req.body;

    try {
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required.' });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
            name,
            email,
            password: hashedPassword,
            role,
            phone,
            hub
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

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
            expiresIn: '1d'
        });

        return res.json({
            message: 'Login successful.',
            token,
            user: buildAuthPayload(user)
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || 'Login failed.' });
    }
};
