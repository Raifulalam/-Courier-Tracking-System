const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

exports.sendMail = async ({ to, subject, html }) => {
    try {
        if (!process.env.EMAIL_USER) {
            console.warn('EMAIL_USER is not configured. Skipping email dispatch.');
            return;
        }

        const info = await transporter.sendMail({
            from: `"NexExpree Network" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        });

        console.log(`Message sent: ${info.messageId}`);
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

exports.sendVerificationMail = async (email, token) => {
    // Determine the frontend base URL. For development it's typically localhost:5173
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${baseUrl}/verify-email?token=${token}`;

    await exports.sendMail({
        to: email,
        subject: 'Verify your NexExpree Account',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #334155;">Welcome to NexExpree Network</h2>
                <p>Please confirm your email address to activate your account and start using our operations board.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${link}" style="background-color: #2563eb; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email Address</a>
                </div>
                <p style="color: #64748b; font-size: 0.9em;">If the button does not work, copy and paste this link into your browser:<br/>${link}</p>
            </div>
        `
    });
};

exports.sendOTPToReceiver = async (email, trackingId, otp) => {
    if (!email) return;

    await exports.sendMail({
        to: email,
        subject: `Your Delivery OTP for Package ${trackingId}`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #334155;">Incoming Delivery Setup</h2>
                <p>Hello,</p>
                <p>A package with tracking ID <strong>${trackingId}</strong> has been secured in our system for you.</p>
                <div style="background-color: #f1f5f9; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;">
                    <p style="margin: 0; color: #64748b; font-size: 0.9em; text-transform: uppercase;">Delivery OTP Verification Code</p>
                    <h1 style="margin: 10px 0 0; color: #2563eb; letter-spacing: 4px;">${otp}</h1>
                </div>
                <p>Please provide this code to our delivery agent upon arrival to complete handoff verification.</p>
                <p>Thank you for using NexExpree.</p>
            </div>
        `
    });

};
