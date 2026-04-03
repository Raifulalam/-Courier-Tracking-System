const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isValidLocation } = require('../utils/locationCatalog');

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

exports.register = async (req, res) => {
    const { name, email, password, role, phone, hub, province, district, city } = req.body;

    try {
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required.' });
        }

        const selectedRole = role || 'sender';
        const hasAnyLocation = province || district || city;

        if (selectedRole === 'sender' && !isValidLocation({ province, district, city })) {
            return res.status(400).json({ message: 'A valid province, district, and city are required for senders.' });
        }

        if (selectedRole !== 'sender' && hasAnyLocation && !isValidLocation({ province, district, city })) {
            return res.status(400).json({ message: 'The selected province, district, and city combination is invalid.' });
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
            role: selectedRole,
            phone,
            hub,
            province: province || '',
            district: district || '',
            city: city || ''
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
