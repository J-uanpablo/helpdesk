<!-- src/views/HelpdeskPanel.vue -->
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useTicketChat } from '../composables/useTicketChat';
import { useAuth } from '../composables/useAuth';
import { io, Socket } from 'socket.io-client';

/* ===========================
   0) CONFIG
=========================== */
const API_BASE = 'http://localhost:3000';

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
   2) ROUTER + AUTH
=========================== */
const router = useRouter();
const { token, user, initAuth, logout } = useAuth();

function doLogout() {
  showLogoutModal.value = false;
  logout();
  router.push('/login');
}

function goToClientsAdmin() {
  router.push({ name: 'AdminClients' });
}

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

function playNotification() {
  try {
    notificationAudio.currentTime = 0;
    void notificationAudio.play();
  } catch (e) {
    console.error('No se pudo reproducir el sonido de notificación:', e);
  }
}

const newTicketAudio = new Audio('/sounds/Nuevo_Ticket.mp3');
newTicketAudio.preload = 'auto';

function playNewTicket() {
  try {
    newTicketAudio.currentTime = 0;
    void newTicketAudio.play();
  } catch (e) {
    console.error('No se pudo reproducir Nuevo_Ticket.mp3', e);
  }
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
  const jwt = (token.value ?? '').trim();
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

  s.on('new_ticket', async () => {
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
  { value: 'RESOLVED', label: 'RESUELTO' },
  { value: 'CLOSED', label: 'CERRADO' },
];

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'PENDING', label: 'Abiertos' },
  { value: 'IN_PROGRESS', label: 'En progreso' },
  { value: 'RESOLVED', label: 'Resueltos' },
  { value: 'CLOSED', label: 'Cerrados' },
] as const;

type StatusFilterValue = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

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

  const jwt = (token.value ?? '').trim();
  if (!jwt) {
    supportAreas.value = [];
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/support-areas`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${jwt}` },
    });

    if (res.status === 401) {
      supportAreas.value = [];
      return;
    }

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
    const ta = getTicketActivityTimestamp(a);
    const tb = getTicketActivityTimestamp(b);
    const va = ta ? new Date(ta).getTime() : 0;
    const vb = tb ? new Date(tb).getTime() : 0;
    return vb - va;
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
   17) PENDING FILES + DRAG&DROP + CTRL+V
========================================================== */
const pendingFiles = ref<File[]>([]);
const isUploading = ref(false);
const uploadError = ref<string | null>(null);

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

  const jwt = (token.value ?? '').trim();
  if (!jwt) {
    statusError.value = 'No hay token JWT para autenticar la petición.';
    return;
  }

  isUpdatingStatus.value = true;
  try {
    const res = await fetch(`${API_BASE}/tickets/${selectedTicketId.value}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
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

  const jwt = (token.value ?? '').trim();
  if (!jwt) return;

  try {
    const res = await fetch(`${API_BASE}/tickets/${ticketId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
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

  const jwt = (token.value ?? '').trim();
  if (!jwt) {
    tickets.value = [];
    isLoadingTickets.value = false;
    ticketsError.value = 'No hay token JWT. Inicia sesión nuevamente.';
    return;
  }

  isLoadingTickets.value = true;

  try {
    const res = await fetch(`${API_BASE}/tickets/panel-list`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${jwt}` },
    });

    if (res.status === 401) {
      tickets.value = [];
      ticketsError.value = 'Sesión vencida (401). Vuelve a iniciar sesión.';
      return;
    }

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
  const jwt = (token.value ?? '').trim();
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
    const jwt = (token.value ?? '').trim();
    if (!jwt) return;

    try {
      const res = await fetch(`${API_BASE}/tickets/${ticket.id}/assign-me`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${jwt}` },
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

// function resetPreviewZoom() {
//   previewScale.value = 1;
// }

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

  const jwt = (token.value ?? '').trim();
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

      const res = await fetch(`${API_BASE}/tickets/${selectedTicketId.value}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body: fd,
      });

      if (!res.ok) throw new Error(`Error ${res.status} subiendo archivo`);

      const msg = await res.json();
      const existing = (typedMessages.value as any[]).some(m => m?.id === msg?.id);
      if (!existing) (messages.value as any[]).push(msg);
    }

    pendingFiles.value = [];
    newMessage.value = '';
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

  if (pendingFiles.value.length > 0) {
    void uploadFilesAndSend();
    return;
  }

  if (!isConnected.value) return;

  const text = newMessage.value.trim();
  if (!text) return;

  sendMessage(selectedTicketId.value as number, text);
  newMessage.value = '';

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

  // preload audios
  try {
    notificationAudio.load();
    newTicketAudio.load();
  } catch (_) {}

  // inicial si ya hay token
  if ((token.value ?? '').trim()) {
    connectPanelSocket();
    await loadSupportAreas();
    await loadTickets();
  }

  refreshId = window.setInterval(() => {
    if ((token.value ?? '').trim()) loadTickets();
  }, 3000);

  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  // ✅ si hay chat abierto, guardar borrador antes de salir de la vista
  if (selectedTicketId.value) {
    saveDraft(selectedTicketId.value);
  }

  if (refreshId !== null) clearInterval(refreshId);
  window.removeEventListener('keydown', handleKeydown);

  disconnectPanelSocket();

  try {
    chatApi?.disconnect?.();
  } catch (_) {}
});
</script>

<template>
  <div class="h-screen bg-slate-900 text-slate-100 flex flex-col overflow-hidden">
    <!-- HEADER SUPERIOR -->
    <header class="border-b border-slate-800 bg-slate-900/95">
      <div
        class="max-w-8xl mx-auto px-6 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 class="text-2xl md:text-3xl font-bold">Mesa de ayuda – Chat</h1>
          <p class="text-xs text-slate-400">
            Panel tipo WhatsApp: tickets a la izquierda, chat a la derecha.
          </p>
        </div>

        <div class="flex flex-col items-end gap-1 text-right">
          <p class="text-[11px] text-slate-300">
            Sesión:
            <span class="font-semibold">{{ user?.name || 'Usuario autenticado' }}</span>
          </p>
          <p v-if="user?.email" class="text-[10px] text-slate-500">
            {{ user.email }}
          </p>

          <div class="flex gap-2 mt-1">
            <!-- Botón Admin. clientes (solo super admin) -->
            <button
              v-if="isSuperAdmin"
              class="h-9 px-4 rounded-md bg-amber-500 hover:bg-amber-600 text-xs font-semibold"
              @click="goToClientsAdmin"
            >
              Admin. clientes
            </button>

            <button
              v-if="isSuperAdmin"
              type="button"
              class="h-8 px-3 rounded-md bg-sky-600 hover:bg-sky-700 text-xs font-semibold"
              @click="router.push({ name: 'AdminAgents' })"
            >
              Admin. agentes
            </button>
            <button
              v-if="isSuperAdmin || isAdmin"
              type="button"
              class="h-8 px-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold"
              @click="router.push({ name: 'AdminAreas' })"
            >
              Admin. áreas
            </button>

            <!-- <button
              type="button"
              @click="loadTickets"
              class="h-8 px-3 rounded-md bg-emerald-500 hover:bg-emerald-600 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isLoadingTickets || !token"
            >
              {{ isLoadingTickets ? "Cargando tickets..." : "Cargar tickets" }}
            </button> -->

            <button
              @click="confirmLogout"
              class="px-3 py-1 rounded-md bg-red-500 hover:bg-red-600 text-xs font-semibold text-white"
            >
              Cerrar sesión
            </button>
          </div>

          <p v-if="ticketsError" class="text-[11px] text-rose-400 mt-1">
            {{ ticketsError }}
          </p>
        </div>
      </div>
    </header>

    <!-- CUERPO PRINCIPAL -->
    <main class="flex-1 flex items-stretch px-0 pb-4 min-h-0">
      <div
        class="flex flex-1 w-full border border-slate-800 bg-slate-950/60 rounded-xl overflow-hidden shadow-lg min-h-0"
      >
        <!-- COLUMNA IZQUIERDA -->
        <aside
          class="w-[500px] shrink-0 border-r border-slate-800 bg-slate-950 flex flex-col min-h-0"
        >
          <!-- Header lista -->
          <div class="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-300 uppercase">Tickets</span>
            <span
              class="text-[11px] flex items-center gap-1"
              :class="{
                'text-emerald-400': isConnected,
                'text-yellow-400': isConnecting,
                'text-slate-500': !isConnected && !isConnecting,
              }"
            >
              <span
                class="w-2 h-2 rounded-full"
                :class="{
                  'bg-emerald-400': isConnected,
                  'bg-yellow-400': isConnecting,
                  'bg-slate-500': !isConnected && !isConnecting,
                }"
              />
              {{ isConnecting ? 'Conectando' : isConnected ? 'Conectado' : 'Desconectado' }}
            </span>
          </div>

          <!-- Filtros -->
          <div class="px-3 py-3 border-b border-slate-800 text-[11px] bg-slate-950 space-y-2">
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="f in STATUS_FILTERS"
                :key="f.value"
                type="button"
                class="px-3 py-1 rounded-full border font-semibold transition-colors"
                :class="
                  statusFilter === f.value
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-transparent text-slate-300 border-slate-600 hover:bg-slate-800/60'
                "
                @click="statusFilter = f.value"
              >
                <template v-if="f.value === 'ALL'">Todos ({{ totalTickets }})</template>
                <template v-else-if="f.value === 'PENDING'">Abiertos ({{ openCount }})</template>
                <template v-else-if="f.value === 'IN_PROGRESS'"
                  >En progreso ({{ inProgressCount }})</template
                >
                <template v-else-if="f.value === 'RESOLVED'"
                  >Resueltos ({{ resolvedCount }})</template
                >
                <template v-else-if="f.value === 'CLOSED'">Cerrados ({{ closedCount }})</template>
              </button>
            </div>

            <!-- Filtros extra SOLO para admin -->
            <div v-if="isAdmin" class="flex flex-col gap-2 mt-1">
              <div class="flex flex-wrap gap-2">
                <select
                  v-model="areaFilter"
                  class="flex-1 min-w-[120px] bg-slate-900 border border-slate-700 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ALL">Todas las áreas</option>
                  <option v-for="a in availableAreas" :key="a" :value="a">
                    {{ a }}
                  </option>
                </select>

                <select
                  v-model="agentFilter"
                  class="flex-1 min-w-[130px] bg-slate-900 border border-slate-700 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ALL">Todos los agentes</option>
                  <option value="UNASSIGNED">Sin asignar</option>
                  <option v-for="ag in availableAgents" :key="ag.id" :value="String(ag.id)">
                    {{ ag.name }}
                  </option>
                </select>
              </div>

              <p class="text-[11px] text-slate-400">
                {{ filteredCount }} de {{ totalTickets }} tickets mostrados.
              </p>
            </div>
          </div>

          <!-- Lista de tickets -->
          <div class="flex-1 overflow-y-auto">
            <div
              v-if="!tickets.length && !isLoadingTickets"
              class="h-full flex items-center justify-center px-3 text-center"
            >
              <p class="text-xs text-slate-500">
                No hay tickets cargados.<br />
                Pulsa <span class="font-semibold">“Cargar tickets”</span>.
              </p>
            </div>

            <div
              v-else-if="tickets.length && !filteredTickets.length"
              class="h-full flex items-center justify-center px-3 text-center"
            >
              <p class="text-xs text-slate-500">No hay tickets con los filtros actuales.</p>
            </div>

            <ul v-else class="space-y-2 list-none m-0 p-2">
              <li
                v-for="t in filteredTickets"
                :key="t.id"
                @click="handleSelectTicket(t)"
                :class="[
                  ticketCardClasses(t),
                  'relative rounded-xl px-4 py-3 cursor-pointer transition',
                  'hover:bg-slate-800/60',
                  t.id === selectedTicketId ? 'ring-2 ring-emerald-500/70' : '',
                ]"
              >
                <!-- Barra izquierda sin asignar -->
                <div
                  v-if="isUnassigned(t)"
                  class="absolute left-0 top-0 h-full w-1.5 bg-amber-400 rounded-l-xl"
                />

                <!-- Header -->
                <div class="flex justify-between items-start gap-3">
                  <h3 class="text-base font-semibold truncate">
                    #{{ t.id }} – {{ t.subject || 'Sin asunto' }}
                  </h3>

                  <div class="flex items-center gap-2 shrink-0">
                    <!-- Estado -->
                    <span
                      class="text-xs px-3 py-1 rounded-full font-semibold border"
                      :class="{
                        'border-emerald-500 text-emerald-300 bg-emerald-500/10':
                          t.status === 'PENDING',
                        'border-amber-400 text-amber-300 bg-amber-500/10':
                          t.status === 'IN_PROGRESS',
                        'border-sky-400 text-sky-300 bg-sky-500/10': t.status === 'RESOLVED',
                        'border-slate-500 text-slate-300 bg-slate-500/10':
                          !t.status || t.status === 'CLOSED',
                      }"
                    >
                      {{
                        t.status === 'PENDING'
                          ? 'ABIERTO'
                          : t.status === 'IN_PROGRESS'
                          ? 'EN PROGRESO'
                          : t.status === 'RESOLTO'
                          ? 'RESUELTO'
                          : 'CERRADO'
                      }}
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
                <p class="text-sm text-slate-300 mt-1 truncate">
                  {{ t.requesterName || 'Usuario desconocido' }}
                </p>

                <!-- Cargo / Área -->
                <p v-if="t.clientCargo || t.clientArea" class="text-sm text-slate-400 truncate">
                  {{ t.clientCargo }}
                  <span v-if="t.clientCargo && t.clientArea"> · </span>
                  {{ t.clientArea }}
                </p>

                <!-- Footer -->
                <div class="flex items-center justify-between mt-3 text-sm text-slate-400">
                  <span>
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
                    class="px-2 py-0.5 rounded-full text-xs border border-amber-400 text-amber-300"
                  >
                    SIN ASIGNAR
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </aside>

        <!-- COLUMNA DERECHA: CHAT -->
        <section class="flex-1 flex flex-col bg-slate-900 min-h-0">
          <div class="px-6 py-5 border-b border-slate-800 bg-slate-900/90">
            <div class="flex items-start justify-between gap-6">
              <!-- INFO -->
              <div>
                <h2 class="text-2xl font-semibold leading-tight">
                  <span v-if="selectedTicketId">Ticket #{{ selectedTicketId }}</span>
                  <span v-else>Selecciona un ticket</span>
                </h2>

                <p class="text-base text-slate-400 mt-1">
                  {{ selectedTicket?.subject || 'Sin asunto' }}
                </p>

                <!-- META -->
                <div class="flex flex-wrap gap-3 mt-4 text-sm">
                  <span class="px-3 py-1 rounded-lg bg-slate-800 text-slate-200">
                    👤 USUARIO: {{ selectedTicket?.requesterName || 'Sin solicitante' }}
                  </span>

                  <span
                    v-if="selectedTicket?.createdAt"
                    class="px-3 py-1 rounded-lg bg-slate-800 text-slate-400"
                  >
                    🕒 {{ formatDateTime(selectedTicket.createdAt as string) }}
                  </span>

                  <span
                    v-if="selectedTicket?.assignedToName"
                    class="px-3 py-1 rounded-lg bg-slate-800 text-slate-400"
                  >
                    🎧 AGENTE: {{ selectedTicket.assignedToName }}
                  </span>
                </div>
              </div>

              <!-- ACTIONS -->
              <div class="flex flex-col items-end gap-3">
                <div class="flex items-center gap-3">
                  <span class="text-sm text-slate-400">Estado</span>
                  <select
                    class="text-sm bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 min-w-[150px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  class="h-10 px-4 rounded-lg text-sm font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700"
                  @click="closeChat"
                  title="Salir del chat (ESC)"
                >
                  ⎋ Salir del chat
                </button>

                <p v-if="statusError" class="text-xs text-rose-400 max-w-xs text-right">
                  {{ statusError }}
                </p>
              </div>
            </div>
          </div>

          <!-- Mensajes (con drag&drop) -->
          <div
            ref="chatContainer"
            class="relative flex-1 bg-slate-900 overflow-y-auto px-4 py-3 space-y-3 flex flex-col"
            @scroll="checkIfAtBottom"
            @dragover="onDragOver"
            @dragleave="onDragLeave"
            @drop="onDropFiles"
          >
            <!-- Overlay drag -->
            <div
              v-if="selectedTicketId && isDragging && !isTicketClosed"
              class="absolute inset-0 z-20 bg-slate-950/70 border-2 border-dashed border-emerald-400/70 rounded-none flex items-center justify-center"
            >
              <div class="text-center px-6">
                <p class="text-lg font-semibold text-emerald-200">Suelta los archivos aquí</p>
                <p class="text-xs text-slate-300 mt-1">Se adjuntarán al próximo mensaje</p>
              </div>
            </div>

            <div v-if="!selectedTicketId" class="flex-1 flex items-center justify-center">
              <p class="text-sm text-slate-500 text-center">
                Selecciona un ticket en la columna izquierda<br />
                para ver y responder el chat.
              </p>
            </div>

            <template v-else>
              <div
                v-if="typedMessages.length === 0"
                class="flex-1 flex items-center justify-center"
              >
                <p class="text-sm text-slate-500 italic">
                  No hay mensajes aún en este ticket. Envía el primero 👋
                </p>
              </div>

              <div
                v-for="msg in typedMessages"
                :key="msg.id"
                class="flex w-full"
                :class="isMine(msg) ? 'justify-end' : 'justify-start'"
              >
                <div
                  class="max-w-xs md:max-w-md px-3 py-2 rounded-2xl shadow border text-sm"
                  :class="
                    isMine(msg)
                      ? 'bg-emerald-600 text-white border-white rounded-br-sm'
                      : 'bg-gray-600 text-white border-gray-500 rounded-bl-sm'
                  "
                >
                  <p class="text-[11px] font-semibold text-left mb-1">
                    {{ isMine(msg) ? 'Tú' : msg.sender?.name || 'Usuario' }}
                  </p>

                  <p v-if="msg.content" class="whitespace-pre-line text-left leading-snug mb-2">
                    {{ msg.content }}
                  </p>

                  <!-- ✅ Adjuntos del mensaje -->
                  <div v-if="msg.attachments?.length" class="space-y-2 mb-2">
                    <div
                      v-for="att in msg.attachments"
                      :key="att.id"
                      class="rounded-lg border border-white/20 bg-black/10 p-2"
                    >
                      <!-- Imagen preview -->
                      <template v-if="isImage(att)">
                        <button
                          type="button"
                          class="block"
                          @click="openImagePreview(att)"
                          title="Ver imagen"
                        >
                          <img
                            :src="fileUrl(att)"
                            alt="Adjunto"
                            class="max-h-60 w-auto rounded-md border border-white/20 hover:border-white/60 transition cursor-zoom-in"
                          />
                        </button>

                        <div class="mt-1 text-[10px] text-white/90 flex justify-between gap-2">
                          <span class="truncate">{{ att.filename }}</span>
                          <span class="opacity-80 whitespace-nowrap">
                            {{ formatBytes(att.size) }}
                          </span>
                        </div>
                      </template>

                      <!-- Archivo normal -->
                      <template v-else>
                        <a
                          class="text-[12px] underline text-white/95 hover:text-white"
                          :href="fileUrl(att)"
                          download
                        >
                          📎 {{ att.filename }}
                        </a>
                        <div class="text-[10px] text-white/80 mt-0.5">
                          {{ att.mimeType }} • {{ formatBytes(att.size) }}
                        </div>
                      </template>
                    </div>
                  </div>

                  <p class="text-[10px] text-left text-white opacity-90">
                    {{ formatDateTime(msg.createdAt) }}
                  </p>
                </div>
              </div>
            </template>
          </div>

          <div v-if="isTicketClosed" class="flex justify-center mb-3">
            <div
              class="max-w-md w-full px-5 py-3 rounded-lg border border-yellow-400 bg-yellow-200/10 text-xs text-yellow-100 flex items-start gap-2"
            >
              <span class="text-lg leading-none">🔒</span>
              <div>
                <p class="font-semibold mb-1">Ticket CERRADO</p>
                <p>Este ticket está cerrado. No puedes enviar más mensajes desde este chat.</p>
              </div>
            </div>
          </div>

          <!-- ✅ Archivos listos para enviar -->
          <div
            v-if="selectedTicketId && pendingFiles.length && !isTicketClosed"
            class="px-4 py-2 border-t border-slate-800 bg-slate-950/60"
          >
            <div class="flex items-center justify-between gap-2 mb-2">
              <p class="text-[11px] text-slate-300 font-semibold">
                Adjuntos para enviar ({{ pendingFiles.length }})
              </p>
              <p class="text-[10px] text-slate-500">
                Tip: arrastra al chat o pega con
                <span class="font-semibold">Ctrl+V</span>
              </p>
            </div>

            <div class="flex flex-wrap gap-2">
              <div
                v-for="(f, idx) in pendingFiles"
                :key="idx"
                class="flex items-center gap-2 px-2 py-1 rounded-md border border-slate-700 bg-slate-900/70"
              >
                <span class="text-[11px] text-slate-200 max-w-[240px] truncate">
                  📎 {{ f.name }}
                </span>
                <span class="text-[10px] text-slate-400 whitespace-nowrap">
                  {{ formatBytes(f.size) }}
                </span>
                <button
                  type="button"
                  class="text-[11px] text-rose-300 hover:text-rose-200"
                  @click="removePendingFile(idx)"
                  title="Quitar"
                >
                  ✕
                </button>
              </div>
            </div>

            <p v-if="uploadError" class="text-[11px] text-rose-400 mt-2">
              {{ uploadError }}
            </p>
          </div>

          <!-- Input -->
          <form
            class="border-t border-slate-800 px-4 py-3 flex gap-2 bg-slate-900/90 items-center"
            @submit.prevent="handleSend"
          >
            <!-- 📎 Adjuntar -->
            <label
              class="h-10 px-3 rounded-md bg-slate-800 hover:bg-slate-700 text-sm font-semibold border border-slate-700 cursor-pointer flex items-center justify-center"
              :class="!selectedTicketId || isTicketClosed ? 'opacity-50 cursor-not-allowed' : ''"
              title="Adjuntar archivos"
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

            <input
              v-model="newMessage"
              @paste="onPaste"
              type="text"
              class="flex-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
              :placeholder="
                isTicketClosed
                  ? 'Ticket CERRADO. No puedes enviar mensajes.'
                  : pendingFiles.length
                  ? 'Opcional: escribe un mensaje para acompañar los adjuntos (o pega con Ctrl+V)...'
                  : 'Escribe un mensaje para este ticket... (o pega una captura con Ctrl+V)'
              "
              :disabled="!selectedTicketId || isTicketClosed"
            />

            <button
              type="submit"
              class="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!canSend || isTicketClosed || isUploading"
              :title="pendingFiles.length ? 'Enviar con adjuntos' : 'Enviar mensaje'"
            >
              {{
                isUploading
                  ? 'Enviando...'
                  : isTicketClosed
                  ? 'Ticket CERRADO'
                  : pendingFiles.length
                  ? 'Enviar + adjuntos'
                  : 'Enviar'
              }}
            </button>
          </form>

          <p v-if="lastError" class="text-[11px] text-rose-400 px-4 pb-2 text-right">
            Último error WS: {{ lastError }}
          </p>
        </section>
      </div>

      <!-- 🖼️ MODAL IMAGEN FULLSCREEN + ZOOM + GALERÍA -->
      <div
        v-if="imagePreviewOpen"
        class="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center"
        @click.self="closeImagePreview"
        @wheel.prevent="onPreviewWheel"
      >
        <!-- Cerrar -->
        <button
          class="absolute top-4 right-4 text-white text-3xl font-bold hover:text-red-400"
          @click="closeImagePreview"
          title="Cerrar (ESC)"
          type="button"
        >
          ✕
        </button>

        <!-- Descargar -->
        <button
          @click="downloadImage"
          class="absolute top-4 left-4 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold text-white"
          type="button"
        >
          ⬇ Descargar
        </button>

        <!-- Reset zoom -->
        <!-- <button
          class="absolute top-4 left-[140px] px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white border border-white/20"
          @click="resetPreviewZoom"
          type="button"
          title="Reset zoom"
        >
          🔄 Reset
        </button> -->

        <!-- ⬅ -->
        <button
          v-if="imageGallery.length > 1"
          class="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl border border-white/20"
          @click.stop="prevImage"
          type="button"
          title="Anterior (←)"
        >
          ‹
        </button>

        <!-- ➡ -->
        <button
          v-if="imageGallery.length > 1"
          class="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl border border-white/20"
          @click.stop="nextImage"
          type="button"
          title="Siguiente (→)"
        >
          ›
        </button>

        <!-- Contador -->
        <div
          v-if="imageGallery.length > 1"
          class="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/80 bg-white/10 border border-white/20 rounded-full px-3 py-1"
        >
          {{ imageIndex + 1 }} / {{ imageGallery.length }}
        </div>

        <!-- Imagen -->
        <img
          :src="imagePreviewUrl"
          :alt="imagePreviewName"
          class="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl select-none"
          :style="{ transform: `scale(${previewScale})` }"
          draggable="false"
          @click.stop
        />
      </div>

      <!-- MODAL LOGOUT -->
      <div
        v-if="showLogoutModal"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      >
        <div class="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-sm shadow-xl">
          <h2 class="text-lg font-semibold text-white mb-2">¿Cerrar sesión?</h2>
          <p class="text-sm text-slate-300 mb-4">¿Estás seguro de que deseas cerrar sesión?</p>

          <div class="flex justify-end gap-3">
            <button
              @click="cancelLogout"
              class="px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-sm"
            >
              Cancelar
            </button>
            <button
              @click="doLogout"
              class="px-3 py-1 rounded-md bg-red-500 hover:bg-red-600 text-sm font-semibold"
            >
              Sí, cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
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
