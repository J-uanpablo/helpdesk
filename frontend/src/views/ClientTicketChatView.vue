<!-- src/views/ClientTicketChatView.vue -->
<template>
  <main class="h-screen bg-[#050b1a] text-white flex flex-col">
    <!-- HEADER -->
    <header class="flex items-center justify-between px-6 py-4 border-b border-slate-800">
      <div>
        <h1 class="text-xl font-semibold">Ticket #{{ ticket?.id }} — {{ subjectToShow }}</h1>

        <p class="text-sm text-gray-400 flex items-center gap-2">
          <span>Estado:</span>
          <span
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border"
            :class="
              isTicketClosed
                ? 'border-slate-500 text-slate-300'
                : 'border-yellow-400 text-yellow-300'
            "
          >
            {{ ticketStatusLabel }}
          </span>
        </p>

        <p v-if="attendingAgentName" class="text-xs text-slate-300 mt-1">
          Atendido por:
          <span class="font-semibold">{{ attendingAgentName }}</span>
        </p>
        <p v-else class="text-xs text-slate-500 mt-1">Aún no ha sido asignado a un agente.</p>
      </div>

      <div class="flex flex-col items-end gap-1 text-right">
        <p class="text-[11px] text-slate-300">
          Sesión:
          <span class="font-semibold">
            {{ user?.name || 'Usuario autenticado' }}
          </span>
        </p>
        <p v-if="user?.email" class="text-[10px] text-slate-500">
          {{ user.email }}
        </p>

        <div class="flex gap-2 mt-1">
          <button
            @click="exitChat"
            class="text-xs px-3 py-1 border border-slate-600 rounded hover:bg-slate-800"
            title="Salir del chat (ESC)"
          >
            ← Volver a mis tickets
          </button>

          <button
            @click="confirmLogout"
            class="px-3 py-1 rounded-md bg-red-500 hover:bg-red-600 text-xs font-semibold text-white"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>

    <!-- CONTENIDO -->
    <section class="flex-1 flex flex-col px-6 py-4 overflow-hidden">
      <!-- Error -->
      <div v-if="error" class="bg-red-100 text-red-700 px-4 py-2 rounded mb-3 text-sm">
        {{ error }}
      </div>

      <!-- Ticket cerrado -->
      <div
        v-if="isTicketClosed"
        class="mb-4 px-5 py-3 rounded-lg border border-yellow-400 bg-yellow-200/20 text-center"
      >
        <p class="text-lg mb-1">🔒 <strong>Ticket cerrado</strong></p>
        <p class="text-sm text-yellow-200">
          No puedes enviar más mensajes.<br />
          Si necesitas nueva ayuda, crea un nuevo ticket desde tu panel.
        </p>
      </div>

      <!-- MENSAJES -->
      <div ref="chatContainer" class="flex-1 overflow-y-auto space-y-3 pr-2 chat-scroll">
        <div
          v-if="messages.length === 0 && !error"
          class="h-full flex items-center justify-center text-gray-400 text-sm"
        >
          Aún no hay mensajes en este ticket.
        </div>

        <div
          v-for="msg in messages"
          :key="msg.id"
          class="max-w-3xl"
          :class="msg.senderId === currentUserId ? 'ml-auto text-right' : ''"
        >
          <!-- Burbuja -->
          <div
            class="inline-block rounded-lg px-3 py-2 text-sm"
            :class="
              msg.senderId === currentUserId ? 'bg-emerald-600/80' : 'bg-gray-600 border-gray-500'
            "
          >
            <p class="font-semibold text-xs text-gray-100 mb-0.5">
              {{ msg.senderName || (msg.senderId === currentUserId ? 'Tú' : 'Soporte') }}
            </p>

            <p v-if="msg.content" class="whitespace-pre-line">
              {{ msg.content }}
            </p>

            <p class="text-[11px] text-white mt-1">
              {{ formatDate(msg.createdAt) }}
            </p>
          </div>

          <!-- ADJUNTOS -->
          <div
            v-if="msg.attachments?.length"
            class="mt-2 flex"
            :class="msg.senderId === currentUserId ? 'justify-end' : 'justify-start'"
          >
            <div class="space-y-2">
              <div
                v-for="att in msg.attachments"
                :key="att.id"
                class="max-w-xs rounded-lg border border-white/20 bg-black/10 p-2"
              >
                <!-- 🖼️ Imagen -->
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

                  <button
                    type="button"
                    class="mt-2 w-full text-[12px] px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 font-semibold"
                    @click="downloadAttachment(att)"
                    title="Descargar imagen"
                  >
                    ⬇ Descargar
                  </button>
                </template>

                <!-- 📎 Archivo -->
                <template v-else>
                  <button
                    type="button"
                    class="w-full text-left text-[12px] underline text-white/95 hover:text-white"
                    @click="downloadAttachment(att)"
                    title="Descargar archivo"
                  >
                    📎 {{ att.filename }}
                  </button>
                  <div class="text-[10px] text-white/80 mt-0.5">
                    {{ att.mimeType }} • {{ formatBytes(att.size) }}
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 🧷 PREVIEW ARCHIVOS LISTOS PARA ENVIAR -->
      <div
        v-if="pendingFiles.length && !isTicketClosed"
        class="mt-3 px-4 py-3 border border-slate-800 rounded-lg bg-slate-950/40"
      >
        <div class="flex items-center justify-between gap-2 mb-2">
          <p class="text-[12px] text-slate-200 font-semibold">
            Adjuntos para enviar ({{ pendingFiles.length }})
          </p>
          <p class="text-[11px] text-slate-400">
            Puedes pegar con <span class="font-semibold">Ctrl+V</span>
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <div
            v-for="(f, idx) in pendingFiles"
            :key="idx"
            class="flex items-center gap-2 px-2 py-1 rounded-md border border-slate-700 bg-slate-900/60"
          >
            <span class="text-[11px] text-slate-100 max-w-[240px] truncate"> 📎 {{ f.name }} </span>
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

        <p v-if="uploadError" class="text-[11px] text-rose-300 mt-2">
          {{ uploadError }}
        </p>
      </div>

      <!-- MODAL IMAGEN FULLSCREEN + ZOOM + GALERÍA -->
      <div
        v-if="imagePreviewOpen"
        class="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center"
        @click.self="closeImagePreview"
        @wheel.prevent="onPreviewWheel"
      >
        <!-- Botones superiores -->
        <div class="absolute top-4 right-4 flex gap-2">
          <button
            class="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold text-white"
            @click="downloadImageFromPreview"
            type="button"
            title="Descargar"
          >
            ⬇ Descargar
          </button>

          <button
            class="px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white border border-white/20"
            @click="resetPreviewZoom"
            type="button"
            title="Reset zoom"
          >
            🔄 Reset
          </button>

          <button
            class="px-3 py-1 rounded-md bg-red-600 hover:bg-red-700 text-sm font-bold text-white"
            @click="closeImagePreview"
            type="button"
            title="Cerrar (ESC)"
          >
            ✕ Cerrar
          </button>
        </div>

        <!-- Flechas -->
        <button
          v-if="imageGallery.length > 1"
          class="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl border border-white/20"
          @click.stop="prevImage"
          type="button"
          title="Anterior (←)"
        >
          ‹
        </button>

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

      <!-- INPUT -->
      <form
        class="mt-4 border-t border-slate-800 pt-4 flex items-center gap-3"
        @submit.prevent="handleSend"
      >
        <!-- Adjuntar (opcional) -->
        <label
          class="h-10 px-3 rounded-md bg-slate-800 hover:bg-slate-700 text-sm font-semibold border border-slate-700 cursor-pointer flex items-center justify-center"
          :class="isTicketClosed ? 'opacity-50 cursor-not-allowed' : ''"
          title="Adjuntar archivos"
        >
          📎
          <input
            type="file"
            class="hidden"
            multiple
            :disabled="isTicketClosed"
            @change="addFiles(($event.target as HTMLInputElement).files)"
          />
        </label>

        <input
          v-model="newMessage"
          @paste="onPaste"
          type="text"
          class="flex-1 px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
          :placeholder="
            isTicketClosed
              ? 'Ticket cerrado. No puedes enviar mensajes.'
              : pendingFiles.length
              ? 'Opcional: escribe un mensaje para acompañar adjuntos... (o pega Ctrl+V)'
              : 'Escribe tu mensaje... (o pega una captura con Ctrl+V)'
          "
          :disabled="isSending || isTicketClosed"
        />

        <button
          type="submit"
          class="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="
            isSending || isTicketClosed || (!newMessage.trim() && pendingFiles.length === 0)
          "
        >
          {{
            isTicketClosed
              ? 'Ticket cerrado'
              : isSending
              ? 'Enviando...'
              : pendingFiles.length
              ? 'Enviar + adjuntos'
              : 'Enviar'
          }}
        </button>
      </form>
    </section>
    <!-- 🔴 Modal de confirmación para cerrar sesión -->
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
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../composables/useAuth';

/* ===========================
   TIPOS
=========================== */
interface Ticket {
  id: number;
  title?: string | null;
  subject?: string | null;
  status: string;
  area?: string | null;
  assignedToName?: string | null;
  assignedTo?: { name: string | null } | null;
}

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
  senderId: number;
  senderName?: string | null;
  ticketId: number;
  attachments?: TicketAttachment[];
}

/* ===========================
   ROUTE / AUTH
=========================== */
const API_BASE = 'http://localhost:3000';

const route = useRoute();
const router = useRouter();
const { token, user, logout } = useAuth();

const ticketId = Number(route.params.id);

const ticket = ref<Ticket | null>(null);
const messages = ref<TicketMessage[]>([]);
const newMessage = ref('');
const isSending = ref(false);
const error = ref<string | null>(null);

const chatContainer = ref<HTMLElement | null>(null);
const socket = ref<Socket | null>(null);

const currentUserId = computed(() => user.value?.id ?? 0);
const isTicketClosed = computed(() => ticket.value?.status === 'CLOSED');

/* ===========================
   CTRL+V (PEGAR CAPTURA) + ADJUNTOS
=========================== */
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

/* ===========================
   BORRADOR POR TICKET
   - Texto: persistente (localStorage)
   - Adjuntos: en memoria (solo si NO recargas)
=========================== */
const draftMemory = (globalThis as any).__ticketDraftMemory ?? new Map<number, File[]>();
(globalThis as any).__ticketDraftMemory = draftMemory;

const DRAFT_TEXT_KEY = computed(() => `ticket_draft_text_${ticketId}`);

function loadDraft() {
  // Texto (persistente)
  const savedText = localStorage.getItem(DRAFT_TEXT_KEY.value);
  if (savedText != null && !newMessage.value.trim()) {
    newMessage.value = savedText;
  }

  // Adjuntos (solo memoria)
  const memFiles = draftMemory.get(ticketId);
  if (memFiles?.length) {
    pendingFiles.value = [...memFiles];
  }
}

function saveDraft() {
  // Texto
  localStorage.setItem(DRAFT_TEXT_KEY.value, newMessage.value ?? '');
  // Adjuntos en memoria
  draftMemory.set(ticketId, [...pendingFiles.value]);
}

function clearDraft() {
  localStorage.removeItem(DRAFT_TEXT_KEY.value);
  draftMemory.delete(ticketId);
}

/* ===========================
   COMPUTED
=========================== */
const ticketStatusLabel = computed(() => {
  switch (ticket.value?.status) {
    case 'PENDING':
      return 'ABIERTO';
    case 'IN_PROGRESS':
      return 'EN PROGRESO';
    case 'RESOLVED':
      return 'RESUELTO';
    case 'CLOSED':
      return 'CERRADO';
    default:
      return 'PENDIENTE';
  }
});

const attendingAgentName = computed(() => {
  if (!ticket.value) return null;
  return ticket.value.assignedToName || ticket.value.assignedTo?.name || null;
});

const subjectToShow = computed(() => ticket.value?.subject || ticket.value?.title || 'Sin asunto');

function formatDate(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

/* ===========================
   UTILS ARCHIVOS
=========================== */
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

/* ===========================
   DESCARGA FORZADA (IMG/ARCHIVO)
=========================== */
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

/* ===========================
   PREVIEW IMÁGENES + ZOOM + GALERÍA
=========================== */
const imagePreviewOpen = ref(false);
const imagePreviewUrl = ref('');
const imagePreviewName = ref('');

type GalleryItem = { id: number; url: string; name: string };

const imageGallery = ref<GalleryItem[]>([]);
const imageIndex = ref(0);
const previewScale = ref(1);

function buildImageGalleryFromMessages(): GalleryItem[] {
  const items: GalleryItem[] = [];
  const seen = new Set<number>();

  for (const msg of messages.value) {
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
  imageGallery.value = buildImageGalleryFromMessages();
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
  previewScale.value = 1;
  setPreviewByIndex((imageIndex.value - 1 + imageGallery.value.length) % imageGallery.value.length);
}

function nextImage() {
  if (imageGallery.value.length <= 1) return;
  previewScale.value = 1;
  setPreviewByIndex((imageIndex.value + 1) % imageGallery.value.length);
}

function resetPreviewZoom() {
  previewScale.value = 1;
}

function onPreviewWheel(e: WheelEvent) {
  if (!imagePreviewOpen.value) return;
  e.preventDefault();
  const step = e.deltaY > 0 ? -0.1 : 0.1;
  const next = Math.min(5, Math.max(0.5, Number((previewScale.value + step).toFixed(2))));
  previewScale.value = next;
}

async function downloadImageFromPreview() {
  if (!imagePreviewUrl.value) return;
  await forceDownload(imagePreviewUrl.value, imagePreviewName.value || 'imagen');
}

/* ===========================
   SCROLL
=========================== */
function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
}

/* ===========================
   🔊 NOTIFICACIÓN INSTANTÁNEA (PRELOAD)
=========================== */
const notifAudio = ref<HTMLAudioElement | null>(null);

function initNotificationAudio() {
  try {
    const a = new Audio('/sounds/Sonido_Notificacion.mp3');
    a.preload = 'auto';
    a.volume = 1;
    a.load();
    notifAudio.value = a;
  } catch (e) {
    console.error('No se pudo inicializar audio:', e);
  }
}

function playNotification() {
  const a = notifAudio.value;
  if (!a) return;

  try {
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {}
}

const hasInitializedMessages = ref(false);
const lastMessagesCount = ref(0);

/* ===========================
   SOCKET / DATA
=========================== */
function setupSocket() {
  const jwt = (token.value ?? '').trim();
  if (!jwt) return;

  const s = io(API_BASE, {
    transports: ['websocket'],
    auth: { token: jwt, ticketId },
  });

  socket.value = s;

  s.on('ticket_history', (h: TicketMessage[]) => {
    messages.value = h;
    hasInitializedMessages.value = true;
    lastMessagesCount.value = h.length;
    scrollToBottom();
  });

  s.on('ticket_message', (msg: TicketMessage) => {
    const isFromMe = msg.senderId === currentUserId.value;

    if (hasInitializedMessages.value && !isFromMe) {
      playNotification();
    }

    messages.value.push(msg);
    scrollToBottom();
  });

  s.on('connect_error', err => {
    console.error('WS error:', err);
  });
}

async function loadTicket() {
  const jwt = (token.value ?? '').trim();
  if (!jwt) {
    error.value = 'No hay sesión. Inicia sesión nuevamente.';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) throw new Error(`Error ${res.status} cargando ticket`);
    ticket.value = await res.json();
  } catch (e: any) {
    console.error(e);
    error.value = e.message || 'No se pudo cargar el ticket.';
  }
}

/* ===========================
   ENVIAR MENSAJE (texto + adjuntos)
   POST /tickets/:id/messages (form-data: content?, file?)
=========================== */
async function sendWithAttachments() {
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

      const content = i === 0 ? newMessage.value.trim() : '';
      if (content) fd.append('content', content);

      fd.append('file', f);

      const res = await fetch(`${API_BASE}/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body: fd,
      });

      if (!res.ok) throw new Error(`Error ${res.status} subiendo adjunto`);

      const msg = await res.json();
      const exists = messages.value.some(m => m.id === msg.id);
      if (!exists) messages.value.push(msg);
    }

    pendingFiles.value = [];
    newMessage.value = '';
    clearDraft(); // ✅ ya se envió, borrar borrador
    scrollToBottom();
  } catch (e: any) {
    console.error(e);
    uploadError.value = e.message || 'No se pudieron subir los adjuntos.';
  }
}

async function handleSend() {
  if (isTicketClosed.value) return;

  const text = newMessage.value.trim();

  // con adjuntos: REST
  if (pendingFiles.value.length > 0) {
    await sendWithAttachments();
    return;
  }

  // solo texto: WS
  if (!text) return;

  socket.value?.emit('send_message', { ticketId, content: text });
  newMessage.value = '';
  clearDraft(); // ✅ ya se envió, borrar borrador
}

/* ===========================
   LOGOUT (MODAL)
=========================== */
const showLogoutModal = ref(false);

function confirmLogout() {
  showLogoutModal.value = true;
}

function cancelLogout() {
  showLogoutModal.value = false;
}

async function doLogout() {
  showLogoutModal.value = false;
  // (opcional) guardar borrador antes de salir
  saveDraft();
  logout();
  await router.push({ name: 'login' });
}

/* ===========================
   SALIR DEL CHAT (SIN CONFIRMAR, GUARDA BORRADOR)
   - ESC vuelve a /cliente
   - Mantiene borrador
=========================== */
function exitChat() {
  saveDraft();
  router.push('/cliente');
}

/* ===========================
   TECLAS GLOBALES (ESC + flechas)
=========================== */
function onGlobalKeydown(e: KeyboardEvent) {
  // ⛔ evitar interferir con inputs
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  // 🖼️ Si hay preview de imagen → controlar preview
  if (imagePreviewOpen.value) {
    if (e.key === 'Escape') closeImagePreview();
    if (e.key === 'ArrowLeft') prevImage();
    if (e.key === 'ArrowRight') nextImage();
    return;
  }

  // 🚪 ESC sin preview → salir del chat guardando borrador
  if (e.key === 'Escape') {
    exitChat();
  }
}

/* ===========================
   INIT
=========================== */
onMounted(() => {
  if (!ticketId || Number.isNaN(ticketId)) {
    router.push('/cliente');
    return;
  }

  initNotificationAudio();
  window.addEventListener('keydown', onGlobalKeydown);

  loadTicket();
  setupSocket();

  // ✅ cargar borrador
  loadDraft();
});

onBeforeUnmount(() => {
  // ✅ guardar borrador al salir de la vista
  saveDraft();

  window.removeEventListener('keydown', onGlobalKeydown);
  socket.value?.disconnect();
});

/* ===========================
   WATCH: scroll (sin sonido)
=========================== */
watch(
  () => messages.value.length,
  len => {
    if (!hasInitializedMessages.value) {
      hasInitializedMessages.value = true;
      lastMessagesCount.value = len;
      scrollToBottom();
      return;
    }

    if (len !== lastMessagesCount.value) {
      lastMessagesCount.value = len;
      scrollToBottom();
    }
  }
);

// ✅ Guardar borrador mientras escribe / adjunta
watch(
  () => newMessage.value,
  () => saveDraft()
);

watch(
  () => pendingFiles.value.length,
  () => saveDraft()
);
</script>

<style scoped>
.chat-scroll::-webkit-scrollbar {
  width: 6px;
}
.chat-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.7);
}
</style>
