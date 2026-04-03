const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true },
        phone: { type: String, trim: true, default: '' },
        province: { type: String, trim: true, default: '' },
        district: { type: String, trim: true, default: '' },
        city: { type: String, trim: true, default: '' },
        role: {
            type: String,
            enum: ['sender', 'agent', 'receiver', 'admin'],
            default: 'sender',
            index: true
        },
        hub: { type: String, trim: true, default: '' },
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

userSchema.set('toJSON', {
    transform: (_doc, ret) => {
        delete ret.password;
        return ret;
    }
});

module.exports = mongoose.model('User', userSchema);
