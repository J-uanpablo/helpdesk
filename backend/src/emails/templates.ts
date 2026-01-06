function escapeHtml(s: string) {
  return (s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function ticketCreatedEmail(params: {
  ticketId: number;
  subject: string;
  clientName: string;
  agentName: string;
  appUrl: string;
}) {
  const url = `${params.appUrl}/tickets/${params.ticketId}`;
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5">
      <h2>Nuevo ticket #${params.ticketId}</h2>
      <p><b>Asunto:</b> ${escapeHtml(params.subject)}</p>
      <p><b>Cliente:</b> ${escapeHtml(params.clientName)}</p>
      <p><b>Agente asignado:</b> ${escapeHtml(params.agentName)}</p>
      <p>Puedes ver el ticket aquí:</p>
      <p><a href="${url}">${url}</a></p>
      <hr/>
      <p style="color:#666;font-size:12px">Mensaje automático - No responder.</p>
    </div>`;
}

export function ticketClosedWithTranscriptEmail(params: {
  ticketId: number;
  subject: string;
  closedBy: string;
  appUrl: string;
  transcriptHtml: string;
}) {
  const url = `${params.appUrl}/tickets/${params.ticketId}`;
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5">
      <h2>Ticket cerrado #${params.ticketId}</h2>
      <p><b>Asunto:</b> ${escapeHtml(params.subject)}</p>
      <p><b>Cerrado por:</b> ${escapeHtml(params.closedBy)}</p>
      <p>Ticket:</p>
      <p><a href="${url}">${url}</a></p>
      <h3>Transcripción del chat</h3>
      ${params.transcriptHtml}
      <hr/>
      <p style="color:#666;font-size:12px">Mensaje automático - No responder.</p>
    </div>`;
}

export function resetPasswordEmail(params: {
  name: string;
  resetUrl: string;
  ttlMinutes: number;
}) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5">
      <h2>Restablecer contraseña</h2>
      <p>Hola ${escapeHtml(params.name)},</p>
      <p>Solicitaste restablecer tu contraseña. Usa este enlace:</p>
      <p><a href="${params.resetUrl}">Restablecer contraseña</a></p>
      <p>Este enlace vence en <b>${params.ttlMinutes} minutos</b>.</p>
      <p>Si no fuiste tú, ignora este correo.</p>
      <hr/>
      <p style="color:#666;font-size:12px">Mensaje automático - No responder.</p>
    </div>`;
}
