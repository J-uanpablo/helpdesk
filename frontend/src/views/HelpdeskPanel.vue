<!-- src/views/HelpdeskPanel.vue -->
<script setup lang="ts">
import { computed, ref } from "vue";
import { useTicketChat } from "../composables/useTicketChat";

/* Tipos */
interface TicketMessage {
  id: number;
  content: string;
  createdAt: string;
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
}

/* Estado general */
const token = ref<string>("");
const tickets = ref<TicketSummary[]>([]);
const isLoadingTickets = ref(false);
const ticketsError = ref<string | null>(null);

const selectedTicketId = ref<number | null>(null);
const selectedTicket = computed(
  () => tickets.value.find((t) => t.id === selectedTicketId.value) || null
);

/* Chat */
const { messages, isConnected, isConnecting, lastError, connect, sendMessage } =
  useTicketChat();

const typedMessages = computed<TicketMessage[]>(() => messages.value);
const newMessage = ref("");

const canSend = computed(
  () =>
    isConnected.value &&
    !!selectedTicketId.value &&
    newMessage.value.trim().length > 0
);

/* ----- Estado del selector de estado del ticket ----- */
const isUpdatingStatus = ref(false);
const statusError = ref<string | null>(null);

// Posibles estados de tu sistema (ajusta los textos si usas otros)
const STATUS_OPTIONS = [
  { value: "PENDING", label: "Abierto" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "RESOLVED", label: "Resuelto" },
  { value: "CLOSED", label: "Cerrado" },
];

/* Cargar tickets */
async function loadTickets() {
  ticketsError.value = null;

  if (!token.value.trim()) {
    ticketsError.value = "Primero pega un token JWT válido.";
    return;
  }

  isLoadingTickets.value = true;
  try {
    const res = await fetch("http://localhost:3000/tickets/panel-list", {
      headers: {
        Authorization: `Bearer ${token.value.trim()}`,
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
    }
  } catch (err: any) {
    console.error(err);
    ticketsError.value = err.message || "Error al cargar los tickets.";
  } finally {
    isLoadingTickets.value = false;
  }
}

/* Conectar chat al ticket seleccionado */
function connectToSelected() {
  if (!selectedTicketId.value || !token.value.trim()) return;
  connect(selectedTicketId.value, token.value.trim());
}

/* Seleccionar ticket */
function handleSelectTicket(ticket: TicketSummary) {
  selectedTicketId.value = ticket.id;
  connectToSelected();
}

/* Enviar mensaje */
function handleSend() {
  if (!canSend.value) return;
  sendMessage(selectedTicketId.value as number, newMessage.value.trim());
  newMessage.value = "";
}

/* Cambiar estado del ticket */
async function changeStatus(newStatus: string) {
  statusError.value = null;
  if (!selectedTicketId.value) return;
  if (!token.value.trim()) {
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
          Authorization: `Bearer ${token.value.trim()}`,
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

    // Si tu backend devuelve el ticket actualizado:
    const updated = await res.json();

    // Actualizar el ticket en la lista local
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
</script>

<template>
  <!-- Fondo completo (oscuro) -->
  <div class="h-screen bg-slate-900 text-slate-100 flex flex-col">
    <!-- HEADER SUPERIOR (fuera del “card”, como WhatsApp Web) -->
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

        <div class="flex-1 flex flex-col gap-1 md:max-w-xl">
          <label class="text-xs text-slate-300">
            Token JWT (pégalo desde Postman)
          </label>
          <div class="flex gap-2">
            <textarea
              v-model="token"
              rows="2"
              class="flex-1 rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            />
            <button
              type="button"
              @click="loadTickets"
              class="h-9 self-end px-3 rounded-md bg-emerald-500 hover:bg-emerald-600 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isLoadingTickets || !token.trim()"
            >
              {{ isLoadingTickets ? "Cargando..." : "Cargar tickets" }}
            </button>
          </div>
          <p v-if="ticketsError" class="text-[11px] text-rose-400">
            {{ ticketsError }}
          </p>
        </div>
      </div>
    </header>

    <!-- CUERPO PRINCIPAL: panel centrado tipo WhatsApp -->
    <main class="flex-1 flex justify-center items-stretch px-4 pb-4">
      <div
        class="flex flex-1 max-w-6xl mx-auto border border-slate-800 bg-slate-950/60 rounded-xl overflow-hidden shadow-lg"
      >
        <!-- COLUMNA IZQUIERDA: TICKETS -->
        <aside
          class="w-80 border-r border-slate-800 bg-slate-950 flex flex-col"
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
                Pega el token y pulsa
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
                <p class="text-[10px] text-slate-500">
                  {{
                    t.createdAt ? new Date(t.createdAt).toLocaleString() : ""
                  }}
                </p>
              </li>
            </ul>
          </div>
        </aside>

        <!-- COLUMNA DERECHA: CHAT -->
        <section class="flex-1 flex flex-col bg-slate-900">
          <!-- Header del chat -->
          <div
            class="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 gap-4"
          >
            <div class="flex flex-col">
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

            <!-- Selector de estado -->
            <div v-if="selectedTicketId" class="flex flex-col items-end gap-1">
              <label class="text-[11px] text-slate-400">
                Estado del ticket
              </label>
              <select
                class="text-xs bg-slate-900 border border-slate-600 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :value="selectedTicket?.status || 'OPEN'"
                @change="
                  changeStatus(
                    ($event.target as HTMLSelectElement).value as string
                  )
                "
                :disabled="isUpdatingStatus"
              >
                <option
                  v-for="opt in STATUS_OPTIONS"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
              <p v-if="statusError" class="text-[10px] text-rose-400">
                {{ statusError }}
              </p>
            </div>

            <div class="text-right">
              <p class="text-[11px] text-slate-400">
                {{ selectedTicket?.requesterName || "Sin solicitante" }}
              </p>
              <p class="text-[10px] text-slate-500">
                {{
                  selectedTicket?.createdAt
                    ? new Date(selectedTicket.createdAt).toLocaleString()
                    : ""
                }}
              </p>
            </div>
          </div>

          <!-- Mensajes -->
          <div
            class="flex-1 bg-slate-900 overflow-y-auto px-4 py-3 space-y-3 flex flex-col"
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
                v-else
                v-for="msg in typedMessages"
                :key="msg.id"
                class="flex flex-col text-sm bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-2 max-w-xl"
              >
                <div class="flex justify-between items-center mb-0.5">
                  <span class="font-semibold text-emerald-300">
                    {{ msg.sender?.name || "Usuario" }}
                  </span>
                  <span class="text-[11px] text-slate-400">
                    {{ new Date(msg.createdAt).toLocaleString() }}
                  </span>
                </div>
                <p class="text-slate-100 whitespace-pre-line">
                  {{ msg.content }}
                </p>
                <p class="text-[10px] text-slate-500 mt-0.5">
                  (ID mensaje: {{ msg.id }})
                </p>
              </div>
            </template>
          </div>

          <!-- Input -->
          <form
            class="border-t border-slate-800 px-4 py-3 flex gap-2 bg-slate-900/90"
            @submit.prevent="handleSend"
          >
            <input
              v-model="newMessage"
              type="text"
              class="flex-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Escribe un mensaje para este ticket..."
              :disabled="!selectedTicketId || !isConnected"
            />
            <button
              type="submit"
              class="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!canSend"
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
