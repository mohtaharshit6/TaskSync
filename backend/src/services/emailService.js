// Email via Brevo's HTTP API (port 443) — works on Render free tier,
// which blocks outbound SMTP ports (25/465/587).
// If BREVO_API_KEY is not set, sendEmail is a no-op and the auth
// controllers fall back to returning the OTP in the response (demo mode).

exports.isEmailEnabled = () => Boolean(process.env.BREVO_API_KEY);

exports.sendEmail = async ({ to, subject, html }) => {
  if (!process.env.BREVO_API_KEY) return; // not configured — caller handles fallback

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      'accept': 'application/json'
    },
    body: JSON.stringify({
      sender: { email: process.env.FROM_EMAIL, name: 'TaskSync' },
      to: [{ email: to }],
      subject,
      htmlContent: html
    })
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo send failed: ${res.status} ${detail}`);
  }
};
