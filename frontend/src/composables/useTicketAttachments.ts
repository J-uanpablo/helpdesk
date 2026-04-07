// src/composables/useTicketAttachments.ts
import type { Ref } from 'vue';
import { ref } from 'vue';

interface TicketAttachment {
  id: number;
  filename: string;
  path: string;
  mimeType?: string | null;
  size: number;
  createdAt: string;
}

export function useTicketAttachments(opts: {
  apiBase: string;
  ticketId: number;
  token: Ref<string | null | undefined>;
  isTicketClosed: Ref<boolean>;
  messages: Ref<any[]>;
}) {
  const { apiBase, ticketId, token, isTicketClosed, messages } = opts;

  const pendingFiles = ref<File[]>([]);
  const uploadError = ref<string | null>(null);

  function addFiles(files: FileList | File[] | null | undefined) {
    if (!files) return;
    if (isTicketClosed.value) return;

    const list = Array.isArray(files) ? files : Array.from(files);
    if (!list.length) return;

    pendingFiles.value = [...pendingFiles.value, ...list];
  }

  function removePendingFile(idx: number) {
    pendingFiles.value = pendingFiles.value.filter((_, i) => i !== idx);
  }

  function onPaste(e: ClipboardEvent) {
    if (isTicketClosed.value) return;

    const dt = e.clipboardData;
    if (!dt) return;

    const files: File[] = [];
    for (const item of Array.from(dt.items)) {
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f && f.type.startsWith('image/')) files.push(f);
      }
    }
    if (!files.length) return;

    e.preventDefault();

    const stamp = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const name = `captura_${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(
      stamp.getDate()
    )}_${pad(stamp.getHours())}-${pad(stamp.getMinutes())}-${pad(stamp.getSeconds())}.png`;

    const normalized = files.map(f => {
      const finalName = f.name && f.name !== 'image.png' ? f.name : name;
      return new File([f], finalName, { type: f.type });
    });

    addFiles(normalized);
  }

  function normalizeUploadPath(pathOrName: string) {
    const p = (pathOrName || '').trim();
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) return p;
    if (p.startsWith('/uploads/')) return `${apiBase}${p}`;
    if (p.startsWith('uploads/')) return `${apiBase}/${p}`;
    return `${apiBase}/uploads/${p}`;
  }

  function fileUrl(att: { path?: string; filename?: string }) {
    return normalizeUploadPath(att.path || att.filename || '');
  }

  function formatBytes(bytes: number) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  function isImage(att: { mimeType?: string | null; filename?: string }) {
    const mt = (att.mimeType || '').toLowerCase();
    if (mt.startsWith('image/')) return true;
    const name = (att.filename || '').toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name);
  }

  async function forceDownload(url: string, filename: string) {
    const jwt = (token.value ?? '').trim();

    try {
      const res = await fetch(url, {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
        credentials: 'include',
      });

      if (!res.ok) throw new Error(`No se pudo descargar (HTTP ${res.status})`);

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename || 'archivo';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      console.error(e);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  async function downloadAttachment(att: TicketAttachment) {
    const url = fileUrl(att);
    await forceDownload(url, att.filename || 'archivo');
  }

  async function sendWithAttachments(contentFirstFile?: string) {
    uploadError.value = null;

    const jwt = (token.value ?? '').trim();
    if (!jwt) {
      uploadError.value = 'No hay token JWT.';
      return;
    }

    try {
      for (let i = 0; i < pendingFiles.value.length; i++) {
        const f = pendingFiles.value[i];
        const fd = new FormData();

        const content = i === 0 ? (contentFirstFile || '').trim() : '';
        if (content) fd.append('content', content);

        fd.append('file', f);

        const res = await fetch(`${apiBase}/tickets/${ticketId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${jwt}` },
          body: fd,
        });

        if (!res.ok) throw new Error(`Error ${res.status} subiendo adjunto`);

        const msg = await res.json();
        const exists = messages.value.some((m: any) => m.id === msg.id);
        if (!exists) messages.value.push(msg);
      }

      pendingFiles.value = [];
    } catch (e: any) {
      console.error(e);
      uploadError.value = e.message || 'No se pudieron subir los adjuntos.';
    }
  }

  return {
    pendingFiles,
    uploadError,
    addFiles,
    removePendingFile,
    onPaste,
    sendWithAttachments,
    downloadAttachment,
    formatBytes,
    isImage,
    fileUrl,
  };
}
