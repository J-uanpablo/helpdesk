<!-- src/views/HelpdeskPanel.vue -->
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useTicketChat } from "../composables/useTicketChat";
import { useAuth } from "../composables/useAuth";

/* ===========================
   1) ESTADO PARA CAMBIAR ESTADO DEL TICKET
=========================== */
const isUpdatingStatus = ref(false);
const statusError = ref<string | null>(null);

// Estados que existen en tu enum TicketStatus (schema.prisma)
const STATUS_OPTIONS = [
  { value: "PENDING", label: "Abierto" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "RESOLVED", label: "Resuelto" },
  { value: "CLOSED", label: "Cerrado" },
];

/* ===========================
   2) AUTENTICACIÓN (useAuth)
=========================== */
const { token, user, initAuth } = useAuth();

/* id del usuario logueado (soporta user como ref o como objeto simple) */
const myId = computed<number | null>(() => {
  const u: any = user;
  if (!u) return null;
  if (typeof u.id === "number") return u.id;
  if (u.value && typeof u.value.id === "number") return u.value.id;
  return null;
});

/* ===========================
   3) TIPOS
=========================== */
interface TicketMessage {
  id: number;
  content: string;
  createdAt: string;
  senderId?: number;
  sender?: {
    id: number;
    name: string;
  };
}

interface TicketSummary {
  id: number;
  subject?: string;
  status?: string;
  createdAt?: string;
  requesterName?: string;
  area?: string;
}

/* ===========================
   4) ESTADO GENERAL DEL PANEL
=========================== */
const tickets = ref<TicketSummary[]>([]);
const isLoadingTickets = ref(false);
const ticketsError = ref<string | null>(null);

const selectedTicketId = ref<number | null>(null);
const selectedTicket = computed(
  () => tickets.value.find((t) => t.id === selectedTicketId.value) || null
);

/* ticket cerrado? */
const isTicketClosed = computed(
  () => selectedTicket.value?.status === "CLOSED"
);

/* ===========================
   5) CHAT (useTicketChat)
=========================== */
const { messages, isConnected, isConnecting, lastError, connect, sendMessage } =
  useTicketChat();

const typedMessages = computed<TicketMessage[]>(() => messages.value);
const newMessage = ref("");

const canSend = computed(
  () =>
    isConnected.value &&
    !!selectedTicketId.value &&
    newMessage.value.trim().length > 0 &&
    !isTicketClosed.value
);

/* función helper: saber si un mensaje es mío (agente/admin actual) */
function isMine(msg: TicketMessage): boolean {
  const uid = myId.value;
  if (!uid) return false;
  if (msg.senderId === uid) return true;
  if (msg.sender && msg.sender.id === uid) return true;
  return false;
}

/* formatear fecha sin segundos */
function formatDateTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString("es-CO", {
    dateStyle: "short", // 4/12/25
    timeStyle: "short", // 2:21 p. m.
  });
}

/* ===========================
   5.1) SONIDO DE NOTIFICACIÓN EN MENSAJE NUEVO
=========================== */
const lastMessagesCount = ref(0);
const hasInitializedMessages = ref(false);

function playNotification() {
  try {
    // usa la ruta que ya tienes en public; ajusta si es necesario
    const audio = new Audio("/sounds/Sonido_Notificacion.mp3");
    audio.play();
  } catch (e) {
    console.error("No se pudo reproducir el sonido de notificación:", e);
  }
}

/* ===========================
   5.2) SCROLL TIPO WHATSAPP
=========================== */
const chatContainer = ref<HTMLDivElement | null>(null);
const isAtBottom = ref(true);

function checkIfAtBottom() {
  const el = chatContainer.value;
  if (!el) return;
  const threshold = 80; // px de tolerancia
  const diff = el.scrollHeight - (el.scrollTop + el.clientHeight);
  isAtBottom.value = diff <= threshold;
}

function scrollToBottom() {
  const el = chatContainer.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

/* Watch sobre cantidad de mensajes:
   - controla sonido
   - y scroll auto solo si estabas abajo */
watch(
  () => typedMessages.value.length,
  async (newLen) => {
    // ---- SCROLL ----
    if (isAtBottom.value) {
      await nextTick();
      scrollToBottom();
    }

    // ---- SONIDO ----
    // primera vez: inicializar y no sonar
    if (!hasInitializedMessages.value) {
      lastMessagesCount.value = newLen;
      hasInitializedMessages.value = true;
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
    // si el mensaje es mío, no sonar
    if (uid && (last.senderId === uid || last.sender?.id === uid)) {
      lastMessagesCount.value = newLen;
      return;
    }

    // mensaje nuevo de otra persona → sonar
    playNotification();
    lastMessagesCount.value = newLen;
  }
);

/* ===========================
   6) CAMBIAR ESTADO DEL TICKET
=========================== */
async function changeStatus(newStatus: string) {
  statusError.value = null;

  if (!selectedTicketId.value) return;

  const jwt = (token.value ?? "").trim();
  if (!jwt) {
    statusError.value = "No hay token JWT para autenticar la petición.";
    return;
  }

  isUpdatingStatus.value = true;
  try {
    const res = await fetch(
      `http://localhost:3000/tickets/${selectedTicketId.value}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          status: newStatus,
          note: "Estado actualizado desde el panel de ayuda",
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Error ${res.status} al actualizar el estado`);
    }

    const updated = await res.json();

    // Actualizar estado del ticket en la lista local
    const idx = tickets.value.findIndex((t) => t.id === selectedTicketId.value);
    if (idx !== -1) {
      tickets.value[idx] = {
        ...tickets.value[idx],
        status: updated.status ?? newStatus,
      };
    }
  } catch (err: any) {
    console.error(err);
    statusError.value = err.message || "No se pudo actualizar el estado.";
  } finally {
    isUpdatingStatus.value = false;
  }
}

/* ===========================
   7) CARGAR TICKETS DESDE EL BACKEND
=========================== */
async function loadTickets() {
  ticketsError.value = null;

  const jwt = (token.value ?? "").trim();
  if (!jwt) {
    ticketsError.value = "No hay token JWT. Inicia sesión primero.";
    return;
  }

  isLoadingTickets.value = true;
  try {
    const res = await fetch("http://localhost:3000/tickets/panel-list", {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Error ${res.status} al cargar los tickets`);
    }

    const data = await res.json();
    tickets.value = data;

    if (!selectedTicketId.value && tickets.value.length > 0) {
      selectedTicketId.value = tickets.value[0].id;
      connectToSelected();
      await nextTick();
      scrollToBottom();
    }
  } catch (err: any) {
    console.error(err);
    ticketsError.value = err.message || "Error al cargar los tickets.";
  } finally {
    isLoadingTickets.value = false;
  }
}

/* ===========================
   7.1) AUTO-REFRESH CADA 3 SEGUNDOS
=========================== */
let refreshId: number | null = null;

onMounted(async () => {
  initAuth();
  await loadTickets();

  refreshId = window.setInterval(() => {
    loadTickets();
  }, 5000);
});

onUnmounted(() => {
  if (refreshId !== null) {
    clearInterval(refreshId);
  }
});

/* ===========================
   8) CONECTAR CHAT AL TICKET SELECCIONADO
=========================== */
function connectToSelected() {
  const jwt = (token.value ?? "").trim();
  if (!selectedTicketId.value || !jwt) return;

  // reset contadores de sonido al cambiar de ticket
  hasInitializedMessages.value = false;
  lastMessagesCount.value = 0;

  connect(selectedTicketId.value, jwt);

  nextTick(() => {
    scrollToBottom();
  });
}

/* ===========================
   9) SELECCIONAR TICKET
=========================== */
function handleSelectTicket(ticket: TicketSummary) {
  selectedTicketId.value = ticket.id;
  connectToSelected();
}

/* ===========================
   10) ENVIAR MENSAJE
=========================== */
function handleSend() {
  if (!canSend.value) return;
  sendMessage(selectedTicketId.value as number, newMessage.value.trim());
  newMessage.value = "";
}
</script>

<template>
  <!-- Fondo completo (oscuro) -->
  <div
    class="h-screen bg-slate-900 text-slate-100 flex flex-col overflow-hidden"
  >
    <!-- HEADER SUPERIOR -->
    <header class="px-6 pt-4 pb-3">
      <div
        class="max-w-6xl mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 class="text-2xl md:text-3xl font-bold">Mesa de ayuda – Chat</h1>
          <p class="text-xs text-slate-400">
            Panel tipo WhatsApp: tickets a la izquierda, chat a la derecha.
          </p>
        </div>

        <!-- Info de sesión + botón cargar tickets -->
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

          <button
            type="button"
            @click="loadTickets"
            class="h-8 px-3 rounded-md bg-emerald-500 hover:bg-emerald-600 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isLoadingTickets || !token"
          >
            {{ isLoadingTickets ? "Cargando tickets..." : "Cargar tickets" }}
          </button>

          <p v-if="ticketsError" class="text-[11px] text-rose-400 mt-1">
            {{ ticketsError }}
          </p>
        </div>
      </div>
    </header>

    <!-- CUERPO PRINCIPAL -->
    <main class="flex-1 flex justify-center items-stretch px-4 pb-4 min-h-0">
      <div
        class="flex flex-1 max-w-6xl mx-auto border border-slate-800 bg-slate-950/60 rounded-xl overflow-hidden shadow-lg min-h-0"
      >
        <!-- COLUMNA IZQUIERDA: TICKETS -->
        <aside
          class="w-80 border-r border-slate-800 bg-slate-950 flex flex-col min-h-0"
        >
          <!-- Barra superior de la lista -->
          <div
            class="px-3 py-2 border-b border-slate-800 flex items-center justify-between"
          >
            <span class="text-xs font-semibold text-slate-300 uppercase">
              Tickets
            </span>
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
              {{
                isConnecting
                  ? "Conectando"
                  : isConnected
                  ? "Conectado"
                  : "Desconectado"
              }}
            </span>
          </div>

          <!-- Lista de tickets -->
          <div class="flex-1 overflow-y-auto">
            <div
              v-if="tickets.length === 0"
              class="h-full flex items-center justify-center px-3 text-center"
            >
              <p class="text-xs text-slate-500">
                No hay tickets cargados.<br />
                Pulsa
                <span class="font-semibold">“Cargar tickets”</span>.
              </p>
            </div>

            <ul v-else class="divide-y divide-slate-800 list-none m-0 p-0">
              <li
                v-for="t in tickets"
                :key="t.id"
                @click="handleSelectTicket(t)"
                class="px-3 py-2 cursor-pointer hover:bg-slate-800/70 transition-colors"
                :class="{ 'bg-slate-800/90': t.id === selectedTicketId }"
              >
                <div class="flex justify-between items-center gap-2">
                  <span class="text-sm font-semibold truncate">
                    #{{ t.id }} – {{ t.subject || "Sin asunto" }}
                  </span>
                  <span
                    class="text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap"
                    :class="{
                      'border-emerald-500 text-emerald-300':
                        t.status === 'PENDING',
                      'border-amber-400 text-amber-300':
                        t.status === 'IN_PROGRESS',
                      'border-sky-400 text-sky-300': t.status === 'RESOLVED',
                      'border-slate-500 text-slate-300':
                        !t.status || t.status === 'CLOSED',
                    }"
                  >
                    {{
                      t.status === "PENDING"
                        ? "Abierto"
                        : t.status === "IN_PROGRESS"
                        ? "En progreso"
                        : t.status === "RESOLVED"
                        ? "Resuelto"
                        : t.status === "CLOSED"
                        ? "Cerrado"
                        : t.status || "Sin estado"
                    }}
                  </span>
                </div>
                <p class="text-[11px] text-slate-400 truncate">
                  {{ t.requesterName || "Usuario desconocido" }}
                </p>

                <!-- Fecha sin segundos -->
                <p class="text-[10px] text-slate-500">
                  {{ t.createdAt ? formatDateTime(t.createdAt as string) : "" }}
                </p>
              </li>
            </ul>
          </div>
        </aside>

        <!-- COLUMNA DERECHA: CHAT -->
        <section class="flex-1 flex flex-col bg-slate-900 min-h-0">
          <!-- Header del chat -->
          <div
            class="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90"
          >
            <div>
              <h2 class="text-lg font-semibold">
                <span v-if="selectedTicketId">
                  Ticket #{{ selectedTicketId }}
                </span>
                <span v-else>Selecciona un ticket</span>
              </h2>
              <p class="text-xs text-slate-400">
                {{ selectedTicket?.subject || "Sin asunto" }}
              </p>
            </div>

            <div class="text-right space-y-1">
              <div>
                <p class="text-[11px] text-slate-400">
                  {{ selectedTicket?.requesterName || "Sin solicitante" }}
                </p>
                <p class="text-[10px] text-slate-500">
                  {{
                    selectedTicket?.createdAt
                      ? formatDateTime(selectedTicket.createdAt as string)
                      : ""
                  }}
                </p>
              </div>

              <!-- Selector de estado -->
              <div class="flex items-center justify-end gap-2">
                <label class="text-[11px] text-slate-400">Estado:</label>
                <select
                  class="text-[11px] bg-slate-900 border border-slate-700 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  :disabled="!selectedTicketId || isUpdatingStatus"
                  :value="selectedTicket?.status || ''"
                  @change="
                    changeStatus(($event.target as HTMLSelectElement).value)
                  "
                >
                  <option value="" disabled>Selecciona...</option>
                  <option
                    v-for="opt in STATUS_OPTIONS"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </option>
                </select>
              </div>

              <p
                v-if="statusError"
                class="text-[10px] text-rose-400 mt-1 max-w-xs ml-auto"
              >
                {{ statusError }}
              </p>
            </div>
          </div>

          <!-- Mensajes -->
          <div
            ref="chatContainer"
            class="flex-1 bg-slate-900 overflow-y-auto px-4 py-3 space-y-3 flex flex-col"
            @scroll="checkIfAtBottom"
          >
            <div
              v-if="!selectedTicketId"
              class="flex-1 flex items-center justify-center"
            >
              <p class="text-sm text-slate-500 text-center">
                Selecciona un ticket en la columna izquierda<br />
                para ver y responder el chat.
              </p>
            </div>

            <template v-else>
              <!-- Aviso de ticket cerrado -->
              <div
                v-if="selectedTicket?.status === 'CLOSED'"
                class="flex justify-center mb-3"
              >
                <div
                  class="max-w-md w-full bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-3 text-xs text-slate-100 flex items-start gap-2"
                >
                  <span class="text-lg leading-none">🔒</span>
                  <div>
                    <p class="font-semibold mb-1">Ticket cerrado</p>
                    <p>
                      Este ticket está cerrado. Si necesitas más ayuda, por
                      favor abre uno nuevo.
                    </p>
                  </div>
                </div>
              </div>

              <div
                v-if="typedMessages.length === 0"
                class="flex-1 flex items-center justify-center"
              >
                <p class="text-sm text-slate-500 italic">
                  No hay mensajes aún en este ticket. Envía el primero 👋
                </p>
              </div>

              <!-- Burbujas estilo WhatsApp -->
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
                  <!-- Nombre del remitente -->
                  <p class="text-[11px] font-semibold text-left mb-1">
                    {{ isMine(msg) ? "Tú" : msg.sender?.name || "Usuario" }}
                  </p>

                  <!-- Contenido del mensaje -->
                  <p class="whitespace-pre-line text-left leading-snug mb-1">
                    {{ msg.content }}
                  </p>

                  <!-- Fecha debajo -->
                  <p class="text-[10px] text-left text-white opacity-90">
                    {{ formatDateTime(msg.createdAt) }}
                  </p>
                </div>
              </div>
            </template>
          </div>

          <!-- Input (fijo abajo del panel de chat) -->
          <form
            class="border-t border-slate-800 px-4 py-3 flex gap-2 bg-slate-900/90"
            @submit.prevent="handleSend"
          >
            <input
              v-model="newMessage"
              type="text"
              class="flex-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Escribe un mensaje para este ticket..."
              :disabled="
                !selectedTicketId ||
                !isConnected ||
                selectedTicket?.status === 'CLOSED'
              "
            />
            <button
              type="submit"
              class="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!canSend || selectedTicket?.status === 'CLOSED'"
            >
              Enviar
            </button>
          </form>

          <p
            v-if="lastError"
            class="text-[11px] text-rose-400 px-4 pb-2 text-right"
          >
            Último error WS: {{ lastError }}
          </p>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Scrollbar sutil para la lista de mensajes y tickets */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.6);
}
</style>
