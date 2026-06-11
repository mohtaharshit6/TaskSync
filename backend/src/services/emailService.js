const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null; // email not configured
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return transporter;
};

exports.sendEmail = async ({ to, subject, html }) => {
  const t = getTransporter();
  if (!t) return; // silently skip if not configured
  await t.sendMail({
    from: process.env.FROM_EMAIL || 'TaskSync <noreply@tasksync.app>',
    to,
    subject,
    html
  });
};
