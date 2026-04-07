function escapeHtml(s: string) {
  return (s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/**
 * ✅ CAMBIA ESTA URL POR LA URL REAL DE TU LOGO
 * Ejemplo:
 * https://tudominio.com/logo-itm.png
 */
const LOGO_URL =
  'https://clinicasagradafamilia.net/logos-firmas/Logo-IT-Sin-Fondo.png';

const BRAND = {
  red: '#c9312c',
  redDark: '#b53028',
  grayDark: '#4b4b4b',
  grayText: '#5f5f5f',
  graySoft: '#8a8a8a',
  bgPage: '#f4f4f4',
  bgCard: '#ffffff',
  border: '#e5e7eb',
  success: '#16a34a',
  link: '#c9312c',
};

function baseEmailLayout(params: {
  title: string;
  preheader?: string;
  content: string;
}) {
  const preheader = escapeHtml(params.preheader || params.title);

  return `
<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(params.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bgPage};font-family:Arial,Helvetica,sans-serif;color:${BRAND.grayDark};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${preheader}
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.bgPage};margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:720px;">
          
          <!-- LOGO -->
          <tr>
            <td align="center" style="padding:0 0 18px 0;">
              <img
                src="${LOGO_URL}"
                alt="IT Management"
                style="display:block;max-width:180px;width:100%;height:auto;border:0;outline:none;text-decoration:none;"
              />
            </td>
          </tr>

          <!-- CARD -->
          <tr>
            <td style="background:${BRAND.bgCard};border:1px solid ${BRAND.border};border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.05);">
              
              <!-- TOP BAR -->
              <div style="background:linear-gradient(135deg, ${BRAND.redDark} 0%, ${BRAND.red} 100%);padding:24px 28px;">
                <div style="font-size:24px;line-height:1.2;font-weight:700;color:#ffffff;">
                  ${escapeHtml(params.title)}
                </div>
              </div>

              <!-- CONTENT -->
              <div style="padding:28px;">
                ${params.content}
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:16px 8px 0 8px;text-align:center;">
              <p style="margin:0;font-size:12px;color:${BRAND.grayText};">
                Este es un mensaje automático de la Mesa de Ayuda IT Management.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:6px 8px 0 8px;text-align:center;">
              <p style="margin:0;font-size:12px;color:${BRAND.graySoft};">
                Por favor no respondas este correo.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:8px 8px 0 8px;text-align:center;">
              <p style="margin:0;font-size:11px;color:${BRAND.graySoft};">
                © ${new Date().getFullYear()} IT Management Zomac
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

function infoRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding:12px 14px;border-bottom:1px solid ${BRAND.border};width:180px;background:#fafafa;font-size:13px;font-weight:700;color:${BRAND.grayDark};">
        ${escapeHtml(label)}
      </td>
      <td style="padding:12px 14px;border-bottom:1px solid ${BRAND.border};font-size:14px;color:${BRAND.grayDark};">
        ${escapeHtml(value)}
      </td>
    </tr>
  `;
}

function primaryButton(url: string, label: string) {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0 8px 0;">
      <tr>
        <td align="center" style="border-radius:10px;background:${BRAND.red};">
          <a
            href="${url}"
            target="_blank"
            style="display:inline-block;padding:13px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;background:${BRAND.red};"
          >
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function secondaryUrl(url: string) {
  return `
    <p style="margin:10px 0 0 0;font-size:12px;color:${BRAND.grayText};word-break:break-all;line-height:1.6;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
      <a href="${url}" target="_blank" style="color:${BRAND.link};text-decoration:none;">${url}</a>
    </p>
  `;
}

export function ticketCreatedEmail(params: {
  ticketId: number;
  subject: string;
  clientName: string;
  agentName: string;
  appUrl: string;
}) {
  const url = `${params.appUrl}/tickets/${params.ticketId}`;

  const content = `
    <p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;color:${BRAND.grayText};">
      Se ha registrado un nuevo ticket en la plataforma de mesa de ayuda.
      A continuación encontrarás la información principal del caso.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;border-collapse:separate;border-spacing:0;">
      ${infoRow('Ticket', `#${params.ticketId}`)}
      ${infoRow('Asunto', params.subject)}
      ${infoRow('Cliente', params.clientName)}
      ${infoRow('Agente asignado', params.agentName)}
    </table>

    ${primaryButton(url, 'Ver ticket')}
    ${secondaryUrl(url)}
  `;

  return baseEmailLayout({
    title: `Nuevo ticket #${params.ticketId}`,
    preheader: `Se creó el ticket #${params.ticketId}: ${params.subject}`,
    content,
  });
}

export function ticketClosedWithTranscriptEmail(params: {
  ticketId: number;
  subject: string;
  closedBy: string;
  appUrl: string;
  transcriptHtml: string;
}) {
  const url = `${params.appUrl}/tickets/${params.ticketId}`;

  const content = `
    <p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;color:${BRAND.grayText};">
      El ticket ha sido cerrado exitosamente. Debajo encontrarás el detalle general
      y la transcripción de la conversación.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;border-collapse:separate;border-spacing:0;">
      ${infoRow('Ticket', `#${params.ticketId}`)}
      ${infoRow('Asunto', params.subject)}
      ${infoRow('Cerrado por', params.closedBy)}
    </table>

    ${primaryButton(url, 'Ver ticket')}
    ${secondaryUrl(url)}

    <div style="margin-top:28px;">
      <div style="font-size:17px;font-weight:700;color:${BRAND.grayDark};margin-bottom:12px;">
        Transcripción del chat
      </div>

      <div style="border:1px solid ${BRAND.border};border-radius:12px;padding:16px;background:#fafafa;">
        ${params.transcriptHtml}
      </div>
    </div>
  `;

  return baseEmailLayout({
    title: `Ticket cerrado #${params.ticketId}`,
    preheader: `El ticket #${params.ticketId} ha sido cerrado`,
    content,
  });
}

export function resetPasswordEmail(params: {
  name: string;
  resetUrl: string;
  ttlMinutes: number;
}) {
  const content = `
    <p style="margin:0 0 14px 0;font-size:15px;line-height:1.7;color:${BRAND.grayText};">
      Hola <strong style="color:${BRAND.grayDark};">${escapeHtml(params.name)}</strong>,
    </p>

    <p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;color:${BRAND.grayText};">
      Recibimos una solicitud para restablecer tu contraseña en la plataforma de Mesa de Ayuda.
      Usa el siguiente botón para continuar con el proceso.
    </p>

    ${primaryButton(params.resetUrl, 'Restablecer contraseña')}
    ${secondaryUrl(params.resetUrl)}

    <div style="margin-top:22px;border:1px solid ${BRAND.border};background:#fafafa;border-radius:12px;padding:14px;">
      <p style="margin:0;font-size:14px;color:${BRAND.grayDark};">
        Este enlace vence en <strong>${params.ttlMinutes} minutos</strong>.
      </p>
    </div>

    <p style="margin:18px 0 0 0;font-size:13px;line-height:1.7;color:${BRAND.grayText};">
      Si no solicitaste este cambio, puedes ignorar este correo sin problema.
    </p>
  `;

  return baseEmailLayout({
    title: 'Restablecer contraseña',
    preheader: 'Solicitud para restablecer contraseña',
    content,
  });
}
