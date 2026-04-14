require('dotenv').config();
const { sendVerificationMail } = require('./utils/mailer');

async function test() {
    console.log('Testing email dispatch to', process.env.EMAIL_USER);
    try {
        await sendVerificationMail(process.env.EMAIL_USER, 'test-token-12345');
        console.log('Test function finished (check logs above for nodemailer output)');
    } catch (e) {
        console.error('Error in test:', e);
    }
}

test();
