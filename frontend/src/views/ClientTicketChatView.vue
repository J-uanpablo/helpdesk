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

      <router-link
        to="/cliente"
        class="text-sm px-3 py-1 border border-slate-600 rounded hover:bg-slate-800"
      >
        ← Volver a mis tickets
      </router-link>
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
const { token, user } = useAuth();

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
  return ticket.value.status === "CLOSED" ? "CERRADO" : ticket.value.status;
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
    const audio = new Audio("/sounds/Sonido_Notificacion.MP3");
    audio.play();
  } catch (e) {
    console.error("No se pudo reproducir el sonido de notificación:", e);
  }
}

// Watch sobre la cantidad de mensajes
watch(
  () => messages.value.length,
  async (newLen) => {
    // Inicialización: primera carga de historial
    if (!hasInitializedMessages.value) {
      hasInitializedMessages.value = true;
      lastMessagesCount.value = newLen;
      await scrollToBottom(true); // siempre bajamos al fondo al inicio
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

    // si el mensaje no es mío → sonido
    if (!isFromMe) {
      playNotification();
    }

    // SIEMPRE bajar al fondo cuando hay mensaje nuevo
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
    // El scroll lo manejará el watch (primera vez)
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

  // historial que envía el gateway al conectar
  s.on("ticket_history", (history: TicketMessage[]) => {
    messages.value = history;
    // el scroll lo maneja el watch de mensajes
  });

  // mensajes nuevos
  s.on("ticket_message", (msg: TicketMessage) => {
    messages.value.push(msg);
    // el scroll + sonido lo maneja el watch
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

  // Por si algo falla con el WS, también cargamos historial por REST
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
    // Intentar por socket primero
    if (socket.value && socket.value.connected) {
      socket.value.emit("send_message", { ticketId, content });
    } else {
      // Fallback REST
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
      // el watch se encarga de scroll y (si aplica) sonido
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
