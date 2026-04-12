const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true },
        phone: { type: String, trim: true, default: '' },
        address: { type: String, trim: true, default: '' },
        city: { type: String, trim: true, default: '' },
        state: { type: String, trim: true, default: '' },
        country: { type: String, trim: true, default: 'Nepal' },
        role: {
            type: String,
            enum: ['sender', 'agent', 'admin'],
            default: 'sender',
            index: true
        },
        hub: { type: String, trim: true, default: '' },
        isActive: { type: Boolean, default: true },
        isAvailable: { type: Boolean, default: false, index: true },
        lastSeenAt: { type: Date, default: Date.now },
        isEmailVerified: { type: Boolean, default: false },
        verificationToken: { type: String, default: null }
    },
    { timestamps: true }
);

userSchema.pre('save', function syncAvailability(next) {
    if (this.role !== 'agent') {
        this.isAvailable = false;
    }

    next();
});

userSchema.set('toJSON', {
    transform: (_doc, ret) => {
        delete ret.password;
        return ret;
    }
});

module.exports = mongoose.model('User', userSchema);
