import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || 'false') === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendMail(opts: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const fromName = process.env.SMTP_FROM_NAME || 'Helpdesk';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '';
  const to = Array.isArray(opts.to) ? opts.to.filter(Boolean) : opts.to;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: opts.subject,
    html: opts.html,
  });
}
