const nodemailer = require('nodemailer');

console.log("🚀 USING SENDGRID MAILER");

// ✅ Transporter (stable config)
const transporter = nodemailer.createTransport({
    host: "smtp.sendgrid.net",
    port: 587,
    secure: false,
    auth: {
        user: "apikey",
        pass: process.env.SENDGRID_API_KEY,
    },
});

// ✅ Generic send function
exports.sendMail = async ({ to, subject, html }) => {
    if (!to) throw new Error("Recipient email missing");

    if (!process.env.SENDGRID_API_KEY) {
        throw new Error("SENDGRID_API_KEY missing");
    }

    if (!process.env.EMAIL_FROM) {
        throw new Error("EMAIL_FROM missing");
    }

    try {
        console.log("📧 Sending email to:", to);

        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to,
            subject,
            html,
        });

        console.log("✅ Email sent:", info.messageId);
        return info;

    } catch (error) {
        console.error("❌ Email error:", error.message);
        throw error;
    }
};

// ✅ OTP Email
exports.sendOTPToReceiver = async (email, trackingId, otp) => {
    if (!email) throw new Error("Receiver email missing");

    return await exports.sendMail({
        to: email,
        subject: `OTP for Package ${trackingId}`,
        html: `
            <div style="font-family:sans-serif;">
                <h2>Your Delivery OTP</h2>
                <h1 style="color:#2563eb;letter-spacing:5px;">${otp}</h1>
                <p>Tracking ID: ${trackingId}</p>
                <p>Use this OTP to receive your package.</p>
            </div>
        `
    });
};

// ✅ Shipment Created Emails
exports.sendShipmentCreatedEmails = async (shipment, otpCode) => {
    const deliveries = [];

    if (shipment?.sender?.email) {
        deliveries.push(
            exports.sendMail({
                to: shipment.sender.email,
                subject: `Shipment ${shipment.trackingId} created successfully`,
                html: `
                    <h2>Shipment Created</h2>
                    <p>Tracking ID: ${shipment.trackingId}</p>
                    <p>Status: ${shipment.status}</p>
                `
            })
        );
    }

    if (shipment?.receiver?.email) {
        deliveries.push(
            exports.sendMail({
                to: shipment.receiver.email,
                subject: `Incoming shipment ${shipment.trackingId}`,
                html: `
                    <h2>Incoming Shipment</h2>
                    <p>Tracking ID: ${shipment.trackingId}</p>
                    <p>You will receive updates as it progresses.</p>
                    ${otpCode ? `<p>OTP sent separately.</p>` : ''}
                `
            })
        );
    }

    // ✅ Handle results properly
    const results = await Promise.allSettled(deliveries);

    let hasFailure = false;

    results.forEach((r, i) => {
        if (r.status === "rejected") {
            hasFailure = true;
            console.error(`❌ Email ${i} failed:`, r.reason);
        } else {
            console.log(`✅ Email ${i} sent`);
        }
    });

    if (hasFailure) {
        throw new Error("Some shipment emails failed");
    }
};