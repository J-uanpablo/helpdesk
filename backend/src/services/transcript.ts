function escapeHtml(s: string) {
  return (s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function buildTranscriptHtml(
  messages: Array<{
    createdAt: Date;
    senderName: string;
    content: string;
  }>,
) {
  if (!messages.length) return `<p><i>No hubo mensajes.</i></p>`;

  const rows = messages
    .map((m) => {
      const when = new Date(m.createdAt).toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
      });
      return `
          <div style="margin:10px 0;padding:10px;border:1px solid #eee;border-radius:8px">
            <div style="font-size:12px;color:#666">
              <b>${escapeHtml(m.senderName)}</b> · ${when}
            </div>
            <div style="margin-top:6px">${escapeHtml(m.content).replaceAll('\n', '<br/>')}</div>
          </div>
        `;
    })
    .join('');

  return `<div>${rows}</div>`;
}
