<!-- src/views/ClientTicketChatView.vue -->
<template>
  <main class="h-screen bg-[#050b1a] text-white flex flex-col">
    <header
      class="flex items-center justify-between px-6 py-4 border-b border-slate-800"
    >
      <div>
        <h1 class="text-xl font-semibold">
          Ticket #{{ ticket?.id }} — {{ subjectToShow }}
        </h1>
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
      </div>

      <div class="flex flex-col items-end gap-1 text-right">
        <p class="text-[11px] text-slate-300">
          Sesión:
          <span class="font-semibold">
            {{ user?.name || "Usuario autenticado" }}
          </span>
        </p>
        <p v-if="user?.email" class="text-[10px] text-slate-500">
          {{ user.email }}
        </p>

        <div class="flex gap-2 mt-1">
          <router-link
            to="/cliente"
            class="text-xs px-3 py-1 border border-slate-600 rounded hover:bg-slate-800"
          >
            ← Volver a mis tickets
          </router-link>

          <button
            @click="confirmLogout"
            class="px-3 py-1 rounded-md bg-red-500 hover:bg-red-600 text-xs font-semibold text-white"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>

    <!-- Contenido principal: mensajes -->
    <section class="flex-1 flex flex-col px-6 py-4 overflow-hidden">
      <!-- Error -->
      <div
        v-if="error"
        class="bg-red-100 text-red-700 px-4 py-2 rounded mb-3 text-sm"
      >
        {{ error }}
      </div>

      <!-- Mensajes -->
      <div
        ref="chatContainer"
        class="flex-1 overflow-y-auto space-y-3 pr-2 chat-scroll"
      >
        <div
          v-if="messages.length === 0 && !error"
          class="h-full flex items-center justify-center text-gray-400 text-sm"
        >
          Aún no hay mensajes en este ticket. ¡Escribe el primero! 💬
        </div>

        <div
          v-for="msg in messages"
          :key="msg.id"
          class="max-w-3xl"
          :class="msg.senderId === currentUserId ? 'ml-auto text-right' : ''"
        >
          <div
            class="inline-block rounded-lg px-3 py-2 text-sm"
            :class="
              msg.senderId === currentUserId
                ? 'bg-emerald-600/80'
                : 'bg-gray-600 border-gray-500'
            "
          >
            <p class="font-semibold text-xs text-gray-100 mb-0.5">
              {{
                msg.senderName ||
                (msg.senderId === currentUserId ? "Tú" : "Soporte")
              }}
            </p>
            <p class="text-sm">
              {{ msg.content }}
            </p>
            <p class="text-[11px] text-white mt-1">
              {{ formatDate(msg.createdAt) }}
            </p>
          </div>
        </div>
      </div>
      <!-- Aviso de ticket cerrado (muy visible) -->
      <div
        v-if="isTicketClosed"
        class="mb-4 px-5 py-3 rounded-lg border border-yellow-400 bg-yellow-200/20 text-center"
      >
        <p class="text-lg mb-1">
          🔒
          <strong>Ticket cerrado</strong>
        </p>
        <p class="text-sm text-yellow-200">
          No puedes enviar más mensajes.<br />
          Si necesitas nueva ayuda, crea un nuevo ticket desde tu panel de
          cliente.
        </p>
      </div>
      <!-- Caja de envío -->
      <form
        class="mt-4 border-t border-slate-800 pt-4 flex items-center gap-3"
        @submit.prevent="handleSend"
      >
        <input
          v-model="newMessage"
          type="text"
          class="flex-1 px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
          :placeholder="
            isTicketClosed
              ? 'Ticket cerrado. No puedes enviar mensajes.'
              : 'Escribe tu mensaje...'
          "
          :disabled="isSending || isTicketClosed"
        />
        <button
          type="submit"
          class="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isSending || !newMessage.trim() || isTicketClosed"
        >
          {{
            isTicketClosed
              ? "Ticket cerrado"
              : isSending
              ? "Enviando..."
              : "Enviar"
          }}
        </button>
      </form>
    </section>
    <!-- 🔴 Modal de confirmación para cerrar sesión -->
    <div
      v-if="showLogoutModal"
      class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
    >
      <div
        class="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-sm shadow-xl"
      >
        <h2 class="text-lg font-semibold text-white mb-2">¿Cerrar sesión?</h2>
        <p class="text-sm text-slate-300 mb-4">
          ¿Estás seguro de que deseas cerrar sesión?
        </p>

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
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  nextTick,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../composables/useAuth";

interface Ticket {
  id: number;
  title?: string | null;
  subject?: string | null;
  status: string;
}

interface TicketMessage {
  id: number;
  content: string;
  createdAt: string;
  senderId: number;
  senderName?: string | null;
  ticketId: number;
}

const route = useRoute();
const router = useRouter();
const { token, user, logout } = useAuth();

const ticketId = Number(route.params.id);

const ticket = ref<Ticket | null>(null);
const messages = ref<TicketMessage[]>([]);
const newMessage = ref("");
const isSending = ref(false);
const error = ref<string | null>(null);

// contenedor del chat para scroll
const chatContainer = ref<HTMLElement | null>(null);

// WebSocket
const socket = ref<Socket | null>(null);

const currentUserId = computed(() => user.value?.id ?? 0);

// ticket cerrado?
const isTicketClosed = computed(() => ticket.value?.status === "CLOSED");

// Estado visible para el usuario (CERRADO en vez de CLOSED)
const ticketStatusLabel = computed(() => {
  if (!ticket.value?.status) return "PENDIENTE";
  switch (ticket.value.status) {
    case "PENDING":
      return "ABIERTO";
    case "IN_PROGRESS":
      return "EN PROGRESO";
    case "RESOLVED":
      return "RESUELTO";
    case "CLOSED":
      return "CERRADO";
    default:
      return ticket.value.status;
  }
});

// Mostrar asunto correctamente: subject (cuando venga) o title o "Sin asunto"
const subjectToShow = computed(
  () => ticket.value?.subject || ticket.value?.title || "Sin asunto"
);

function formatDate(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/* =============================
   LOGOUT
============================= */
function handleLogout() {
  logout();
  router.push("/login");
}
const showLogoutModal = ref(false);

function confirmLogout() {
  showLogoutModal.value = true;
}

function cancelLogout() {
  showLogoutModal.value = false;
}

function doLogout() {
  logout();
  router.push("/login");
}

/* =============================
   SCROLL SIEMPRE ABAJO EN MENSAJE NUEVO
============================= */
function scrollToBottom(force = false) {
  nextTick(() => {
    const container = chatContainer.value;
    if (!container) return;

    container.scrollTop = container.scrollHeight;
  });
}

/* =============================
   SONIDO DE NOTIFICACIÓN
============================= */
const lastMessagesCount = ref(0);
const hasInitializedMessages = ref(false);

function playNotification() {
  try {
    const audio = new Audio("/sounds/Sonido_Notificacion.mp3");
    audio.play();
  } catch (e) {
    console.error("No se pudo reproducir el sonido de notificación:", e);
  }
}

// Watch sobre la cantidad de mensajes
watch(
  () => messages.value.length,
  async (newLen) => {
    if (!hasInitializedMessages.value) {
      hasInitializedMessages.value = true;
      lastMessagesCount.value = newLen;
      await scrollToBottom(true);
      return;
    }

    if (newLen <= lastMessagesCount.value) {
      lastMessagesCount.value = newLen;
      return;
    }

    const lastMsg = messages.value[messages.value.length - 1];
    lastMessagesCount.value = newLen;

    if (!lastMsg) return;

    const isFromMe = lastMsg.senderId === currentUserId.value;

    if (!isFromMe) {
      playNotification();
    }

    await scrollToBottom(true);
  }
);

/* =============================
   Cargar ticket por REST
============================= */
async function loadTicket() {
  error.value = null;
  const jwt = (token.value ?? "").trim();
  if (!jwt) {
    error.value = "No hay sesión. Inicia sesión nuevamente.";
    return;
  }

  try {
    const res = await fetch(`http://localhost:3000/tickets/${ticketId}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        error.value = "El ticket no existe.";
        return;
      }
      throw new Error(`Error ${res.status} al cargar el ticket`);
    }

    const data = await res.json();
    ticket.value = data;
  } catch (e: any) {
    console.error(e);
    error.value = e.message ?? "No se pudo cargar el ticket.";
  }
}

/* =============================
   Fallback: cargar historial por REST
============================= */
async function loadHistoryFallback() {
  const jwt = (token.value ?? "").trim();
  if (!jwt) return;

  try {
    const res = await fetch(
      `http://localhost:3000/tickets/${ticketId}/messages`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      }
    );

    if (!res.ok) return;

    const data = await res.json();
    messages.value = data;
  } catch (e) {
    console.error("Error al cargar historial REST:", e);
  }
}

/* =============================
   WebSocket
============================= */
function setupSocket() {
  const jwt = (token.value ?? "").trim();
  if (!jwt || !ticketId) {
    console.warn("No hay token o ticketId para socket");
    return;
  }

  const s = io("http://localhost:3000", {
    transports: ["websocket"],
    auth: {
      token: jwt,
      ticketId,
    },
  });

  socket.value = s;

  s.on("connect", () => {
    console.log("🟢 WS conectado ticket cliente", ticketId);
  });

  s.on("ticket_history", (history: TicketMessage[]) => {
    messages.value = history;
  });

  s.on("ticket_message", (msg: TicketMessage) => {
    messages.value.push(msg);
  });

  s.on("disconnect", () => {
    console.log("🔴 WS desconectado ticket cliente");
  });

  s.on("connect_error", (err) => {
    console.error("⚠️ Error conexión WS:", err);
  });
}

onMounted(() => {
  if (!ticketId || Number.isNaN(ticketId)) {
    router.push("/cliente");
    return;
  }

  loadTicket();
  setupSocket();
  loadHistoryFallback();
});

onBeforeUnmount(() => {
  if (socket.value) {
    socket.value.disconnect();
  }
});

/* =============================
   Enviar mensaje
============================= */
async function handleSend() {
  const content = newMessage.value.trim();
  if (!content || isTicketClosed.value) return;

  const jwt = (token.value ?? "").trim();
  if (!jwt) {
    error.value = "No hay sesión. Inicia sesión nuevamente.";
    return;
  }

  isSending.value = true;
  error.value = null;

  try {
    if (socket.value && socket.value.connected) {
      socket.value.emit("send_message", { ticketId, content });
    } else {
      const res = await fetch(
        `http://localhost:3000/tickets/${ticketId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ content }),
        }
      );

      if (!res.ok) {
        throw new Error(`Error ${res.status} al enviar el mensaje`);
      }

      const msg = await res.json();
      messages.value.push(msg);
    }

    newMessage.value = "";
  } catch (e: any) {
    console.error(e);
    error.value = e.message ?? "No se pudo enviar el mensaje.";
  } finally {
    isSending.value = false;
  }
}
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
