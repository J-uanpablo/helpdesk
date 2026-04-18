<!-- src/views/HelpdeskPanel.vue -->
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useTicketChat } from '../composables/useTicketChat';
import { useAuth } from '../composables/useAuth';
import { io, Socket } from 'socket.io-client';
import SettingsModal from '../components/settings/SettingsModal.vue';
import { apiFetch } from '../lib/api';
// ===========================
// REPORTES (Excel)
// ===========================
const reportFrom = ref('');
const reportTo = ref('');
const reportArea = ref<string>('ALL'); // ✅ solo super-admin
const showReportModal = ref(false);

const reportAreas = computed(() => {
  // ✅ reutiliza tu lista de áreas (supportAreas) si ya la cargas
  // si no existe supportAreas en tu script, dímelo y lo adaptamos a areasFilter/availableAreas
  return (supportAreas.value || []).map(a => a.name);
});
// const inputStyle = {
//   background: 'var(--bg-soft)',
//   border: '1px solid var(--border-main)',
//   color: 'var(--text-main)',
// };

// function getStatusColor(status) {
//   if (status === 'PENDING') return '#10b981';
//   if (status === 'IN_PROGRESS') return '#f59e0b';
//   if (status === 'RESOLVED') return '#0ea5e9';
//   return '#64748b';
// }
async function downloadSupportReport() {
  const jwt = (token.value ?? '').trim();
  if (!jwt) return;

  if (!reportFrom.value || !reportTo.value) {
    alert('Selecciona desde y hasta');
    return;
  }

  const params = new URLSearchParams({
    from: reportFrom.value,
    to: reportTo.value,
  });

  // ✅ Si es super-admin puede filtrar área opcional
  if (isSuperAdmin.value && reportArea.value !== 'ALL') {
    params.set('area', reportArea.value);
  }

  const url = `${API_BASE}/reports/support-performance.xlsx?${params.toString()}`;

  const res = await apiFetch(url);

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    alert(`Error ${res.status} descargando reporte.\n${txt}`);
    return;
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  const areaPart =
    isSuperAdmin.value && reportArea.value !== 'ALL'
      ? `_${reportArea.value.replace(/\s+/g, '_')}`
      : '_todas';

  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `reporte_soporte${areaPart}_${reportFrom.value}_a_${reportTo.value}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(objectUrl);
  showReportModal.value = false;
}

/* ===========================
   0) CONFIG
=========================== */
const API_BASE = import.meta.env.VITE_API_URL ?? '';

function getJwt(): string {
  return (token.value ?? '').trim();
}

/* ===========================
   1) MODAL LOGOUT
=========================== */
const showLogoutModal = ref(false);
function confirmLogout() {
  showLogoutModal.value = true;
}
function cancelLogout() {
  showLogoutModal.value = false;
}
/* ===========================
   RESPONDER CON PLANTILLA (botón antiguo)
=========================== */
function insertTemplate(text: string) {
  // inserta en el input (al final)
  newMessage.value = (newMessage.value ? newMessage.value + '\n' : '') + text;
}

/* ===========================
   2) ROUTER + AUTH
=========================== */
const router = useRouter();
const route = useRoute();
const { token, user, initAuth } = useAuth();

const isSuperAdmin = computed(() => (user.value?.roles || []).includes('super-admin'));
const isAdmin = computed(() => {
  const roles = user.value?.roles || [];
  return roles.includes('admin') || roles.includes('super-admin');
});

/* id del usuario logueado */
const myId = computed<number | null>(() => {
  const id = user.value?.id;
  return typeof id === 'number' ? id : null;
});

/* ===========================
   3) AUDIO
=========================== */
const notificationAudio = new Audio('/sounds/Sonido_Notificacion.mp3');
notificationAudio.preload = 'auto';

const newTicketAudio = new Audio('/sounds/Nuevo_Ticket.mp3');
newTicketAudio.preload = 'auto';

const audioUnlocked = ref(false);

async function unlockAudio() {
  if (audioUnlocked.value) return;

  try {
    notificationAudio.muted = true;
    newTicketAudio.muted = true;

    await notificationAudio.play().catch(() => {});
    await newTicketAudio.play().catch(() => {});

    notificationAudio.pause();
    newTicketAudio.pause();

    notificationAudio.currentTime = 0;
    newTicketAudio.currentTime = 0;

    notificationAudio.muted = false;
    newTicketAudio.muted = false;

    audioUnlocked.value = true;
    console.log('🔊 Audio desbloqueado');
  } catch (e) {
    console.warn('No se pudo desbloquear audio todavía:', e);
  }
}

function playNotification() {
  if (!audioUnlocked.value) return;

  try {
    notificationAudio.currentTime = 0;
    notificationAudio.play().catch(e => {
      console.error('No se pudo reproducir el sonido de notificación:', e);
    });
  } catch (e) {
    console.error('No se pudo reproducir el sonido de notificación:', e);
  }
}

function playNewTicket() {
  if (!audioUnlocked.value) return;

  try {
    newTicketAudio.currentTime = 0;
    newTicketAudio.play().catch(e => {
      console.error('No se pudo reproducir Nuevo_Ticket.mp3:', e);
    });
  } catch (e) {
    console.error('No se pudo reproducir Nuevo_Ticket.mp3:', e);
  }
}

function handleFirstUserInteraction() {
  void unlockAudio();
  window.removeEventListener('click', handleFirstUserInteraction);
  window.removeEventListener('keydown', handleFirstUserInteraction);
}
/* ===========================
   4) SOCKET NUEVOS TICKETS (1 solo)
=========================== */
const panelSocket = ref<Socket | null>(null);

function disconnectPanelSocket() {
  try {
    panelSocket.value?.off?.('new_ticket');
    panelSocket.value?.disconnect();
  } catch (_) {}
  panelSocket.value = null;
}

function connectPanelSocket() {
  const jwt = getJwt();
  if (!jwt) return;

  disconnectPanelSocket();

  const s = io(API_BASE, {
    transports: ['websocket'],
    auth: { token: jwt },
  });

  panelSocket.value = s;

  s.on('connect', () => console.log('🟢 Panel socket conectado'));
  s.on('disconnect', () => console.log('🔴 Panel socket desconectado'));
  s.on('connect_error', err => console.error('⚠️ Panel socket error:', err));

  s.on('new_ticket', async payload => {
    console.log('🎟️ Evento new_ticket recibido:', payload);
    playNewTicket();
    await loadTickets();
  });
}

/* ===========================
   5) ESTADO CAMBIAR ESTADO
=========================== */
const isUpdatingStatus = ref(false);
const statusError = ref<string | null>(null);

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'ABIERTO' },
  { value: 'IN_PROGRESS', label: 'EN PROGRESO' },
  // { value: 'RESOLVED', label: 'RESUELTO' },
  { value: 'CLOSED', label: 'CERRADO' },
];

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'PENDING', label: 'Abiertos' },
  { value: 'IN_PROGRESS', label: 'En progreso' },
  // { value: 'RESOLVED', label: 'Resueltos' },
  { value: 'CLOSED', label: 'Cerrados' },
] as const;

type StatusFilterValue = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

function getStatusLabel(status?: string | null) {
  switch (status) {
    case 'PENDING':
      return 'ABIERTO';
    case 'IN_PROGRESS':
      return 'EN PROGRESO';
    case 'RESOLVED':
      return 'RESUELTO';
    case 'CLOSED':
      return 'CERRADO';
    default:
      return 'SIN ESTADO';
  }
}

/* ===========================
   6) TIPOS
=========================== */
interface TicketAttachment {
  id: number;
  filename: string;
  path: string;
  mimeType?: string | null;
  size: number;
  createdAt: string;
}

interface TicketMessage {
  id: number;
  content: string;
  createdAt: string;
  senderId?: number;
  sender?: { id: number; name: string };
  attachments?: TicketAttachment[];
}

interface TicketSummary {
  id: number;
  subject: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;

  requesterName?: string | null;

  clientCargo?: string | null;
  clientArea?: string | null;

  assignedToId?: number | null;
  assignedToName?: string | null;

  area?: string | null;
}

/* ===========================
   7) ESTADO GENERAL
=========================== */
const tickets = ref<TicketSummary[]>([]);
const isLoadingTickets = ref(false);
const ticketsError = ref<string | null>(null);

const selectedTicketId = ref<number | null>(null);
const selectedTicket = computed(
  () => tickets.value.find(t => t.id === selectedTicketId.value) || null
);

const isTicketClosed = computed(() => selectedTicket.value?.status === 'CLOSED');

/* ✅ PERMISO PARA CAMBIAR ESTADO */
const canChangeStatus = computed(() => {
  if (!selectedTicket.value) return false;
  if (isAdmin.value) return true;
  return !!myId.value && selectedTicket.value.assignedToId === myId.value;
});

/* ===========================
   7.1) NUEVOS MENSAJES POR TICKET
=========================== */
const ticketLastSeenAt = ref<Record<number, string | null>>({});
const ticketHasNew = ref<Record<number, boolean>>({});
const hasInitialTicketsLoaded = ref(false);

function getTicketActivityTimestamp(t: TicketSummary): string | null {
  return t.updatedAt || t.createdAt || null;
}

function processTicketUpdates(fresh: TicketSummary[]) {
  const lastSeen = { ...ticketLastSeenAt.value };
  const flags = { ...ticketHasNew.value };

  fresh.forEach(t => {
    const ts = getTicketActivityTimestamp(t);
    const prev = lastSeen[t.id] || null;

    if (!hasInitialTicketsLoaded.value) {
      lastSeen[t.id] = ts;
      flags[t.id] = false;
    } else {
      if (t.id !== selectedTicketId.value) {
        if (ts && ts !== prev) flags[t.id] = true;
      }
      lastSeen[t.id] = ts;
    }
  });

  ticketLastSeenAt.value = lastSeen;
  ticketHasNew.value = flags;
  hasInitialTicketsLoaded.value = true;
}

/* ===========================
   7.2) ÁREAS (DESDE BD /support-areas) SOLO ADMIN
=========================== */
interface SupportArea {
  id: number;
  name: string;
  isActive: boolean;
}

const supportAreas = ref<SupportArea[]>([]);

async function loadSupportAreas() {
  if (!isAdmin.value) {
    supportAreas.value = [];
    return;
  }

  const jwt = getJwt();
  if (!jwt) {
    supportAreas.value = [];
    return;
  }

  try {
    const res = await apiFetch(`${API_BASE}/support-areas`, {
      method: 'GET',
    });

    if (!res.ok) throw new Error(`Error ${res.status} al cargar áreas`);

    const data = await res.json();

    supportAreas.value = (Array.isArray(data) ? data : [])
      .map((a: any) => ({
        id: Number(a.id),
        name: String(a.name ?? '').trim(),
        isActive: Boolean(a.isActive ?? a.active ?? a.is_active ?? false),
      }))
      .filter((a: any) => a.id && a.name && a.isActive)
      .sort((a: any, b: any) => a.name.localeCompare(b.name, 'es-CO', { sensitivity: 'base' }));

    // si el área seleccionada ya no existe → resetea
    if (areaFilter.value !== 'ALL' && !supportAreas.value.some(a => a.name === areaFilter.value)) {
      areaFilter.value = 'ALL';
      agentFilter.value = 'ALL';
    }
  } catch (e) {
    console.error('❌ loadSupportAreas:', e);
    supportAreas.value = [];
  }
}

/* ===========================
   7.3) FILTROS (ÁREAS + AGENTES)
=========================== */
const statusFilter = ref<StatusFilterValue>('ALL');
const areaFilter = ref<string>('ALL'); // nombre del área
const agentFilter = ref<string>('ALL');

/* ✅ normaliza para comparar sin fallar por MAYUS/espacios */
function normalize(v: any): string {
  return String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/* ✅ saca el área real del ticket */
function getTicketArea(t: any): string {
  return (
    t?.area ??
    t?.areaName ??
    t?.supportAreaName ??
    t?.supportArea?.name ??
    t?.support_area?.name ??
    ''
  );
}

/* ✅ Áreas disponibles para el <select> */
const availableAreas = computed(() => {
  if (!isAdmin.value) return [];
  return supportAreas.value.map(a => a.name);
});

/* ✅ Cuando cambias el área, resetea agente */
watch(
  () => areaFilter.value,
  () => {
    agentFilter.value = 'ALL';
  }
);

/* ✅ Agentes DEPENDEN del área seleccionada */
const availableAgents = computed(() => {
  if (!isAdmin.value) return [];

  let list: any[] = [...tickets.value];

  if (areaFilter.value !== 'ALL') {
    const selected = normalize(areaFilter.value);
    list = list.filter(t => normalize(getTicketArea(t)) === selected);
  }

  const map = new Map<number, string>();
  list.forEach(t => {
    if (t.assignedToId && t.assignedToName) {
      map.set(Number(t.assignedToId), String(t.assignedToName));
    }
  });

  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es-CO', { sensitivity: 'base' }));
});

/* ✅ Tickets filtrados */
const filteredTickets = computed(() => {
  let list: any[] = [...tickets.value];

  if (statusFilter.value !== 'ALL') {
    list = list.filter(t => t.status === statusFilter.value);
  }

  if (isAdmin.value && areaFilter.value !== 'ALL') {
    const selected = normalize(areaFilter.value);
    list = list.filter(t => normalize(getTicketArea(t)) === selected);
  }

  if (isAdmin.value && agentFilter.value !== 'ALL') {
    if (agentFilter.value === 'UNASSIGNED') {
      list = list.filter(t => !t.assignedToId);
    } else {
      const id = Number(agentFilter.value);
      list = list.filter(t => Number(t.assignedToId) === id);
    }
  }

  return list.sort((a, b) => {
    // 1. CERRADOS siempre al final
    if (a.status === 'CLOSED' && b.status !== 'CLOSED') return 1;
    if (a.status !== 'CLOSED' && b.status === 'CLOSED') return -1;

    // 2. Dentro de CERRADOS → más recientes primero (LIFO)
    if (a.status === 'CLOSED' && b.status === 'CLOSED') {
      const va = a.closedAt ? new Date(a.closedAt).getTime() : 0;
      const vb = b.closedAt ? new Date(b.closedAt).getTime() : 0;
      return vb - va; // 👈 más reciente arriba
    }

    // 3. SIN ASIGNAR arriba
    if (!a.assignedToId && b.assignedToId) return -1;
    if (a.assignedToId && !b.assignedToId) return 1;

    // 4. FIFO para activos (por fecha de creación)
    const va = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const vb = b.createdAt ? new Date(b.createdAt).getTime() : 0;

    return va - vb;
  });
});

/* Contadores */
const totalTickets = computed(() => tickets.value.length);
const filteredCount = computed(() => filteredTickets.value.length);
const openCount = computed(() => tickets.value.filter(t => t.status === 'PENDING').length);
const inProgressCount = computed(
  () => tickets.value.filter(t => t.status === 'IN_PROGRESS').length
);
const resolvedCount = computed(() => tickets.value.filter(t => t.status === 'RESOLVED').length);
const closedCount = computed(() => tickets.value.filter(t => t.status === 'CLOSED').length);

/* ===========================
   8) CHAT (WS)
=========================== */
const chatApi: any = useTicketChat();
const { messages, isConnected, isConnecting, lastError, connect, sendMessage } = chatApi;

const typedMessages = computed<TicketMessage[]>(() => messages.value as TicketMessage[]);
const newMessage = ref('');

/* ==========================================================
   8.2) QUICK REPLIES CON "/" (SUGERENCIAS EN EL INPUT)
========================================================== */
type QuickReply = { id: number; title: string; content: string };

const quickReplies = ref<QuickReply[]>([]);
const quickRepliesLoaded = ref(false);

const showQuickReplies = ref(false);
const quickReplyQuery = ref(''); // texto después de "/"
const selectedReplyIndex = ref(0);

function extractSlashQuery(text: string): string | null {
  // Busca último "/" y valida que sea inicio o precedido por espacio
  const idx = text.lastIndexOf('/');
  if (idx < 0) return null;

  const prev = idx === 0 ? ' ' : text[idx - 1];
  const validPrev = prev === ' ' || prev === '\n' || prev === '\t';
  if (!validPrev) return null;

  // lo que viene después del /
  return text.slice(idx + 1);
}

async function fetchQuickReplies() {
  const jwt = getJwt();
  if (!jwt) return;

  try {
    const res = await apiFetch(`${API_BASE}/quick-replies`);
    if (!res.ok) return;

    const data = await res.json();
    quickReplies.value = Array.isArray(data) ? data : [];
    quickRepliesLoaded.value = true;
  } catch (e) {
    // no bloquea el chat
    console.warn('No se pudieron cargar quick replies:', e);
  }
}

const filteredQuickReplies = computed(() => {
  const term = (quickReplyQuery.value || '').trim().toLowerCase();
  if (!term) return quickReplies.value;

  return quickReplies.value.filter(
    t => t.title.toLowerCase().includes(term) || t.content.toLowerCase().includes(term)
  );
});

function closeQuickReplies() {
  showQuickReplies.value = false;
  quickReplyQuery.value = '';
  selectedReplyIndex.value = 0;
}

function applyTemplate(tpl: QuickReply) {
  // Reemplaza desde el último "/...query" hasta el final por el contenido de la plantilla
  const text = newMessage.value || '';
  const idx = text.lastIndexOf('/');
  if (idx >= 0) {
    const before = text.slice(0, idx);
    const insert = tpl.content;
    newMessage.value = before + insert;
  } else {
    newMessage.value = (newMessage.value ? newMessage.value + '\n' : '') + tpl.content;
  }
  closeQuickReplies();
}

function onMessageInput() {
  // Solo habilitar si hay ticket seleccionado y no está cerrado
  if (!selectedTicketId.value || isTicketClosed.value) {
    closeQuickReplies();
    return;
  }

  const q = extractSlashQuery(newMessage.value);
  if (q === null) {
    closeQuickReplies();
    return;
  }

  // Si el usuario acaba de poner "/" o está escribiendo después
  quickReplyQuery.value = q;
  showQuickReplies.value = true;
  selectedReplyIndex.value = 0;

  // Cargar plantillas al primer uso
  if (!quickRepliesLoaded.value) void fetchQuickReplies();
}

function onMessageKeydown(e: KeyboardEvent) {
  if (!showQuickReplies.value) return;

  const list = filteredQuickReplies.value;
  if (!list.length) {
    if (e.key === 'Escape') closeQuickReplies();
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedReplyIndex.value = (selectedReplyIndex.value + 1) % list.length;
    return;
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedReplyIndex.value = (selectedReplyIndex.value - 1 + list.length) % list.length;
    return;
  }

  if (e.key === 'Enter') {
    // si el dropdown está abierto, Enter selecciona plantilla
    e.preventDefault();
    applyTemplate(list[selectedReplyIndex.value]);
    return;
  }

  if (e.key === 'Escape') {
    e.preventDefault();
    closeQuickReplies();
    return;
  }
}

/* ==========================================================
   17) PENDING FILES + DRAG&DROP + CTRL+V
========================================================== */
const pendingFiles = ref<File[]>([]);
const isUploading = ref(false);
const uploadError = ref<string | null>(null);
const openSettings = ref(false);

/* ===========================
   BORRADOR POR TICKET (texto persistente + adjuntos en memoria)
=========================== */
// ✅ Adjuntos en memoria (sirve si sales y vuelves SIN recargar la página)
const draftMemory = (globalThis as any).__ticketDraftMemoryHelpdesk ?? new Map<number, File[]>();
(globalThis as any).__ticketDraftMemoryHelpdesk = draftMemory;

function draftTextKey(ticketId: number) {
  return `helpdesk_draft_text_${ticketId}`;
}

function saveDraft(ticketId: number) {
  if (!ticketId) return;
  localStorage.setItem(draftTextKey(ticketId), newMessage.value ?? '');
  draftMemory.set(ticketId, [...pendingFiles.value]);
}

function loadDraft(ticketId: number) {
  if (!ticketId) return;
  const savedText = localStorage.getItem(draftTextKey(ticketId));
  newMessage.value = savedText ?? '';
  const memFiles = draftMemory.get(ticketId);
  pendingFiles.value = memFiles?.length ? [...memFiles] : [];
}

function clearDraft(ticketId: number) {
  if (!ticketId) return;
  localStorage.removeItem(draftTextKey(ticketId));
  draftMemory.delete(ticketId);
}

/* ✅ auto-guardar mientras escribe / adjunta */
watch(
  () => newMessage.value,
  () => {
    if (selectedTicketId.value) saveDraft(selectedTicketId.value);
  }
);

watch(
  () => pendingFiles.value.length,
  () => {
    if (selectedTicketId.value) saveDraft(selectedTicketId.value);
  }
);

/* ===========================
   canSend
=========================== */
const canSend = computed(() => {
  if (!selectedTicketId.value) return false;
  if (isTicketClosed.value) return false;
  if (isUploading.value) return false;

  if (pendingFiles.value.length > 0) return true;

  return isConnected.value && newMessage.value.trim().length > 0;
});

function isMine(msg: TicketMessage): boolean {
  const uid = myId.value;
  if (!uid) return false;
  if (msg.senderId === uid) return true;
  if (msg.sender && msg.sender.id === uid) return true;
  return false;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

/* ===========================
   8.1) NOTIFICACIÓN / SCROLL
=========================== */
const lastMessagesCount = ref(0);
const hasInitializedMessages = ref(false);
const lastTicketChangeAt = ref<number | null>(null);

const chatContainer = ref<HTMLDivElement | null>(null);
const isAtBottom = ref(true);

function checkIfAtBottom() {
  const el = chatContainer.value;
  if (!el) return;
  const threshold = 80;
  const diff = el.scrollHeight - (el.scrollTop + el.clientHeight);
  isAtBottom.value = diff <= threshold;
}

function scrollToBottom() {
  const el = chatContainer.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

watch(
  () => typedMessages.value.length,
  newLen => {
    if (!hasInitializedMessages.value) {
      hasInitializedMessages.value = true;
      lastMessagesCount.value = newLen;
      nextTick(() => scrollToBottom());
      return;
    }

    if (newLen <= lastMessagesCount.value) {
      lastMessagesCount.value = newLen;
      return;
    }

    const last = typedMessages.value[typedMessages.value.length - 1];
    if (!last) {
      lastMessagesCount.value = newLen;
      return;
    }

    const uid = myId.value;
    const isFromMe = !!uid && (last.senderId === uid || last.sender?.id === uid);

    const now = Date.now();
    const isWithinInitWindow = lastTicketChangeAt.value && now - lastTicketChangeAt.value < 1500;

    if (!isFromMe && !isWithinInitWindow) playNotification();

    lastMessagesCount.value = newLen;
    if (isAtBottom.value || isFromMe) nextTick(() => scrollToBottom());
  }
);

/* ===========================
   9) UI TICKETS
=========================== */
function isUnassigned(t: any) {
  return !t.assignedToId;
}
function ticketCardClasses(t: any) {
  const base = 'rounded-lg border px-3 py-2 transition-colors cursor-pointer select-none';
  if (isUnassigned(t)) {
    return `${base} border-amber-400/60 bg-amber-500/10 hover:bg-amber-500/15`;
  }
  return `${base} border-slate-800 bg-slate-950/60 hover:bg-slate-900/60`;
}

/* ===========================
   10) CAMBIAR ESTADO
=========================== */
async function changeStatus(newStatus: string) {
  statusError.value = null;
  if (!selectedTicketId.value) return;

  if (!canChangeStatus.value) {
    statusError.value = 'No puedes cambiar el estado: el ticket no está asignado a ti.';
    return;
  }

  const jwt = getJwt();
  if (!jwt) {
    statusError.value = 'No hay token JWT para autenticar la petición.';
    return;
  }

  isUpdatingStatus.value = true;
  try {
    const res = await apiFetch(`${API_BASE}/tickets/${selectedTicketId.value}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: newStatus,
        note: 'Estado actualizado desde el panel de ayuda',
      }),
    });

    if (!res.ok) throw new Error(`Error ${res.status} al actualizar el estado`);

    const idx = tickets.value.findIndex(t => t.id === selectedTicketId.value);
    if (idx !== -1) tickets.value[idx] = { ...tickets.value[idx], status: newStatus };
  } catch (err: any) {
    console.error(err);
    statusError.value = err.message || 'No se pudo actualizar el estado.';
  } finally {
    isUpdatingStatus.value = false;
  }
}

/* ===========================
   11) AUTO: PONER EN PROGRESO
=========================== */
async function ensureInProgress(ticketId: number) {
  const t = tickets.value.find(x => x.id === ticketId);
  if (!t) return;

  if (t.status !== 'PENDING') return;
  if (isAdmin.value) return;
  if (!myId.value || t.assignedToId !== myId.value) return;

  const jwt = getJwt();
  if (!jwt) return;

  try {
    const res = await apiFetch(`${API_BASE}/tickets/${ticketId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'IN_PROGRESS',
        note: 'Auto: al abrir el chat',
      }),
    });

    if (res.ok) {
      const idx = tickets.value.findIndex(x => x.id === ticketId);
      if (idx !== -1) tickets.value[idx] = { ...tickets.value[idx], status: 'IN_PROGRESS' };
    }
  } catch (e) {
    console.error('No se pudo auto-cambiar a EN PROGRESO:', e);
  }
}

/* ===========================
   12) CARGAR TICKETS
=========================== */
async function loadTickets() {
  ticketsError.value = null;

  const jwt = getJwt();
  if (!jwt) {
    tickets.value = [];
    isLoadingTickets.value = false;
    ticketsError.value = 'No hay token JWT. Inicia sesión nuevamente.';
    return;
  }

  isLoadingTickets.value = true;

  try {
    const res = await apiFetch(`${API_BASE}/tickets/panel-list`, {
      method: 'GET',
    });

    if (!res.ok) throw new Error(`Error ${res.status} al cargar los tickets`);

    const data: TicketSummary[] = await res.json();

    tickets.value = (Array.isArray(data) ? data : []).map((t: any) => ({
      ...t,
      area: String(t.area ?? '').trim() || null,
    }));

    processTicketUpdates(tickets.value);

    // Si el ticket seleccionado ya no existe, cerrar chat
    if (selectedTicketId.value) {
      const stillExists = tickets.value.some(t => t.id === selectedTicketId.value);
      if (!stillExists) closeChat();
    }
  } catch (err: any) {
    console.error(err);
    tickets.value = [];
    ticketsError.value = err?.message || 'Error al cargar los tickets.';
  } finally {
    isLoadingTickets.value = false;
  }
}

/* ===========================
   13) CONECTAR CHAT
=========================== */
function connectToSelected() {
  const jwt = getJwt();
  if (!selectedTicketId.value || !jwt) return;

  hasInitializedMessages.value = false;
  lastMessagesCount.value = 0;
  lastTicketChangeAt.value = Date.now();

  ticketHasNew.value[selectedTicketId.value] = false;

  connect(selectedTicketId.value, jwt);
  nextTick(() => scrollToBottom());
}

/* ===========================
   14) SALIR DEL CHAT (ESC) + BORRADOR
=========================== */
function closeChat() {
  // ✅ guardar borrador del ticket actual
  if (selectedTicketId.value) {
    saveDraft(selectedTicketId.value);
  }

  selectedTicketId.value = null;

  hasInitializedMessages.value = false;
  lastMessagesCount.value = 0;

  // limpiamos UI (borrador ya quedó guardado)
  newMessage.value = '';
  pendingFiles.value = [];
  uploadError.value = null;
  isDragging.value = false;

  closeQuickReplies();

  try {
    chatApi?.disconnect?.();
  } catch (_) {}
}

/* ===========================
   15) SELECCIONAR TICKET (GUARDA borrador anterior, CARGA borrador nuevo)
=========================== */
async function handleSelectTicket(ticket: TicketSummary) {
  // ✅ si venías de otro ticket, guarda su borrador antes de cambiar
  if (selectedTicketId.value && selectedTicketId.value !== ticket.id) {
    saveDraft(selectedTicketId.value);
  }

  selectedTicketId.value = ticket.id;
  ticketHasNew.value[ticket.id] = false;

  // ✅ cargar borrador de este ticket
  loadDraft(ticket.id);

  connectToSelected();

  // Auto-assign si support (no admin) y está sin asignar
  if (!isAdmin.value && !ticket.assignedToId && myId.value) {
    const jwt = getJwt();
    if (!jwt) return;

    try {
      const res = await apiFetch(`${API_BASE}/tickets/${ticket.id}/assign-me`, {
        method: 'PATCH',
      });

      if (res.ok) {
        const idx = tickets.value.findIndex(t => t.id === ticket.id);
        if (idx !== -1) {
          tickets.value[idx] = {
            ...tickets.value[idx],
            assignedToId: myId.value,
            assignedToName: (user.value as any)?.name || tickets.value[idx].assignedToName,
          };
        }

        await ensureInProgress(ticket.id);
      }
    } catch (e) {
      console.error('Error asignando ticket al agente:', e);
    }

    return;
  }

  await ensureInProgress(ticket.id);
}
function openTicketFromQuery() {
  const rawId = route.query.ticketId;
  const ticketId = Number(rawId);

  if (!ticketId || Number.isNaN(ticketId)) return;
  if (!tickets.value.length) return;

  const found = tickets.value.find(t => Number(t.id) === ticketId);
  if (!found) return;

  void handleSelectTicket(found);

  router.replace({ name: 'soporte' });
}

watch(
  () => tickets.value.length,
  async len => {
    if (!len) return;
    await nextTick();
    openTicketFromQuery();
  },
  { immediate: true }
);

watch(
  () => route.query.ticketId,
  async () => {
    await nextTick();
    openTicketFromQuery();
  }
);

/* ==========================================================
   16) ARCHIVOS: urls / bytes / isImage
========================================================== */
function normalizeUploadPath(pathOrName: string) {
  const p = (pathOrName || '').trim();
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith('/uploads/')) return `${API_BASE}${p}`;
  if (p.startsWith('uploads/')) return `${API_BASE}/${p}`;
  return `${API_BASE}/uploads/${p}`;
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

/* ==========================================================
   17) PENDING FILES + DRAG&DROP + CTRL+V
========================================================== */
function addFiles(files: FileList | File[] | null | undefined) {
  if (!files) return;
  if (!selectedTicketId.value) return;
  if (isTicketClosed.value) return;

  const list = Array.isArray(files) ? files : Array.from(files);
  if (!list.length) return;

  pendingFiles.value = [...pendingFiles.value, ...list];
  // auto-save
  saveDraft(selectedTicketId.value);
}

function removePendingFile(idx: number) {
  pendingFiles.value = pendingFiles.value.filter((_, i) => i !== idx);
  if (selectedTicketId.value) saveDraft(selectedTicketId.value);
}

const isDragging = ref(false);
function onDragOver(e: DragEvent) {
  if (!selectedTicketId.value || isTicketClosed.value) return;
  e.preventDefault();
  isDragging.value = true;
}
function onDragLeave(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;
}
function onDropFiles(e: DragEvent) {
  if (!selectedTicketId.value || isTicketClosed.value) return;
  e.preventDefault();
  isDragging.value = false;

  const files = e.dataTransfer?.files;
  if (files && files.length) addFiles(files);
}

function onPaste(e: ClipboardEvent) {
  if (!selectedTicketId.value || isTicketClosed.value) return;

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

/* ==========================================================
   18) MODAL IMAGEN + ZOOM + GALERÍA
========================================================== */
type GalleryItem = { id: number; url: string; name: string };

const imagePreviewOpen = ref(false);
const imagePreviewUrl = ref('');
const imagePreviewName = ref('');

const imageGallery = ref<GalleryItem[]>([]);
const imageIndex = ref(0);
const previewScale = ref(1);

function buildImageGallery(): GalleryItem[] {
  const items: GalleryItem[] = [];
  const seen = new Set<number>();

  for (const msg of typedMessages.value) {
    for (const att of msg.attachments || []) {
      if (!isImage(att) || seen.has(att.id)) continue;
      seen.add(att.id);
      items.push({ id: att.id, url: fileUrl(att), name: att.filename });
    }
  }
  return items;
}

function setPreviewByIndex(idx: number) {
  const item = imageGallery.value[idx];
  if (!item) return;
  imageIndex.value = idx;
  imagePreviewUrl.value = item.url;
  imagePreviewName.value = item.name;
}

function openImagePreview(att: TicketAttachment) {
  imageGallery.value = buildImageGallery();
  const idx = imageGallery.value.findIndex(i => i.id === att.id);

  previewScale.value = 1;
  imagePreviewOpen.value = true;
  setPreviewByIndex(idx >= 0 ? idx : 0);
}

function closeImagePreview() {
  imagePreviewOpen.value = false;
  imagePreviewUrl.value = '';
  imagePreviewName.value = '';
  imageGallery.value = [];
  imageIndex.value = 0;
  previewScale.value = 1;
}

function prevImage() {
  if (imageGallery.value.length <= 1) return;
  const next = (imageIndex.value - 1 + imageGallery.value.length) % imageGallery.value.length;
  previewScale.value = 1;
  setPreviewByIndex(next);
}

function nextImage() {
  if (imageGallery.value.length <= 1) return;
  const next = (imageIndex.value + 1) % imageGallery.value.length;
  previewScale.value = 1;
  setPreviewByIndex(next);
}

function onPreviewWheel(e: WheelEvent) {
  if (!imagePreviewOpen.value) return;
  e.preventDefault();

  const step = e.deltaY > 0 ? -0.1 : 0.1;
  const next = Math.min(5, Math.max(0.5, Number((previewScale.value + step).toFixed(2))));
  previewScale.value = next;
}

async function downloadImage() {
  const url = imagePreviewUrl.value;
  if (!url) return;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo descargar (HTTP ${res.status})`);

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = imagePreviewName.value || 'imagen';
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(objectUrl);
  } catch (e) {
    console.error(e);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/* ==========================================================
   19) ENVIAR MENSAJE (WS o REST con adjuntos)
========================================================== */
async function uploadFilesAndSend() {
  if (!selectedTicketId.value) return;
  if (isTicketClosed.value) return;
  if (!pendingFiles.value.length) return;

  uploadError.value = null;
  isUploading.value = true;

  const jwt = getJwt();
  if (!jwt) {
    uploadError.value = 'No hay token JWT.';
    isUploading.value = false;
    return;
  }

  try {
    for (let i = 0; i < pendingFiles.value.length; i++) {
      const f = pendingFiles.value[i];
      const fd = new FormData();

      const content = i === 0 ? newMessage.value.trim() : '';
      if (content) fd.append('content', content);

      fd.append('file', f);

      const res = await apiFetch(`${API_BASE}/tickets/${selectedTicketId.value}/messages`, {
        method: 'POST',
        body: fd,
      });

      if (!res.ok) throw new Error(`Error ${res.status} subiendo archivo`);

      const msg = await res.json();
      const existing = (typedMessages.value as any[]).some(m => m?.id === msg?.id);
      if (!existing) (messages.value as any[]).push(msg);
    }

    pendingFiles.value = [];
    newMessage.value = '';
    closeQuickReplies();
    // ✅ borrador enviado → limpiar storage
    clearDraft(selectedTicketId.value);

    nextTick(() => scrollToBottom());
  } catch (err: any) {
    console.error(err);
    uploadError.value = err?.message || 'No se pudieron subir los archivos.';
  } finally {
    isUploading.value = false;
  }
}

function handleSend() {
  if (!selectedTicketId.value) return;
  if (isTicketClosed.value) return;
  if (!canSend.value) return;

  // si dropdown está abierto y presionan enter, lo maneja onMessageKeydown
  if (showQuickReplies.value) return;

  if (pendingFiles.value.length > 0) {
    void uploadFilesAndSend();
    return;
  }

  if (!isConnected.value) return;

  const text = newMessage.value.trim();
  if (!text) return;

  sendMessage(selectedTicketId.value as number, text);
  newMessage.value = '';
  closeQuickReplies();

  // ✅ al enviar texto, borrador limpio
  clearDraft(selectedTicketId.value);
}

/* ===========================
   20) TECLAS (ESC + flechas)
=========================== */
function handleKeydown(e: KeyboardEvent) {
  // ⛔ no interceptar si estás escribiendo en input/textarea
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  // 🖼️ Si preview está abierta: ESC cierra preview, flechas navegan
  if (imagePreviewOpen.value) {
    if (e.key === 'Escape') closeImagePreview();
    if (e.key === 'ArrowLeft') prevImage();
    if (e.key === 'ArrowRight') nextImage();
    return;
  }

  // 🚪 ESC sale del chat (y guarda borrador)
  if (e.key === 'Escape' && selectedTicketId.value) {
    closeChat();
  }
}

/* ===========================
   21) WATCH TOKEN: carga y conecta sockets
=========================== */
watch(
  () => (token.value ?? '').trim(),
  async jwt => {
    if (!jwt) {
      tickets.value = [];
      supportAreas.value = [];
      disconnectPanelSocket();
      closeChat();
      return;
    }

    connectPanelSocket();
    await loadSupportAreas();
    await loadTickets();

    // precarga plantillas (opcional, así el "/" abre instantáneo)
    quickRepliesLoaded.value = false;
    quickReplies.value = [];
    void fetchQuickReplies();
  },
  { immediate: true }
);

/* ===========================
   22) AUTO-REFRESH
=========================== */
let refreshId: number | null = null;

/* ===========================
   LIFECYCLE
=========================== */

onMounted(async () => {
  initAuth();
  await nextTick();

  try {
    notificationAudio.load();
    newTicketAudio.load();
  } catch (_) {}

  window.addEventListener('click', handleFirstUserInteraction, { once: true });
  window.addEventListener('keydown', handleFirstUserInteraction, { once: true });

  // if (getJwt()) {
  //   connectPanelSocket();
  //   await loadSupportAreas();
  //   await loadTickets();
  //   void fetchQuickReplies();
  // }

  refreshId = window.setInterval(() => {
    if (getJwt()) loadTickets();
  }, 3000);

  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  if (selectedTicketId.value) {
    saveDraft(selectedTicketId.value);
  }

  if (refreshId !== null) clearInterval(refreshId);
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('click', handleFirstUserInteraction);
  window.removeEventListener('keydown', handleFirstUserInteraction);

  disconnectPanelSocket();

  try {
    chatApi?.disconnect?.();
  } catch (_) {}
});
</script>

<template>
  <!-- ROOT -->
  <div
    class="flex-1 min-h-0 flex overflow-hidden shadow-lg border"
    :style="{
      background: 'var(--bg-panel)',
      borderColor: 'var(--border-main)',
      color: 'var(--text-main)',
    }"
  >
    <!-- ========================= COLUMNA IZQUIERDA (Tickets) ========================== -->
    <aside
      class="w-[500px] shrink-0 flex flex-col min-h-0 overflow-hidden border-r"
      :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
    >
      <!-- Header lista -->
      <div
        class="shrink-0 px-3 py-2 flex items-center justify-between border-b"
        :style="{ borderColor: 'var(--border-main)' }"
      >
        <span class="text-xs font-semibold uppercase" :style="{ color: 'var(--text-soft)' }">
          Tickets
        </span>
        <span
          class="text-[11px] flex items-center gap-1"
          :class="{
            'text-emerald-500': isConnected,
            'text-yellow-500': isConnecting,
            'text-slate-500': !isConnected && !isConnecting,
          }"
        >
          <span
            class="w-2 h-2 rounded-full"
            :class="{
              'bg-emerald-500': isConnected,
              'bg-yellow-500': isConnecting,
              'bg-slate-500': !isConnected && !isConnecting,
            }"
          />
          {{ isConnecting ? 'Conectando' : isConnected ? 'Conectado' : 'Desconectado' }}
        </span>
      </div>
      <!-- Filtros -->
      <div
        class="shrink-0 px-3 py-3 text-[11px] space-y-2 border-b"
        :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
      >
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="f in STATUS_FILTERS"
            :key="f.value"
            type="button"
            class="px-3 py-1 rounded-full border font-semibold transition-colors"
            :style="
              statusFilter === f.value
                ? { background: '#10b981', color: '#ffffff', borderColor: '#10b981' }
                : {
                    background: 'transparent',
                    color: 'var(--text-soft)',
                    borderColor: 'var(--border-main)',
                  }
            "
            @click="statusFilter = f.value"
          >
            <template v-if="f.value === 'ALL'">Todos ({{ totalTickets }})</template>
            <template v-else-if="f.value === 'PENDING'">Abiertos ({{ openCount }})</template>
            <template v-else-if="f.value === 'IN_PROGRESS'">
              En progreso ({{ inProgressCount }})
            </template>
            <template v-else-if="f.value === 'RESOLVED'">
              Resueltos ({{ resolvedCount }})
            </template>
            <template v-else-if="f.value === 'CLOSED'">Cerrados ({{ closedCount }})</template>
          </button>
        </div>
        <!-- Filtros extra SOLO para admin -->
        <div v-if="isAdmin" class="flex flex-col gap-2 mt-1">
          <div class="flex flex-wrap gap-2">
            <select
              v-model="areaFilter"
              class="flex-1 min-w-[120px] rounded-md px-2 py-1 border focus:outline-none focus:ring-1 focus:ring-emerald-500"
              :style="{
                background: 'var(--bg-soft)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-main)',
              }"
            >
              <option value="ALL">Todas las áreas</option>
              <option v-for="a in availableAreas" :key="a" :value="a">{{ a }}</option>
            </select>
            <select
              v-model="agentFilter"
              class="flex-1 min-w-[130px] rounded-md px-2 py-1 border focus:outline-none focus:ring-1 focus:ring-emerald-500"
              :style="{
                background: 'var(--bg-soft)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-main)',
              }"
            >
              <option value="ALL">Todos los agentes</option>
              <option value="UNASSIGNED">Sin asignar</option>
              <option v-for="ag in availableAgents" :key="ag.id" :value="String(ag.id)">
                {{ ag.name }}
              </option>
            </select>
          </div>
          <p class="text-[11px]" :style="{ color: 'var(--text-muted)' }">
            {{ filteredCount }} de {{ totalTickets }} tickets mostrados.
          </p>
        </div>
      </div>
      <!-- LISTA -->
      <div class="flex-1 min-h-0 overflow-y-auto">
        <div
          v-if="!tickets.length && !isLoadingTickets"
          class="h-full flex items-center justify-center px-3 text-center"
        >
          <p class="text-xs" :style="{ color: 'var(--text-muted)' }">
            No hay tickets cargados.<br />
            Pulsa <span class="font-semibold">“Cargar tickets”</span>.
          </p>
        </div>
        <div
          v-else-if="tickets.length && !filteredTickets.length"
          class="h-full flex items-center justify-center px-3 text-center"
        >
          <p class="text-xs" :style="{ color: 'var(--text-muted)' }">
            No hay tickets con los filtros actuales.
          </p>
        </div>
        <ul v-else class="space-y-2 list-none m-0 p-2">
          <li
            v-for="t in filteredTickets"
            :key="t.id"
            @click="handleSelectTicket(t)"
            class="relative rounded-xl px-4 py-3 cursor-pointer transition border hover:shadow-md"
            :style="{
              background:
                t.id === selectedTicketId
                  ? 'var(--ticket-selected-bg)'
                  : isUnassigned(t)
                  ? 'var(--ticket-unassigned-bg)'
                  : 'var(--bg-soft)',
              borderColor:
                t.id === selectedTicketId
                  ? 'rgba(16,185,129,0.55)'
                  : isUnassigned(t)
                  ? 'rgba(245,158,11,0.45)'
                  : 'var(--border-main)',
              boxShadow: t.id === selectedTicketId ? '0 0 0 2px rgba(16,185,129,0.18)' : 'none',
            }"
          >
            <!-- Barra izquierda sin asignar -->
            <div
              v-if="isUnassigned(t)"
              class="absolute left-0 top-0 h-full w-1.5 rounded-l-xl"
              style="background: #f59e0b"
            />
            <!-- Header -->
            <div class="flex justify-between items-start gap-3">
              <h3 class="text-base font-medium truncate">
                #{{ t.id }} – {{ t.subject || 'Sin asunto' }}
              </h3>
              <div class="flex items-center gap-2 shrink-0">
                <!-- Estado -->
                <span
                  class="text-xs px-3 py-1 rounded-full font-semibold border"
                  :class="{
                    'border-emerald-500 text-emerald-300 bg-emerald-500/10': t.status === 'PENDING',
                    'border-amber-500 text-amber-300 bg-amber-500/10': t.status === 'IN_PROGRESS',
                    'border-sky-500 text-sky-300 bg-sky-500/10': t.status === 'RESOLVED',
                    'border-slate-500 text-slate-500 bg-slate-500/10':
                      !t.status || t.status === 'CLOSED',
                  }"
                >
                  {{ getStatusLabel(t.status) }}
                </span>
                <!-- Nuevo -->
                <span
                  v-if="ticketHasNew[t.id]"
                  class="text-xs px-3 py-1 rounded-full bg-emerald-500 text-white font-semibold uppercase"
                >
                  Nuevo
                </span>
              </div>
            </div>
            <!-- Cliente -->
            <p class="text-sm mt-1 truncate" :style="{ color: 'var(--text-main)' }">
              {{ t.requesterName || 'Usuario desconocido' }}
            </p>
            <!-- Cargo / Área -->
            <p
              v-if="t.clientCargo || t.clientArea"
              class="text-sm truncate"
              :style="{ color: 'var(--text-soft)' }"
            >
              {{ t.clientCargo }} <span v-if="t.clientCargo && t.clientArea"> · </span>
              {{ t.clientArea }}
            </p>
            <!-- Footer -->
            <div
              class="flex items-center justify-between mt-3 text-sm"
              :style="{ color: 'var(--text-soft)' }"
            >
              <span class="truncate">
                🕒
                {{
                  t.updatedAt || t.createdAt
                    ? formatDateTime((t.updatedAt || t.createdAt) as string)
                    : ''
                }}
              </span>
              <span v-if="t.assignedToName" class="truncate"> 🎧 {{ t.assignedToName }} </span>
              <span
                v-if="isUnassigned(t)"
                class="px-2 py-0.5 rounded-full text-xs border"
                style="border-color: #f59e0b; color: #fbbf24"
              >
                SIN ASIGNAR
              </span>
            </div>
          </li>
        </ul>
      </div>
    </aside>
    <!-- ========================= COLUMNA DERECHA (Chat) ========================== -->
    <section
      class="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden"
      :style="{ background: 'var(--bg-main)' }"
    >
      <!-- HEADER CHAT -->
      <div
        class="shrink-0 px-6 py-5 border-b"
        :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
      >
        <div class="flex items-start justify-between gap-6">
          <div class="min-w-0">
            <h2 class="text-2xl font-bold leading-tight truncate">
              <span v-if="selectedTicketId">Ticket #{{ selectedTicketId }}</span>
              <span v-else>Selecciona un ticket</span>
            </h2>
            <p class="text-base mt-1 truncate" :style="{ color: 'var(--text-soft)' }">
              {{ selectedTicket?.subject || 'Sin asunto' }}
            </p>
            <div class="flex flex-wrap gap-3 mt-4 text-sm">
              <span
                class="px-3 py-1 rounded-lg border"
                :style="{
                  background: 'var(--bg-soft)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
              >
                👤 USUARIO: {{ selectedTicket?.requesterName || 'Sin solicitante' }}
              </span>
              <span
                v-if="selectedTicket?.createdAt"
                class="px-3 py-1 rounded-lg border"
                :style="{
                  background: 'var(--bg-soft)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-soft)',
                }"
              >
                🕒 {{ formatDateTime(selectedTicket.createdAt as string) }}
              </span>
              <span
                v-if="selectedTicket?.assignedToName"
                class="px-3 py-1 rounded-lg border"
                :style="{
                  background: 'var(--bg-soft)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-soft)',
                }"
              >
                🎧 AGENTE: {{ selectedTicket.assignedToName }}
              </span>
              <span
                class="px-3 py-1 rounded-lg border"
                :style="{
                  background: 'var(--bg-soft)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-soft)',
                }"
              >
                Estado:
                <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
                  {{ getStatusLabel(selectedTicket?.status) }}
                </span>
              </span>
            </div>
          </div>
          <div class="flex flex-col items-end gap-3 shrink-0">
            <div class="flex items-center gap-3">
              <span class="text-sm" :style="{ color: 'var(--text-soft)' }">Estado</span>
              <select
                class="text-sm rounded-lg px-3 py-2 min-w-[150px] border focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :style="{
                  background: 'var(--bg-soft)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
                :disabled="!selectedTicketId || isUpdatingStatus || !canChangeStatus"
                :value="selectedTicket?.status || ''"
                @change="changeStatus(($event.target as HTMLSelectElement).value)"
              >
                <option value="" disabled>Selecciona...</option>
                <option v-for="opt in STATUS_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <button
              v-if="selectedTicketId"
              type="button"
              class="h-10 px-4 rounded-lg text-sm font-semibold border transition"
              :style="{
                background: 'var(--bg-soft)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-main)',
              }"
              @click="closeChat"
            >
              ⎋ Salir del chat
            </button>
            <p v-if="statusError" class="text-xs text-rose-500 max-w-xs text-right">
              {{ statusError }}
            </p>
          </div>
        </div>
      </div>
      <!-- MENSAJES -->
      <div
        ref="chatContainer"
        class="flex-1 min-h-0 overflow-y-auto px-6 py-4 relative"
        @scroll="checkIfAtBottom"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDropFiles"
      >
        <!-- overlay drag -->
        <div
          v-if="isDragging"
          class="absolute inset-0 z-10 border-2 rounded-lg flex items-center justify-center pointer-events-none"
          :style="{ background: 'rgba(15,23,42,0.08)', borderColor: 'rgba(16,185,129,0.6)' }"
        >
          <div
            class="px-4 py-2 rounded-lg border text-sm"
            :style="{
              background: 'var(--bg-panel)',
              borderColor: 'var(--border-main)',
              color: 'var(--text-main)',
            }"
          >
            Suelta los archivos para adjuntar 📎
          </div>
        </div>
        <div v-if="!selectedTicketId" class="h-full flex items-center justify-center relative z-10">
          <div class="flex flex-col items-center">
            <!-- LOGO FUERA (FLOTANTE) -->
            <img
              src="https://clinicasagradafamilia.net/logos-firmas/Logo_IT-Plateado-Sin-Fondo.png"
              alt="IT plateado"
              class="h-72 w-72 object-contain mb-6 opacity-90"
            />

            <!-- CARD SOLO TEXTO -->
            <div
              class="max-w-md text-center rounded-2xl border px-8 py-6 shadow-sm"
              :style="{
                background: 'var(--bg-panel)',
                borderColor: 'var(--border-main)',
              }"
            >
              <p class="text-sm leading-7" :style="{ color: 'var(--text-muted)' }">
                Selecciona un ticket en la columna izquierda
                <br />
                para ver y responder el chat.
              </p>
            </div>
          </div>
        </div>
        <template v-else>
          <div v-if="typedMessages.length === 0" class="h-full flex items-center justify-center">
            <p class="text-sm italic" :style="{ color: 'var(--text-muted)' }">
              No hay mensajes aún en este ticket. Envía el primero 👋
            </p>
          </div>
          <div
            v-for="msg in typedMessages"
            :key="msg.id"
            class="flex w-full mb-3"
            :class="isMine(msg) ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-xs md:max-w-md px-3 py-2 rounded-2xl shadow border text-sm"
              :style="
                isMine(msg)
                  ? {
                      background: '#10b981',
                      color: '#ffffff',
                      borderColor: '#10b981',
                      borderBottomRightRadius: '0.25rem',
                    }
                  : {
                      background: 'var(--message-other-bg)',
                      color: 'var(--text-main)',
                      borderColor: 'var(--border-main)',
                      borderBottomLeftRadius: '0.25rem',
                    }
              "
            >
              <p class="text-[11px] font-semibold mb-1">
                {{ isMine(msg) ? 'Tú' : msg.sender?.name || 'Usuario' }}
              </p>

              <p v-if="msg.content" class="whitespace-pre-line leading-snug mb-2">
                {{ msg.content }}
              </p>

              <!-- ADJUNTOS DEL MENSAJE -->
              <div v-if="msg.attachments?.length" class="space-y-2 mb-2">
                <template v-for="att in msg.attachments" :key="att.id">
                  <!-- Imagen -->
                  <div v-if="isImage(att)" class="space-y-2">
                    <button
                      type="button"
                      class="block overflow-hidden rounded-lg border"
                      :style="{
                        borderColor: isMine(msg) ? 'rgba(255,255,255,0.25)' : 'var(--border-main)',
                      }"
                      @click="openImagePreview(att)"
                    >
                      <img
                        :src="fileUrl(att)"
                        :alt="att.filename"
                        class="max-h-56 w-full object-cover"
                      />
                    </button>

                    <div class="flex items-center justify-between gap-2 text-[11px]">
                      <span class="truncate">{{ att.filename }}</span>
                      <a
                        :href="fileUrl(att)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="underline"
                        :style="{ color: isMine(msg) ? '#ffffff' : '#10b981' }"
                      >
                        Ver
                      </a>
                    </div>
                  </div>

                  <!-- Archivo normal -->
                  <a
                    v-else
                    :href="fileUrl(att)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-[12px] hover:opacity-90"
                    :style="{
                      background: isMine(msg) ? 'rgba(255,255,255,0.10)' : 'var(--bg-soft)',
                      borderColor: isMine(msg) ? 'rgba(255,255,255,0.20)' : 'var(--border-main)',
                      color: isMine(msg) ? '#ffffff' : 'var(--text-main)',
                    }"
                  >
                    <div class="min-w-0">
                      <p class="truncate font-medium">📎 {{ att.filename }}</p>
                      <p class="text-[10px]" :style="{ opacity: isMine(msg) ? '0.8' : '0.65' }">
                        {{ formatBytes(att.size) }}
                      </p>
                    </div>
                    <span class="shrink-0 text-[11px] underline">Abrir</span>
                  </a>
                </template>
              </div>

              <p class="text-[10px]" :style="{ opacity: isMine(msg) ? '0.9' : '0.75' }">
                {{ formatDateTime(msg.createdAt) }}
              </p>
            </div>
          </div>
        </template>
      </div>
      <!-- FOOTER -->
      <div
        class="shrink-0 border-t"
        :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
      >
        <div
          v-if="selectedTicketId && pendingFiles.length && !isTicketClosed"
          class="px-4 py-2 border-b"
          :style="{ background: 'var(--bg-soft)', borderColor: 'var(--border-main)' }"
        >
          <div class="flex flex-wrap gap-2">
            <div
              v-for="(f, idx) in pendingFiles"
              :key="idx"
              class="flex items-center gap-2 px-2 py-1 rounded-md border"
              :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
            >
              <span class="text-[11px] truncate" :style="{ color: 'var(--text-main)' }">
                📎 {{ f.name }}
              </span>
              <button
                type="button"
                class="text-[11px] text-rose-500 hover:text-rose-600"
                @click="removePendingFile(idx)"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
        <form class="min-h-[64px] px-4 py-3 flex gap-2 items-center" @submit.prevent="handleSend">
          <label
            class="h-10 px-3 rounded-md text-sm font-semibold border cursor-pointer flex items-center justify-center"
            :style="{
              background: 'var(--bg-soft)',
              borderColor: 'var(--border-main)',
              color: 'var(--text-main)',
            }"
            :class="!selectedTicketId || isTicketClosed ? 'opacity-50 cursor-not-allowed' : ''"
          >
            📎
            <input
              type="file"
              class="hidden"
              multiple
              :disabled="!selectedTicketId || isTicketClosed"
              @change="addFiles(($event.target as HTMLInputElement).files)"
            />
          </label>
          <div class="relative flex-1 min-w-0">
            <input
              v-model="newMessage"
              type="text"
              class="w-full rounded-md px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-80 disabled:cursor-not-allowed"
              :style="{
                background: 'var(--input-bg)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-main)',
              }"
              :placeholder="isTicketClosed ? 'Ticket CERRADO' : 'Escribe un mensaje...'"
              :disabled="!selectedTicketId || isTicketClosed"
              @input="onMessageInput"
              @keydown="onMessageKeydown"
              @paste="onPaste"
            />
            <!-- Dropdown quick replies -->
            <div
              v-if="showQuickReplies && filteredQuickReplies.length"
              class="absolute left-0 right-0 bottom-12 z-30 rounded-lg border shadow-xl overflow-hidden"
              :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
            >
              <div
                class="px-3 py-2 text-[11px] border-b"
                :style="{ color: 'var(--text-soft)', borderColor: 'var(--border-main)' }"
              >
                Plantillas (usa ↑ ↓ y Enter)
              </div>
              <button
                v-for="(tpl, i) in filteredQuickReplies"
                :key="tpl.id"
                type="button"
                class="w-full text-left px-3 py-2 text-sm transition"
                :style="
                  i === selectedReplyIndex
                    ? { background: 'rgba(16,185,129,0.10)', color: 'var(--text-main)' }
                    : { background: 'transparent', color: 'var(--text-main)' }
                "
                @mousedown.prevent="applyTemplate(tpl)"
              >
                <div class="font-semibold truncate">{{ tpl.title }}</div>
                <div class="text-[12px] truncate" :style="{ color: 'var(--text-soft)' }">
                  {{ tpl.content }}
                </div>
              </button>
            </div>
          </div>
          <button
            type="submit"
            class="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold text-white disabled:opacity-50 shadow"
            :disabled="!canSend || isTicketClosed"
          >
            Enviar
          </button>
        </form>
      </div>
    </section>
  </div>
  <!-- SETTINGS -->
  <!-- <SettingsModal v-if="openSettings" :open="openSettings" @close="openSettings = false" /> -->
</template>

<style scoped>
/* Scroll bonito opcional */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.35);
  border-radius: 999px;
}
</style>
