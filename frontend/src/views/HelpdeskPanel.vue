<!-- src/views/HelpdeskPanel.vue -->
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useTicketChat } from "../composables/useTicketChat";
import { useAuth } from "../composables/useAuth";

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

/* ===========================
   0) AUDIO PRE-CARGADO PARA NOTIFICACIÓN
=========================== */
const notificationAudio = new Audio("/sounds/Sonido_Notificacion.MP3");
notificationAudio.preload = "auto";

function playNotification() {
  try {
    notificationAudio.currentTime = 0;
    void notificationAudio.play();
  } catch (e) {
    console.error("No se pudo reproducir el sonido de notificación:", e);
  }
}

/* ===========================
   1) ESTADO PARA CAMBIAR ESTADO DEL TICKET
=========================== */
const isUpdatingStatus = ref(false);
const statusError = ref<string | null>(null);

const STATUS_OPTIONS = [
  { value: "PENDING", label: "ABIERTO" },
  { value: "IN_PROGRESS", label: "EN PROGRESO" },
  { value: "RESOLVED", label: "RESUELTO" },
  { value: "CLOSED", label: "CERRADO" },
];

const STATUS_FILTERS = [
  { value: "ALL", label: "Todos" },
  { value: "PENDING", label: "Abiertos" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "RESOLVED", label: "Resueltos" },
  { value: "CLOSED", label: "Cerrados" },
] as const;

type StatusFilterValue =
  | "ALL"
  | "PENDING"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

/* ===========================
   2) AUTENTICACIÓN (useAuth) + logout
=========================== */
const router = useRouter();
const { token, user, initAuth, logout } = useAuth();

function handleLogout() {
  logout();
  router.push("/login");
}

const isAdmin = computed(() => {
  const u: any = user;
  const roles = u?.value?.roles || u?.roles || [];
  return Array.isArray(roles) && roles.includes("admin");
});

/* id del usuario logueado */
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
  updatedAt?: string;
  requesterName?: string;
  area?: string | null;
  assignedToId?: number | null;
  assignedToName?: string | null;
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

const isTicketClosed = computed(
  () => selectedTicket.value?.status === "CLOSED"
);

/* ====== 4.1) TRACK DE ACTIVIDAD POR TICKET (NUEVOS MENSAJES) ====== */
const ticketLastSeenAt = ref<Record<number, string | null>>({});
const ticketHasNew = ref<Record<number, boolean>>({});
const hasInitialTicketsLoaded = ref(false);

function getTicketActivityTimestamp(t: TicketSummary): string | null {
  return t.updatedAt || t.createdAt || null;
}

function processTicketUpdates(fresh: TicketSummary[]) {
  const lastSeen = { ...ticketLastSeenAt.value };
  const flags = { ...ticketHasNew.value };

  fresh.forEach((t) => {
    const ts = getTicketActivityTimestamp(t);
    const prev = lastSeen[t.id] || null;

    if (!hasInitialTicketsLoaded.value) {
      lastSeen[t.id] = ts;
      flags[t.id] = false;
    } else {
      if (t.id !== selectedTicketId.value) {
        if (ts && ts !== prev) {
          flags[t.id] = true;
        }
      }
      lastSeen[t.id] = ts;
    }
  });

  ticketLastSeenAt.value = lastSeen;
  ticketHasNew.value = flags;
  hasInitialTicketsLoaded.value = true;
}

/* ===========================
   4.2) FILTROS (estado + área + agente)
=========================== */
const statusFilter = ref<StatusFilterValue>("ALL");

// solo usados realmente si esAdmin === true
const areaFilter = ref<string>("ALL");
const agentFilter = ref<string>("ALL");

// Áreas disponibles (solo admin)
const availableAreas = computed(() => {
  if (!isAdmin.value) return [];
  const set = new Set<string>();
  tickets.value.forEach((t) => {
    if (t.area && t.area.trim() !== "") {
      set.add(t.area.trim());
    }
  });
  return Array.from(set).sort((a, b) =>
    a.localeCompare(b, "es-CO", { sensitivity: "base" })
  );
});

// Agentes disponibles (solo admin)
const availableAgents = computed(() => {
  if (!isAdmin.value) return [];
  const map = new Map<number, string>();
  tickets.value.forEach((t) => {
    if (t.assignedToId && t.assignedToName) {
      map.set(t.assignedToId, t.assignedToName);
    }
  });
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, "es-CO", { sensitivity: "base" })
    );
});

// lista filtrada
const filteredTickets = computed(() => {
  let list = [...tickets.value];

  // estado
  if (statusFilter.value !== "ALL") {
    list = list.filter((t) => t.status === statusFilter.value);
  }

  // área (solo admin)
  if (isAdmin.value && areaFilter.value !== "ALL") {
    list = list.filter((t) => (t.area || "").trim() === areaFilter.value);
  }

  // agente (solo admin)
  if (isAdmin.value && agentFilter.value !== "ALL") {
    if (agentFilter.value === "UNASSIGNED") {
      list = list.filter((t) => !t.assignedToId);
    } else {
      const id = Number(agentFilter.value);
      list = list.filter((t) => t.assignedToId === id);
    }
  }

  // orden por última actividad
  return list.sort((a, b) => {
    const ta = getTicketActivityTimestamp(a);
    const tb = getTicketActivityTimestamp(b);
    const va = ta ? new Date(ta).getTime() : 0;
    const vb = tb ? new Date(tb).getTime() : 0;
    return vb - va;
  });
});

/* === CONTADORES === */
const totalTickets = computed(() => tickets.value.length);
const filteredCount = computed(() => filteredTickets.value.length);
const openCount = computed(
  () => tickets.value.filter((t) => t.status === "PENDING").length
);
const inProgressCount = computed(
  () => tickets.value.filter((t) => t.status === "IN_PROGRESS").length
);
const resolvedCount = computed(
  () => tickets.value.filter((t) => t.status === "RESOLVED").length
);
const closedCount = computed(
  () => tickets.value.filter((t) => t.status === "CLOSED").length
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

function isMine(msg: TicketMessage): boolean {
  const uid = myId.value;
  if (!uid) return false;
  if (msg.senderId === uid) return true;
  if (msg.sender && msg.sender.id === uid) return true;
  return false;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/* ===========================
   5.1) NOTIFICACIÓN / HISTORIAL
=========================== */
const lastMessagesCount = ref(0);
const hasInitializedMessages = ref(false);
const lastTicketChangeAt = ref<number | null>(null);

/* ===========================
   5.2) SCROLL TIPO WHATSAPP
=========================== */
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
  (newLen) => {
    if (!hasInitializedMessages.value) {
      hasInitializedMessages.value = true;
      lastMessagesCount.value = newLen;
      nextTick(() => {
        scrollToBottom();
      });
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
    const isFromMe =
      !!uid && (last.senderId === uid || last.sender?.id === uid);

    const now = Date.now();
    const isWithinInitWindow =
      lastTicketChangeAt.value && now - lastTicketChangeAt.value < 1500;

    if (!isFromMe && !isWithinInitWindow) {
      playNotification();
    }

    lastMessagesCount.value = newLen;

    if (isAtBottom.value || isFromMe) {
      nextTick(() => {
        scrollToBottom();
      });
    }
  }
);

/* ===========================
   6) CAMBIAR ESTADO
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
   7) CARGAR TICKETS
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

    const data: TicketSummary[] = await res.json();
    tickets.value = data;

    processTicketUpdates(data);

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
   7.1) AUTO-REFRESH
=========================== */
let refreshId: number | null = null;

onMounted(async () => {
  initAuth();
  await loadTickets();

  refreshId = window.setInterval(() => {
    loadTickets();
  }, 3000);
});

onUnmounted(() => {
  if (refreshId !== null) {
    clearInterval(refreshId);
  }
});

/* ===========================
   8) CONECTAR CHAT
=========================== */
function connectToSelected() {
  const jwt = (token.value ?? "").trim();
  if (!selectedTicketId.value || !jwt) return;

  hasInitializedMessages.value = false;
  lastMessagesCount.value = 0;
  lastTicketChangeAt.value = Date.now();

  if (selectedTicketId.value) {
    ticketHasNew.value[selectedTicketId.value] = false;
  }

  connect(selectedTicketId.value, jwt);

  nextTick(() => {
    scrollToBottom();
  });
}

/* ===========================
   9) SELECCIONAR TICKET (con auto-asignación en agente)
=========================== */
async function handleSelectTicket(ticket: TicketSummary) {
  selectedTicketId.value = ticket.id;
  ticketHasNew.value[ticket.id] = false;
  connectToSelected();

  if (!isAdmin.value && !ticket.assignedToId && myId.value) {
    const jwt = (token.value ?? "").trim();
    if (!jwt) return;

    try {
      const res = await fetch(
        `http://localhost:3000/tickets/${ticket.id}/assign-me`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        }
      );

      if (res.ok) {
        const idx = tickets.value.findIndex((t) => t.id === ticket.id);
        if (idx !== -1) {
          tickets.value[idx] = {
            ...tickets.value[idx],
            assignedToId: myId.value,
            assignedToName:
              (user.value as any)?.name || tickets.value[idx].assignedToName,
          };
        }
      }
    } catch (e) {
      console.error("Error asignando ticket al agente:", e);
    }
  }
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
            <button
              type="button"
              @click="loadTickets"
              class="h-8 px-3 rounded-md bg-emerald-500 hover:bg-emerald-600 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isLoadingTickets || !token"
            >
              {{ isLoadingTickets ? "Cargando tickets..." : "Cargar tickets" }}
            </button>

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
    <main class="flex-1 flex justify-center items-stretch px-4 pb-4 min-h-0">
      <div
        class="flex flex-1 max-w-6xl mx-auto border border-slate-800 bg-slate-950/60 rounded-xl overflow-hidden shadow-lg min-h-0"
      >
        <!-- COLUMNA IZQUIERDA -->
        <aside
          class="w-80 border-r border-slate-800 bg-slate-950 flex flex-col min-h-0"
        >
          <!-- Header lista -->
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

          <!-- Filtros -->
          <div
            class="px-3 py-3 border-b border-slate-800 text-[11px] bg-slate-950 space-y-2"
          >
            <!-- Chips de estado con contador -->
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
                <template v-if="f.value === 'ALL'">
                  Todos ({{ totalTickets }})
                </template>
                <template v-else-if="f.value === 'PENDING'">
                  Abiertos ({{ openCount }})
                </template>
                <template v-else-if="f.value === 'IN_PROGRESS'">
                  En progreso ({{ inProgressCount }})
                </template>
                <template v-else-if="f.value === 'RESOLVED'">
                  Resueltos ({{ resolvedCount }})
                </template>
                <template v-else-if="f.value === 'CLOSED'">
                  Cerrados ({{ closedCount }})
                </template>
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
                  <option
                    v-for="ag in availableAgents"
                    :key="ag.id"
                    :value="String(ag.id)"
                  >
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
                Pulsa
                <span class="font-semibold">“Cargar tickets”</span>.
              </p>
            </div>

            <div
              v-else-if="tickets.length && !filteredTickets.length"
              class="h-full flex items-center justify-center px-3 text-center"
            >
              <p class="text-xs text-slate-500">
                No hay tickets que coincidan con los filtros actuales.
              </p>
            </div>

            <ul v-else class="divide-y divide-slate-800 list-none m-0 p-0">
              <li
                v-for="t in filteredTickets"
                :key="t.id"
                @click="handleSelectTicket(t)"
                class="px-3 py-2 cursor-pointer hover:bg-slate-800/70 transition-colors"
                :class="{ 'bg-slate-800/90': t.id === selectedTicketId }"
              >
                <div class="flex justify-between items-center gap-2">
                  <span class="text-sm font-semibold truncate">
                    #{{ t.id }} – {{ t.subject || "Sin asunto" }}
                  </span>

                  <div class="flex items-center gap-2">
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
                          ? "ABIERTO"
                          : t.status === "IN_PROGRESS"
                          ? "EN PROGRESO"
                          : t.status === "RESOLVED"
                          ? "RESUELTO"
                          : t.status === "CLOSED"
                          ? "CERRADO"
                          : t.status || "SIN ESTADO"
                      }}
                    </span>

                    <span
                      v-if="ticketHasNew[t.id]"
                      class="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-semibold uppercase tracking-wide"
                    >
                      Nuevo
                    </span>
                  </div>
                </div>

                <p class="text-[11px] text-slate-400 truncate">
                  {{ t.requesterName || "Usuario desconocido" }}
                </p>

                <p v-if="t.area" class="text-[10px] text-slate-500 truncate">
                  Área: {{ t.area }}
                </p>

                <p class="text-[10px] text-slate-500">
                  {{
                    t.updatedAt || t.createdAt
                      ? formatDateTime((t.updatedAt || t.createdAt) as string)
                      : ""
                  }}
                </p>

                <p
                  v-if="t.assignedToName"
                  class="text-[10px] text-slate-400 truncate"
                >
                  Atendido por: {{ t.assignedToName }}
                </p>
              </li>
            </ul>
          </div>
        </aside>

        <!-- COLUMNA DERECHA: CHAT -->
        <section class="flex-1 flex flex-col bg-slate-900 min-h-0">
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
                <p
                  v-if="selectedTicket?.assignedToName"
                  class="text-[10px] text-slate-400"
                >
                  Agente: {{ selectedTicket.assignedToName }}
                </p>
              </div>

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
                    {{ isMine(msg) ? "Tú" : msg.sender?.name || "Usuario" }}
                  </p>
                  <p class="whitespace-pre-line text-left leading-snug mb-1">
                    {{ msg.content }}
                  </p>
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
                <p>
                  Este ticket está cerrado. No puedes enviar más mensajes desde
                  este chat. Si el usuario necesita más ayuda, crea o solicita
                  un nuevo ticket.
                </p>
              </div>
            </div>
          </div>

          <!-- Input -->
          <form
            class="border-t border-slate-800 px-4 py-3 flex gap-2 bg-slate-900/90"
            @submit.prevent="handleSend"
          >
            <input
              v-model="newMessage"
              type="text"
              class="flex-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
              :placeholder="
                isTicketClosed
                  ? 'Ticket CERRADO. No puedes enviar mensajes.'
                  : 'Escribe un mensaje para este ticket...'
              "
              :disabled="!selectedTicketId || !isConnected || isTicketClosed"
            />
            <button
              type="submit"
              class="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!canSend || isTicketClosed"
            >
              {{ isTicketClosed ? "Ticket CERRADO" : "Enviar" }}
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
  </div>
</template>

<style scoped>
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
