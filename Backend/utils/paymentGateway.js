const crypto = require('crypto');

// --- ESEWA CONFIG (Sandbox Defaults) ---
const ESEWA_URL = 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';
const ESEWA_MERCHANT_CODE = process.env.ESEWA_MERCHANT_CODE || 'EPAYTEST';
const ESEWA_SECRET = process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q';

// --- KHALTI CONFIG (Sandbox Defaults) ---
const KHALTI_INITIATE_URL = 'https://a.khalti.com/api/v2/epayment/initiate/';
const KHALTI_LOOKUP_URL = 'https://a.khalti.com/api/v2/epayment/lookup/';
const KHALTI_SECRET = process.env.KHALTI_SECRET_KEY || 'key_live_secret_dummy_1234'; // Need real key for prod, or sandbox for test. Defaults usually fail if invalid.

function getFrontendBaseUrl(req) {
    // Determine dynamically from headers or default to localhost for dev
    const origin = req.headers.origin || req.headers.referer || 'http://localhost:5173';
    // Clean trailing slash
    return origin.replace(/\/$/, '');
}

/**
 * Initiates payment logic and builds response payload for frontend.
 */
async function initiateGatewayPayment(req, shipment, method, amount) {
    const baseUrl = getFrontendBaseUrl(req);
    const transactionUuid = `TXP-${shipment._id}-${Date.now()}`;

    const normalizedMethod = method.toLowerCase();

    if (normalizedMethod === 'khalti') {
        const payload = {
            return_url: `${baseUrl}/payments/verify/khalti`,
            website_url: baseUrl,
            amount: amount * 100, // Khalti requires amount in Paisa (cents)
            purchase_order_id: String(shipment._id),
            purchase_order_name: `Shipment Tracking ID: ${shipment.trackingId}`,
            customer_info: {
                name: req.user.name || 'User',
                email: req.user.email || 'customer@nexxpress.com.np',
                phone: req.user.phone || '9800000000'
            }
        };

        const response = await fetch(KHALTI_INITIATE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${KHALTI_SECRET}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('Khalti Init Error:', data);
            throw new Error(data.detail || data.message || 'Failed to initiate Khalti payment.');
        }

        return {
            method: 'Khalti',
            url: data.payment_url,
            pidx: data.pidx // Keep reference if needed
        };

    } else if (normalizedMethod === 'esewa') {
        // eSewa HMAC generation
        const message = `total_amount=${amount},transaction_uuid=${transactionUuid},product_code=${ESEWA_MERCHANT_CODE}`;
        const hash = crypto.createHmac('sha256', ESEWA_SECRET).update(message).digest('base64');

        const formData = {
            amount: amount,
            tax_amount: 0,
            total_amount: amount,
            transaction_uuid: transactionUuid,
            product_code: ESEWA_MERCHANT_CODE,
            product_service_charge: 0,
            product_delivery_charge: 0,
            success_url: `${baseUrl}/payments/verify/esewa`,
            failure_url: `${baseUrl}/payments/verify/esewa?status=failed`,
            signed_field_names: 'total_amount,transaction_uuid,product_code',
            signature: hash
        };

        return {
            method: 'eSewa',
            url: ESEWA_URL,
            formData
        };
    }

    throw new Error('Unsupported payment method.');
}

/**
 * Verifies payment payload coming from the frontend after user redirect.
 */
async function verifyGatewayPayment(method, query) {
    const normalizedMethod = method.toLowerCase();
    if (normalizedMethod === 'khalti') {
        // Khalti returns: pidx, transaction_id, tid, amount, mobile, purchase_order_id, purchase_order_name, status
        const { pidx } = query;
        if (!pidx) throw new Error('Missing Khalti transaction ID (pidx)');

        const response = await fetch(KHALTI_LOOKUP_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${KHALTI_SECRET}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ pidx })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Khalti verification failed.');
        }

        if (data.status !== 'Completed') {
            throw new Error(`Khalti payment status is ${data.status}`);
        }

        return {
            success: true,
            transactionId: data.transaction_id || pidx,
            shipmentId: data.purchase_order_id,
        };

    } else if (normalizedMethod === 'esewa') {
        // eSewa returns: data (base64 encoded JSON string)
        const encodedData = query.data;
        if (!encodedData) {
             throw new Error('Missing eSewa payload data.');
        }

        const decodedString = Buffer.from(encodedData, 'base64').toString('utf-8');
        const payload = JSON.parse(decodedString);

        if (payload.status !== 'COMPLETE') {
            throw new Error(`eSewa payment invalid state: ${payload.status}`);
        }

        // Technically we must verify the HMAC signature returned by eSewa too for production.
        const signedFields = payload.signed_field_names.split(',');
        const message = signedFields.map(field => `${field}=${payload[field] || ''}`).join(',');
        const hash = crypto.createHmac('sha256', ESEWA_SECRET).update(message).digest('base64');

        if (hash !== payload.signature) {
             throw new Error('eSewa transaction signature manipulation detected.');
        }

        // transaction_uuid format was: `TXP-${shipment._id}-${Date.now()}`
        const shipmentIdExtract = payload.transaction_uuid.split('-')[1];

        return {
            success: true,
            transactionId: payload.transaction_code,
            shipmentId: shipmentIdExtract
        };
    }

    throw new Error('Unsupported verification method.');
}

module.exports = {
    initiateGatewayPayment,
    verifyGatewayPayment
};
