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

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDateTime(value) {
    if (!value) {
        return 'Not available';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return 'Not available';
    }

    return parsed.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

function buildShipmentRows(shipment, extraRows = []) {
    const rows = [
        ['Tracking ID', shipment?.trackingId || 'N/A'],
        ['Status', shipment?.status || 'Pending'],
        ['Package Type', shipment?.packageType || 'N/A'],
        ['Pickup Address', shipment?.pickupAddress || 'N/A'],
        ['Delivery Address', shipment?.deliveryAddress || 'N/A'],
        ['Estimated Delivery', formatDateTime(shipment?.estimatedDeliveryAt)]
    ];

    return [...rows, ...extraRows]
        .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
        .map(
            ([label, value]) => `
                <tr>
                    <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#64748b;font-weight:600;width:180px;">${escapeHtml(label)}</td>
                    <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#0f172a;">${escapeHtml(value)}</td>
                </tr>
            `
        )
        .join('');
}

function buildShipmentEmail({ heading, intro, shipment, extraRows = [], footer = '' }) {
    return `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f8fafc;color:#0f172a;">
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
                <div style="padding:24px 24px 12px;background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#ffffff;">
                    <h2 style="margin:0 0 8px;font-size:24px;">${escapeHtml(heading)}</h2>
                    <p style="margin:0;font-size:14px;line-height:1.6;opacity:0.92;">${escapeHtml(intro)}</p>
                </div>
                <div style="padding:24px;">
                    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                        <tbody>
                            ${buildShipmentRows(shipment, extraRows)}
                        </tbody>
                    </table>
                    ${footer ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#475569;">${escapeHtml(footer)}</p>` : ''}
                </div>
            </div>
        </div>
    `;
}

exports.sendShipmentCreatedEmails = async (shipment, otpCode) => {
    const senderEmail = shipment?.sender?.email;
    const receiverEmail = shipment?.receiver?.email;
    const senderName = shipment?.sender?.name || 'Sender';
    const receiverName = shipment?.receiver?.name || 'Receiver';

    const deliveries = [];

    if (senderEmail) {
        deliveries.push(
            exports.sendMail({
                to: senderEmail,
                subject: `Shipment ${shipment.trackingId} created successfully`,
                html: buildShipmentEmail({
                    heading: 'Shipment Created',
                    intro: `Hi ${senderName}, your shipment has been created successfully and is now waiting for assignment.`,
                    shipment,
                    extraRows: [
                        ['Receiver', receiverName],
                        ['Payment Status', shipment?.paymentStatus || 'Unpaid']
                    ],
                    footer: 'We have also notified the receiver by email with the shipment details.'
                })
            })
        );
    }

    if (receiverEmail) {
        deliveries.push(
            exports.sendMail({
                to: receiverEmail,
                subject: `Incoming shipment ${shipment.trackingId}`,
                html: buildShipmentEmail({
                    heading: 'A Shipment Is On The Way',
                    intro: `Hi ${receiverName}, a shipment has been created for you and will continue to update by email as it moves through delivery.`,
                    shipment,
                    extraRows: [
                        ['Sender', senderName]
                    ],
                    footer: otpCode
                        ? 'A separate OTP email has also been sent for final delivery confirmation.'
                        : 'You will receive another email whenever the shipment status changes.'
                })
            })
        );
    }

    await Promise.allSettled(deliveries);
};

exports.sendShipmentStatusEmails = async (shipment, details = {}) => {
    const senderEmail = shipment?.sender?.email;
    const receiverEmail = shipment?.receiver?.email;
    const senderName = shipment?.sender?.name || 'Sender';
    const receiverName = shipment?.receiver?.name || 'Receiver';
    const {
        previousStatus = '',
        nextStatus = shipment?.status || '',
        note = '',
        location = '',
        actorName = '',
        verificationMethod = ''
    } = details;

    const subject = `Shipment ${shipment.trackingId} status updated to ${nextStatus}`;
    const extraRows = [
        ['Previous Status', previousStatus || 'N/A'],
        ['Current Status', nextStatus || 'N/A'],
        ['Updated By', actorName || 'System'],
        ['Location', location || 'Not provided'],
        ['Note', note || 'No additional note provided'],
        verificationMethod ? ['Verification Method', verificationMethod.toUpperCase()] : null
    ].filter(Boolean);

    const deliveries = [];

    if (senderEmail) {
        deliveries.push(
            exports.sendMail({
                to: senderEmail,
                subject,
                html: buildShipmentEmail({
                    heading: 'Shipment Status Updated',
                    intro: `Hi ${senderName}, your shipment is now marked as ${nextStatus}.`,
                    shipment,
                    extraRows: [['Receiver', receiverName], ...extraRows]
                })
            })
        );
    }

    if (receiverEmail) {
        deliveries.push(
            exports.sendMail({
                to: receiverEmail,
                subject,
                html: buildShipmentEmail({
                    heading: 'Incoming Shipment Update',
                    intro: `Hi ${receiverName}, the shipment addressed to you is now marked as ${nextStatus}.`,
                    shipment,
                    extraRows: [['Sender', senderName], ...extraRows]
                })
            })
        );
    }

    await Promise.allSettled(deliveries);
};
