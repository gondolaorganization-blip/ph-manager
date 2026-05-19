const { Resend } = require('resend');

let _client = null;

function getClient() {
  if (!_client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY no configurada en .env');
    _client = new Resend(key);
  }
  return _client;
}

const FROM = process.env.EMAIL_FROM || 'PH Manager <noreply@phmanager.com>';

async function enviarCorreo({ to, subject, html, replyTo, attachments }) {
  const resend = getClient();
  const { data, error } = await resend.emails.send({
    from:     FROM,
    to:       Array.isArray(to) ? to : [to],
    subject,
    html,
    ...(replyTo     ? { reply_to: replyTo } : {}),
    ...(attachments?.length ? { attachments } : {}),
  });
  if (error) throw new Error(error.message || JSON.stringify(error));
  return data;
}

module.exports = { enviarCorreo };
