<!-- src/views/TicketChat.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useTicketChat } from '../composables/useTicketChat';

// ⚙️ Tipo de mensaje
interface TicketMessage {
  id: number;
  content: string;
  createdAt: string;
  sender?: {
    id: number;
    name: string;
  };
}

// ⚙️ Tipo de ticket (ajusta campos a tu API)
interface TicketSummary {
  id: number;
  subject?: string;
  status?: string;
  createdAt?: string;
}

// ID del ticket a conectar (inicialmente 2)
const ticketId = ref<number | null>(2);

// JWT pegado desde Postman
const token = ref<string>('');

// Mensaje nuevo
const newMessage = ref<string>('');

// Lista de tickets
const tickets = ref<TicketSummary[]>([]);
const isLoadingTickets = ref(false);
const ticketsError = ref<string | null>(null);

// Composable del chat
const { messages, isConnected, isConnecting, lastError, connect, sendMessage } = useTicketChat();

// Tipado de mensajes
const typedMessages = computed<TicketMessage[]>(() => messages.value);

// Helpers
const canConnect = computed(() => !!ticketId.value && token.value.trim().length > 0);

const canSend = computed(
  () => isConnected.value && !!ticketId.value && newMessage.value.trim().length > 0
);

// 👉 Cargar tickets desde el backend
async function loadTickets() {
  ticketsError.value = null;

  if (!token.value.trim()) {
    ticketsError.value = 'Primero pega un token JWT válido.';
    return;
  }

  isLoadingTickets.value = true;
  try {
    const res = await fetch('/tickets/list', {
      headers: {
        Authorization: `Bearer ${token.value.trim()}`,
      },
    });

    if (!res.ok) throw new Error(`Error ${res.status} al cargar los tickets`);

    const data = await res.json();
    tickets.value = data;

    if (!ticketId.value && tickets.value.length > 0) {
      ticketId.value = tickets.value[0].id;
    }
  } catch (err: any) {
    console.error(err);
    ticketsError.value = err.message || 'Error al cargar los tickets.';
  } finally {
    isLoadingTickets.value = false;
  }
}

// Conectar al websocket
function handleConnect() {
  if (!canConnect.value) return;
  connect(ticketId.value as number, token.value.trim());
}

// Enviar mensaje
function handleSend() {
  if (!canSend.value) return;
  sendMessage(ticketId.value as number, newMessage.value.trim());
  newMessage.value = '';
}
</script>

<template>
  <!-- ✅ IMPORTANTE: h-full/min-h-0 en vez de min-h-screen -->
  <div class="h-full min-h-0 bg-slate-900 text-slate-100 overflow-hidden">
    <!-- ✅ Todo el view dentro de un flex-column con min-h-0 -->
    <div class="h-full min-h-0 flex flex-col items-center overflow-hidden">
      <!-- Header (no scrollea) -->
      <div class="w-full max-w-3xl shrink-0 pt-6 px-4">
        <h1 class="text-4xl md:text-5xl font-extrabold mb-6 text-center">HD Panel de chat</h1>
      </div>

      <!-- ✅ El contenido central debe poder scrollear si no cabe -->
      <div class="w-full max-w-3xl flex-1 min-h-0 overflow-y-auto px-4 pb-6 space-y-6">
        <!-- Panel de conexión -->
        <div class="bg-slate-800/70 border border-slate-700 rounded-xl p-6 shadow-lg">
          <div class="flex flex-col gap-4 mb-4">
            <!-- JWT -->
            <div class="flex-1 flex flex-col gap-1">
              <label for="token" class="text-sm text-slate-300">
                Token JWT (pégalo desde Postman)
              </label>
              <textarea
                id="token"
                v-model="token"
                rows="3"
                class="w-full rounded-md bg-slate-900 border border-slate-600 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              />
            </div>

            <!-- Tickets -->
            <div class="flex flex-col md:flex-row md:items-end gap-3">
              <div class="flex-1 flex flex-col gap-1">
                <label class="text-sm text-slate-300">
                  Selecciona un ticket
                  <span class="text-xs text-slate-400">(o escribe el ID)</span>
                </label>

                <div class="flex gap-2">
                  <select
                    v-if="tickets.length > 0"
                    v-model.number="ticketId"
                    class="flex-1 rounded-md bg-slate-900 border border-slate-600 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option v-for="t in tickets" :key="t.id" :value="t.id">
                      #{{ t.id }} - {{ t.subject || 'Sin asunto' }}
                    </option>
                  </select>

                  <input
                    v-else
                    v-model.number="ticketId"
                    type="number"
                    min="1"
                    class="flex-1 rounded-md bg-slate-900 border border-slate-600 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="ID del ticket"
                  />

                  <button
                    type="button"
                    @click="loadTickets"
                    class="px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="isLoadingTickets || !token.trim()"
                  >
                    {{ isLoadingTickets ? 'Cargando...' : 'Cargar tickets' }}
                  </button>
                </div>

                <p v-if="ticketsError" class="text-xs text-rose-400 mt-1">
                  {{ ticketsError }}
                </p>
              </div>

              <button
                type="button"
                @click="handleConnect"
                class="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="isConnecting || !canConnect"
              >
                {{
                  isConnecting ? 'Conectando...' : isConnected ? 'Reconectar' : 'Conectar al chat'
                }}
              </button>
            </div>
          </div>

          <p class="text-sm">
            <span class="font-medium">Estado:</span>
            <span
              :class="{
                'text-emerald-400': isConnected,
                'text-yellow-400': isConnecting,
                'text-rose-400': !isConnected && !isConnecting,
              }"
            >
              {{ isConnecting ? 'Conectando...' : isConnected ? 'Conectado' : 'Desconectado' }}
            </span>
          </p>

          <p class="text-xs text-slate-400 mt-1" v-if="lastError">
            Último error:
            <span class="text-rose-400">{{ lastError }}</span>
          </p>
          <p class="text-xs text-slate-400 mt-1" v-else>No hay conexión activa.</p>
        </div>

        <!-- Área de chat -->
        <div class="bg-slate-800/70 border border-slate-700 rounded-xl p-6 shadow-lg">
          <h2 class="text-3xl font-bold mb-4 text-center">
            Chat del ticket #{{ ticketId || '?' }}
          </h2>

          <p class="text-sm text-slate-300 mb-4 text-center">
            Mensajes en tiempo real desde el backend de NestJS.
          </p>

          <div
            class="h-64 md:h-72 bg-slate-900/80 border border-slate-700 rounded-lg p-4 overflow-y-auto space-y-3 mb-4"
          >
            <div v-if="typedMessages.length === 0" class="h-full flex items-center justify-center">
              <p class="text-sm text-slate-500 italic">No hay mensajes aún. Envía el primero 👋</p>
            </div>

            <div
              v-else
              v-for="msg in typedMessages"
              :key="msg.id"
              class="flex flex-col text-sm bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-2"
            >
              <div class="flex justify-between items-center mb-0.5">
                <span class="font-semibold text-emerald-300">
                  {{ msg.sender?.name || 'Usuario' }}
                </span>
                <span class="text-[11px] text-slate-400">
                  {{ new Date(msg.createdAt).toLocaleString() }}
                </span>
              </div>
              <p class="text-slate-100">{{ msg.content }}</p>
              <p class="text-[11px] text-slate-500 mt-0.5">(ID mensaje: {{ msg.id }})</p>
            </div>
          </div>

          <form class="flex gap-2" @submit.prevent="handleSend">
            <input
              v-model="newMessage"
              type="text"
              class="flex-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Escribe un mensaje..."
              :disabled="!isConnected"
            />
            <button
              type="submit"
              class="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!canSend"
            >
              Enviar
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
