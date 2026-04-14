const nodemailer = require('nodemailer');
console.log("🚀 USING SENDGRID MAILER");
// ✅ Create SendGrid transporter
const transporter = nodemailer.createTransport({
    host: "smtp.sendgrid.net",
    port: 2525, // 🔥 IMPORTANT FIX
    secure: false,
    auth: {
        user: "apikey",
        pass: process.env.SENDGRID_API_KEY,
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
});

// ✅ Generic send function
exports.sendMail = async ({ to, subject, html }) => {
    try {
        console.log("📧 Sending email to:", to);
        console.log("SENDGRID KEY:", process.env.SENDGRID_API_KEY ? "EXISTS" : "MISSING");
        if (!process.env.SENDGRID_API_KEY) {
            throw new Error("SENDGRID_API_KEY missing");
        }

        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to,
            subject,
            html,
        });

        console.log("✅ Email sent:", info.messageId);

    } catch (error) {
        console.error("❌ Email error:", error.message);
        throw error; // important
    }
};

// ✅ Verification Email
exports.sendVerificationMail = async (email, token) => {
    const baseUrl = process.env.FRONTEND_URL;
    const link = `${baseUrl}/verify-email?token=${token}`;

    await exports.sendMail({
        to: email,
        subject: 'Verify your NexExpree Account',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
                <h2>Welcome to NexExpree 🚀</h2>
                <p>Click below to verify your email:</p>
                <a href="${link}" 
                   style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;">
                   Verify Email
                </a>
                <p>If button doesn't work:</p>
                <p>${link}</p>
            </div>
        `
    });
};

// ✅ OTP Email
exports.sendOTPToReceiver = async (email, trackingId, otp) => {
    if (!email) return;

    await exports.sendMail({
        to: email,
        subject: `OTP for Package ${trackingId}`,
        html: `
            <div style="font-family: sans-serif;">
                <h2>Your Delivery OTP</h2>
                <h1 style="color:#2563eb;letter-spacing:5px;">${otp}</h1>
                <p>Use this OTP to receive your package.</p>
            </div>
        `
    });
};