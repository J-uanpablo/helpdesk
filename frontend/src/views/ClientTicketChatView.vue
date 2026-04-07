<!-- src/views/ClientTicketChatView.vue -->
<template>
  <!-- ROOT -->
  <main
    class="h-full min-h-0 flex flex-col overflow-hidden"
    :style="{
      background: 'var(--bg-main)',
      color: 'var(--text-main)',
    }"
  >
    <!-- HEADER -->
    <header
      class="shrink-0 border-b px-6 py-4"
      :style="{
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-main)',
      }"
    >
      <div class="flex flex-col gap-1">
        <h1 class="text-lg font-semibold md:text-xl" :style="{ color: 'var(--text-main)' }">
          Ticket #{{ ticket?.id }} — {{ subjectToShow }}
        </h1>

        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <div class="flex items-center gap-2">
            <span :style="{ color: 'var(--text-soft)' }">Estado:</span>
            <span
              class="inline-flex items-center rounded border px-2 py-0.5 font-semibold"
              :class="
                isTicketClosed
                  ? 'border-slate-400 text-slate-500'
                  : 'border-amber-500 text-amber-600'
              "
            >
              {{ ticketStatusLabel }}
            </span>
          </div>

          <div class="flex items-center gap-2">
            <span :style="{ color: 'var(--text-soft)' }">Atendido por:</span>
            <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
              {{ attendingAgentName || 'Sin asignar' }}
            </span>
          </div>
        </div>
      </div>
    </header>

    <!-- CHAT -->
    <section class="flex min-h-0 flex-1 flex-col">
      <!-- CONTENIDO -->
      <div class="min-h-0 flex-1 overflow-hidden px-6 py-4">
        <!-- Error -->
        <div
          v-if="error"
          class="mb-3 rounded px-4 py-2 text-sm"
          style="
            background: rgba(239, 68, 68, 0.12);
            color: #b91c1c;
            border: 1px solid rgba(239, 68, 68, 0.25);
          "
        >
          {{ error }}
        </div>

        <!-- Ticket cerrado -->
        <div
          v-if="isTicketClosed"
          class="mb-4 rounded-lg border px-5 py-3 text-center"
          style="border-color: rgba(245, 158, 11, 0.45); background: rgba(245, 158, 11, 0.1)"
        >
          <p class="mb-1 text-lg" style="color: #b45309">🔒 <strong>Ticket cerrado</strong></p>
          <p class="text-sm" style="color: #92400e">
            No puedes enviar más mensajes.<br />
            Si necesitas nueva ayuda, crea un nuevo ticket desde tu panel.
          </p>
        </div>

        <!-- SCROLL REAL -->
        <div ref="scrollContainer" class="scroll-area h-full min-h-0 overflow-y-auto pr-2 flex">
          <div class="flex w-full flex-col justify-end">
            <ChatMessages
              :messages="messages"
              :currentUserId="currentUserId"
              :error="error"
              :formatDate="formatDate"
              :isImage="isImage"
              :fileUrl="fileUrl"
              :formatBytes="formatBytes"
              :downloadAttachment="downloadAttachment"
              :openImagePreview="openImagePreview"
            />
            <div class="h-4"></div>
          </div>
        </div>
      </div>

      <!-- COMPOSER -->
      <div
        class="shrink-0 border-t px-6 py-4 backdrop-blur"
        :style="{
          background: 'var(--bg-panel)',
          borderColor: 'var(--border-main)',
        }"
      >
        <ChatComposer
          :authToken="token || ''"
          v-model="newMessage"
          :pendingFiles="pendingFiles"
          :uploadError="uploadError"
          :isTicketClosed="isTicketClosed"
          :isSending="isSending"
          :formatBytes="formatBytes"
          @paste="onPaste"
          @files-selected="addFiles"
          @remove-file="removePendingFile"
          @insert-template="insertTemplate"
          @send="handleSend"
        />
      </div>
    </section>

    <!-- MODAL IMAGEN -->
    <div
      v-if="imagePreviewOpen"
      class="fixed inset-0 z-[999] flex items-center justify-center bg-black/90"
      @click.self="closeImagePreview"
      @wheel.prevent="onPreviewWheel"
    >
      <div class="absolute right-4 top-4 flex gap-2">
        <button
          class="rounded-md px-3 py-1 text-sm font-semibold text-white"
          style="background: #059669"
          @click="downloadImageFromPreview"
          type="button"
        >
          ⬇ Descargar
        </button>

        <button
          class="rounded-md border px-3 py-1 text-sm font-semibold text-white"
          style="background: rgba(15, 23, 42, 0.85); border-color: rgba(255, 255, 255, 0.2)"
          @click="resetPreviewZoom"
          type="button"
        >
          🔄 Reset
        </button>

        <button
          class="rounded-md px-3 py-1 text-sm font-bold text-white"
          style="background: #dc2626"
          @click="closeImagePreview"
          type="button"
        >
          ✕ Cerrar
        </button>
      </div>

      <button
        v-if="imageGallery.length > 1"
        class="absolute left-4 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full border text-2xl text-white"
        style="background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2)"
        @click.stop="prevImage"
        type="button"
      >
        ‹
      </button>

      <button
        v-if="imageGallery.length > 1"
        class="absolute right-4 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full border text-2xl text-white"
        style="background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2)"
        @click.stop="nextImage"
        type="button"
      >
        ›
      </button>

      <div
        v-if="imageGallery.length > 1"
        class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs text-white/80"
        style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2)"
      >
        {{ imageIndex + 1 }} / {{ imageGallery.length }}
      </div>

      <img
        :src="imagePreviewUrl"
        :alt="imagePreviewName"
        class="max-h-[95vh] max-w-[95vw] select-none rounded-lg object-contain shadow-2xl"
        :style="{ transform: `scale(${previewScale})` }"
        draggable="false"
        @click.stop
      />
    </div>

    <!-- MODAL LOGOUT -->
    <div
      v-if="showLogoutModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    >
      <div
        class="w-full max-w-sm rounded-lg border p-6 shadow-xl"
        :style="{
          background: 'var(--bg-panel)',
          borderColor: 'var(--border-main)',
        }"
      >
        <h2 class="mb-2 text-lg font-semibold" :style="{ color: 'var(--text-main)' }">
          ¿Cerrar sesión?
        </h2>
        <p class="mb-4 text-sm" :style="{ color: 'var(--text-soft)' }">
          ¿Estás seguro de que deseas cerrar sesión?
        </p>

        <div class="flex justify-end gap-3">
          <button
            @click="cancelLogout"
            class="rounded-md px-3 py-1 text-sm"
            :style="{
              background: 'var(--bg-soft)',
              border: `1px solid var(--border-main)`,
              color: 'var(--text-main)',
            }"
          >
            Cancelar
          </button>
          <button
            @click="doLogout"
            class="rounded-md px-3 py-1 text-sm font-semibold text-white"
            style="background: #ef4444"
          >
            Sí, cerrar sesión
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL SATISFACCIÓN -->
    <TicketSatisfactionModal
      :open="showSatisfaction"
      :ticketId="ticketId"
      :authToken="token || ''"
      @close="showSatisfaction = false"
      @submitted="onSatisfactionSubmitted"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';

import TicketSatisfactionModal from '../components/tickets/TicketSatisfactionModal.vue';
import ChatMessages from '../components/chat/ChatMessages.vue';
import ChatComposer from '../components/chat/ChatComposer.vue';

import { useClientTicketSocket } from '../composables/useClientTicketSocket';
import { useTicketDraft } from '../composables/useTicketDraft';
import { useTicketAttachments } from '../composables/useTicketAttachments';
import { useImageGalleryPreview } from '../composables/useImageGalleryPreview';
import { useNotificationSound } from '../composables/useNotificationSound';

/* ===========================
   ROUTE / AUTH
=========================== */
const API_BASE = 'http://localhost:3000';
const route = useRoute();
const router = useRouter();
const { token, user, logout, initAuth } = useAuth();
const ticketId = Number(route.params.id);

/* ===========================
   LOGOUT
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
  saveDraft();
  logout();
  await router.push({ name: 'login' });
}
function exitChat() {
  saveDraft();
  router.push('/cliente');
}

/* ===========================
   SOCKET + DATA
=========================== */
const {
  ticket,
  messages,
  error,
  isSending,
  showSatisfaction,
  loadTicket,
  setupSocket,
  sendTextMessage,
  onSatisfactionSubmitted,
} = useClientTicketSocket({ apiBase: API_BASE, ticketId, token, user });

/* ===========================
   UI helpers
=========================== */
const currentUserId = computed(() => user.value?.id ?? 0);
const isTicketClosed = computed(() => ticket.value?.status === 'CLOSED');
const subjectToShow = computed(() => ticket.value?.subject || ticket.value?.title || 'Sin asunto');

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

const attendingAgentName = computed(
  () => ticket.value?.assignedToName || ticket.value?.assignedTo?.name || null
);

function formatDate(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

/* ===========================
   Adjuntos
=========================== */
const {
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
} = useTicketAttachments({ apiBase: API_BASE, ticketId, token, isTicketClosed, messages });

/* ===========================
   Quick Replies
=========================== */
const newMessage = ref('');
function insertTemplate(text: string) {
  newMessage.value = (newMessage.value ? newMessage.value + '\n' : '') + text;
}

/* ===========================
   Draft por ticket
=========================== */
const { loadDraft, saveDraft, clearDraft } = useTicketDraft({
  ticketId,
  messageRef: newMessage,
  filesRef: pendingFiles,
  storagePrefix: 'client_ticket',
});

/* ===========================
   Preview imágenes
=========================== */
const {
  imagePreviewOpen,
  imagePreviewUrl,
  imagePreviewName,
  imageGallery,
  imageIndex,
  previewScale,
  openImagePreview,
  closeImagePreview,
  prevImage,
  nextImage,
  resetPreviewZoom,
  onPreviewWheel,
  downloadImageFromPreview,
} = useImageGalleryPreview({
  messages,
  isImage,
  fileUrl,
  download: async (url, name) => {
    await downloadAttachment({ id: 0, filename: name, path: url, size: 0, createdAt: '' } as any);
  },
});

/* ===========================
   Audio notificación
=========================== */
const { init: initNotificationAudio, play: playNotification } = useNotificationSound(
  '/sounds/Sonido_Notificacion.mp3'
);

/* ===========================
   Scroll siempre abajo
=========================== */
const scrollContainer = ref<HTMLElement | null>(null);
function scrollToBottom() {
  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
    }
  });
}

/* ===========================
   Enviar
=========================== */
async function handleSend() {
  if (isTicketClosed.value || isSending.value) return;

  const text = newMessage.value.trim();

  if (pendingFiles.value.length > 0) {
    await sendWithAttachments(text);
    newMessage.value = '';
    clearDraft();
    scrollToBottom();
    return;
  }

  if (!text) return;

  await sendTextMessage(text);
  newMessage.value = '';
  clearDraft();
  scrollToBottom();
}

/* ===========================
   Teclas globales (ESC + flechas)
=========================== */
function onGlobalKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (imagePreviewOpen.value) {
    if (e.key === 'Escape') closeImagePreview();
    if (e.key === 'ArrowLeft') prevImage();
    if (e.key === 'ArrowRight') nextImage();
    return;
  }

  if (e.key === 'Escape') exitChat();
}

/* ===========================
   INIT
=========================== */
const hasInitializedMessages = ref(false);
const lastMessagesCount = ref(0);

onMounted(async () => {
  initAuth();

  if (!ticketId || Number.isNaN(ticketId)) {
    router.push('/cliente');
    return;
  }

  initNotificationAudio();
  window.addEventListener('keydown', onGlobalKeydown);

  await nextTick();
  await loadTicket();

  setupSocket({
    onHistoryLoaded: () => {
      hasInitializedMessages.value = true;
      lastMessagesCount.value = messages.value.length;
      scrollToBottom();
    },
    onIncomingMessage: (isFromMe: boolean) => {
      if (hasInitializedMessages.value && !isFromMe) playNotification();
      scrollToBottom();
    },
  });

  loadDraft();
  scrollToBottom();
});

onBeforeUnmount(() => {
  saveDraft();
  window.removeEventListener('keydown', onGlobalKeydown);
});

/* ===========================
   WATCHERS
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
/* Scroll del área de mensajes */
.scroll-area::-webkit-scrollbar {
  width: 10px;
}

.scroll-area::-webkit-scrollbar-track {
  background: transparent;
}

.scroll-area::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.45);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.scroll-area::-webkit-scrollbar-thumb:hover {
  background: rgba(71, 85, 105, 0.7);
  border: 2px solid transparent;
  background-clip: content-box;
}
</style>
