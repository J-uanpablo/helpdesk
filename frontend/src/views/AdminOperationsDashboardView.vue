<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { apiFetch } from '../lib/api';
import { useUiBus } from '../composables/useUiBus';

type DashboardScope = 'GLOBAL' | 'AREA';

interface DashboardSummary {
  pending: number;
  inProgress: number;
  closedToday: number;
  activeAgents: number;
}

interface QueueByAreaRow {
  area: string | null;
  pending: number;
  inProgress: number;
}

interface PendingTicketRow {
  id: number;
  subject: string;
  requesterName: string;
  requesterEmail: string | null;
  area: string | null;
  queuePosition: number;
  createdAt: string;
  waitMinutes: number;
}

interface InProgressTicketRow {
  id: number;
  subject: string;
  requesterName: string;
  requesterEmail: string | null;
  assignedToId: number | null;
  assignedToName: string;
  area: string | null;
  updatedAt: string;
  createdAt: string;
  attentionMinutes: number;
}

interface TicketSatisfaction {
  rating: number;
  comment: string | null;
  createdAt: string;
}

interface ClosedTicketRow {
  id: number;
  subject: string;
  requesterName: string;
  requesterEmail: string | null;
  assignedToName: string;
  area: string | null;
  closedAt: string | null;
  satisfaction: TicketSatisfaction | null;
}

interface AgentRow {
  id: number;
  name: string;
  email: string;
  area: string | null;
  roles: string[];
  activeTickets: number;
  statusLabel: string;
}

interface OperationsDashboardResponse {
  scope: DashboardScope;
  area: string | null;
  summary: DashboardSummary;
  queuesByArea: QueueByAreaRow[];
  pendingTickets: PendingTicketRow[];
  inProgressTickets: InProgressTicketRow[];
  closedTickets: ClosedTicketRow[];
  agents: AgentRow[];
}
const { open } = useUiBus();

function openReports() {
  open('reports');
}
const API_BASE = import.meta.env.VITE_API_URL ?? '';

const router = useRouter();
const { token, initAuth } = useAuth();

const isLoading = ref(false);
const error = ref<string | null>(null);
const dashboard = ref<OperationsDashboardResponse | null>(null);

let refreshTimer: number | null = null;
const dashboardSocket = ref<Socket | null>(null);

/* ===========================
   SOCKET
=========================== */
function disconnectDashboardSocket() {
  try {
    dashboardSocket.value?.off?.('new_ticket');
    dashboardSocket.value?.off?.('ticket_status_changed');
    dashboardSocket.value?.off?.('ticket_queue_updated');
    dashboardSocket.value?.disconnect();
  } catch (_) {}
  dashboardSocket.value = null;
}

function connectDashboardSocket() {
  if (!token.value) return;

  disconnectDashboardSocket();

  const s = io(API_BASE, {
    transports: ['websocket'],
    auth: { token: token.value },
  });

  dashboardSocket.value = s;

  s.on('connect', () => {
    console.log('🟢 Dashboard socket conectado');
  });

  s.on('disconnect', () => {
    console.log('🔴 Dashboard socket desconectado');
  });

  s.on('connect_error', err => {
    console.error('⚠️ Dashboard socket error:', err);
  });

  const refreshDashboard = () => {
    void loadDashboard(false);
  };

  s.on('new_ticket', refreshDashboard);
  s.on('ticket_status_changed', refreshDashboard);
  s.on('ticket_queue_updated', refreshDashboard);
}

/* ===========================
   COMPUTED BASE
=========================== */
const summary = computed<DashboardSummary>(() => {
  return (
    dashboard.value?.summary ?? {
      pending: 0,
      inProgress: 0,
      closedToday: 0,
      activeAgents: 0,
    }
  );
});

const queuesByArea = computed(() => dashboard.value?.queuesByArea ?? []);
const pendingTickets = computed(() => dashboard.value?.pendingTickets ?? []);
const inProgressTickets = computed(() => dashboard.value?.inProgressTickets ?? []);
const closedTickets = computed(() => dashboard.value?.closedTickets ?? []);
const agents = computed(() => dashboard.value?.agents ?? []);

const isGlobalScope = computed(() => dashboard.value?.scope === 'GLOBAL');
const isSuperAdminScope = computed(() => dashboard.value?.scope === 'GLOBAL');

/* ===========================
   FILTRO AGENTES (solo super-admin)
=========================== */
const agentAreaFilter = ref('ALL');

function normalizeArea(area?: string | null) {
  return area?.trim() || 'Sin área';
}

const availableAgentAreas = computed(() => {
  const unique = new Set<string>();

  agents.value.forEach(agent => {
    const area = normalizeArea(agent.area);
    if (area) unique.add(area);
  });

  return Array.from(unique).sort((a, b) => a.localeCompare(b, 'es-CO', { sensitivity: 'base' }));
});

const filteredAgents = computed(() => {
  if (!isSuperAdminScope.value || agentAreaFilter.value === 'ALL') {
    return agents.value;
  }

  return agents.value.filter(agent => normalizeArea(agent.area) === agentAreaFilter.value);
});
const agentsPage = ref(1);
const agentsPageSize = 5;

const paginatedAgents = computed(() => {
  const start = (agentsPage.value - 1) * agentsPageSize;
  return filteredAgents.value.slice(start, start + agentsPageSize);
});

const agentsTotalPages = computed(() => {
  return Math.max(1, Math.ceil(filteredAgents.value.length / agentsPageSize));
});

function goToAgentsPage(page: number) {
  if (page < 1) page = 1;
  if (page > agentsTotalPages.value) page = agentsTotalPages.value;
  agentsPage.value = page;
}

watch(
  () => filteredAgents.value.length,
  () => {
    if (agentsPage.value > agentsTotalPages.value) {
      agentsPage.value = agentsTotalPages.value;
    }
  }
);

/* ===========================
   PAGINACIÓN
=========================== */
const PAGE_SIZE = 5;

const pendingPage = ref(1);
const inProgressPage = ref(1);
const closedPage = ref(1);
const topRatedPage = ref(1);

function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function totalPages(totalItems: number, pageSize = PAGE_SIZE) {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

function clampPage(page: number, totalItems: number, pageSize = PAGE_SIZE) {
  return Math.min(Math.max(1, page), totalPages(totalItems, pageSize));
}

const sortedTopRatedTickets = computed(() => {
  return [...closedTickets.value]
    .filter(t => !!t.satisfaction?.rating)
    .sort((a, b) => (b.satisfaction?.rating ?? 0) - (a.satisfaction?.rating ?? 0));
});

const pendingTotalPages = computed(() => totalPages(pendingTickets.value.length));
const inProgressTotalPages = computed(() => totalPages(inProgressTickets.value.length));
const closedTotalPages = computed(() => totalPages(closedTickets.value.length));
const topRatedTotalPages = computed(() => totalPages(sortedTopRatedTickets.value.length));

const paginatedPendingTickets = computed(() => paginate(pendingTickets.value, pendingPage.value));

const paginatedInProgressTickets = computed(() =>
  paginate(inProgressTickets.value, inProgressPage.value)
);

const paginatedClosedTickets = computed(() => paginate(closedTickets.value, closedPage.value));

const paginatedTopRatedTickets = computed(() =>
  paginate(sortedTopRatedTickets.value, topRatedPage.value)
);

function goToPendingPage(page: number) {
  pendingPage.value = clampPage(page, pendingTickets.value.length);
}

function goToInProgressPage(page: number) {
  inProgressPage.value = clampPage(page, inProgressTickets.value.length);
}

function goToClosedPage(page: number) {
  closedPage.value = clampPage(page, closedTickets.value.length);
}

function goToTopRatedPage(page: number) {
  topRatedPage.value = clampPage(page, sortedTopRatedTickets.value.length);
}

watch(
  () => pendingTickets.value.length,
  () => {
    pendingPage.value = clampPage(pendingPage.value, pendingTickets.value.length);
  }
);

watch(
  () => inProgressTickets.value.length,
  () => {
    inProgressPage.value = clampPage(inProgressPage.value, inProgressTickets.value.length);
  }
);

watch(
  () => closedTickets.value.length,
  () => {
    closedPage.value = clampPage(closedPage.value, closedTickets.value.length);
  }
);

watch(
  () => sortedTopRatedTickets.value.length,
  () => {
    topRatedPage.value = clampPage(topRatedPage.value, sortedTopRatedTickets.value.length);
  }
);

/* ===========================
   HELPERS
=========================== */
function formatDate(value?: string | null) {
  if (!value) return '—';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

function formatMinutes(minutes?: number | null) {
  const m = Number(minutes ?? 0);

  if (m < 60) return `${m} min`;

  const hours = Math.floor(m / 60);
  const rem = m % 60;

  if (rem === 0) return `${hours} h`;
  return `${hours} h ${rem} min`;
}

function stars(rating?: number | null) {
  const value = Math.max(0, Math.min(5, Math.round(rating ?? 0)));
  return '★'.repeat(value) + '☆'.repeat(5 - value);
}

function getInitials(name?: string | null) {
  if (!name) return 'AG';

  const parts = name.trim().split(' ').filter(Boolean);

  if (parts.length === 1) {
    return (parts[0] ?? '').slice(0, 2).toUpperCase();
  }

  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';

  return `${first}${second}`.toUpperCase();
}

function getAgentStatusClass(activeTickets: number) {
  if (activeTickets >= 1) {
    return 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200';
  }

  return 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200';
}

function getAgentStatusText(activeTickets: number) {
  if (activeTickets >= 1) return 'Haciendo soporte';
  return 'Libre';
}

function getSummaryCardClass(type: 'pending' | 'progress' | 'closed' | 'agents') {
  if (type === 'pending') return 'from-blue-600 to-cyan-500';
  if (type === 'progress') return 'from-amber-500 to-orange-500';
  if (type === 'closed') return 'from-emerald-500 to-green-500';
  return 'from-violet-600 to-fuchsia-500';
}

function openTicket(ticketId: number) {
  router.push({
    name: 'soporte',
    query: { ticketId: String(ticketId) },
  });
}

/* ===========================
   CARGA
=========================== */
async function loadDashboard(showLoader = true) {
  try {
    if (showLoader) isLoading.value = true;
    error.value = null;

    await initAuth();

    if (!token.value) {
      router.push('/login');
      return;
    }

    const response = await apiFetch('/tickets/operations-dashboard', {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status} cargando dashboard`);
    }

    const data = (await response.json()) as OperationsDashboardResponse;
    dashboard.value = data;
  } catch (err: any) {
    error.value = err?.message || 'No se pudo cargar el dashboard operativo.';
  } finally {
    if (showLoader) isLoading.value = false;
  }
}

/* ===========================
   LIFECYCLE
=========================== */
onMounted(async () => {
  await loadDashboard(true);
  connectDashboardSocket();

  refreshTimer = window.setInterval(() => {
    void loadDashboard(false);
  }, 60000);
});

onBeforeUnmount(() => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }

  disconnectDashboardSocket();
});
</script>

<template>
  <section
    class="h-full min-h-0 w-full overflow-y-auto"
    style="background: var(--bg-main); color: var(--text-main)"
  >
    <div class="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <div
        class="mb-6 flex flex-col gap-4 rounded-3xl p-6 shadow-2xl backdrop-blur"
        style="background: var(--bg-panel); border: 1px solid var(--border-main)"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.25em]" style="color: #22d3ee">
              Mesa de Ayuda
            </p>

            <h1 class="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Dashboard Operativo</h1>

            <p class="mt-2 max-w-3xl text-sm sm:text-base" style="color: var(--text-soft)">
              Supervisa la cola de tickets, los agentes conectados, la atención en curso y la
              calificación que dejan los clientes en los tickets cerrados.
            </p>
          </div>

          <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <span
              class="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold"
              style="
                background: rgba(34, 211, 238, 0.1);
                color: #67e8f9;
                border: 1px solid rgba(34, 211, 238, 0.2);
              "
            >
              {{
                dashboard?.scope === 'GLOBAL'
                  ? 'Vista Global'
                  : `Área: ${normalizeArea(dashboard?.area)}`
              }}
            </span>

            <button
              type="button"
              @click="loadDashboard(true)"
              :disabled="isLoading"
              class="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
              style="background: #22d3ee; color: #082f49"
            >
              {{ isLoading ? 'Actualizando...' : 'Actualizar' }}
            </button>

            <button
              type="button"
              @click="openReports"
              class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-[1px]"
              style="
                background: #ffffff;
                color: #0f172a;
                border: 1px solid #dbe5ef;
                box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
              "
            >
              <span>📊</span>
              <span>Informes</span>
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="error"
        class="mb-6 rounded-2xl px-4 py-3 text-sm"
        style="
          background: rgba(239, 68, 68, 0.1);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.3);
        "
      >
        {{ error }}
      </div>

      <div
        v-if="isLoading && !dashboard"
        class="rounded-2xl px-4 py-10 text-center"
        style="
          background: var(--bg-panel);
          color: var(--text-soft);
          border: 1px solid var(--border-main);
        "
      >
        Cargando dashboard operativo...
      </div>

      <template v-else-if="dashboard">
        <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article
            class="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br p-5 shadow-xl"
            :class="getSummaryCardClass('pending')"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-white/80">Tickets en Fila</p>
                <p class="mt-3 text-4xl font-bold text-white">{{ summary.pending }}</p>
              </div>
              <div class="rounded-2xl bg-white/15 px-3 py-2 text-2xl">🎫</div>
            </div>
          </article>

          <article
            class="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br p-5 shadow-xl"
            :class="getSummaryCardClass('progress')"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-white/80">En Progreso</p>
                <p class="mt-3 text-4xl font-bold text-white">{{ summary.inProgress }}</p>
              </div>
              <div class="rounded-2xl bg-white/15 px-3 py-2 text-2xl">🛠️</div>
            </div>
          </article>

          <article
            class="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br p-5 shadow-xl"
            :class="getSummaryCardClass('closed')"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-white/80">Cerrados Hoy</p>
                <p class="mt-3 text-4xl font-bold text-white">{{ summary.closedToday }}</p>
              </div>
              <div class="rounded-2xl bg-white/15 px-3 py-2 text-2xl">✅</div>
            </div>
          </article>

          <article
            class="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br p-5 shadow-xl"
            :class="getSummaryCardClass('agents')"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-white/80">Agentes Activos</p>
                <p class="mt-3 text-4xl font-bold text-white">{{ summary.activeAgents }}</p>
              </div>
              <div class="rounded-2xl bg-white/15 px-3 py-2 text-2xl">👥</div>
            </div>
          </article>
        </div>

        <div
          class="mb-6 grid grid-cols-1 gap-6"
          :class="isGlobalScope ? 'xl:grid-cols-2' : 'xl:grid-cols-1'"
        >
          <section
            v-if="isGlobalScope"
            class="rounded-3xl shadow-2xl backdrop-blur"
            style="background: var(--bg-panel); border: 1px solid var(--border-main)"
          >
            <div class="border-b px-5 py-4" style="border-color: var(--border-main)">
              <h2 class="text-lg font-semibold" style="color: var(--text-main)">Cola por Área</h2>
              <p class="mt-1 text-sm" style="color: var(--text-soft)">
                Vista consolidada de tickets pendientes y en atención.
              </p>
            </div>

            <div v-if="queuesByArea.length" class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead>
                  <tr style="background: var(--bg-soft); color: var(--text-soft)">
                    <th class="px-5 py-3 text-left font-semibold">Área</th>
                    <th class="px-5 py-3 text-left font-semibold">En Fila</th>
                    <th class="px-5 py-3 text-left font-semibold">En Progreso</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in queuesByArea"
                    :key="row.area || 'sin-area'"
                    class="transition"
                    style="border-top: 1px solid var(--border-main)"
                  >
                    <td class="px-5 py-4" style="color: var(--text-main)">
                      {{ normalizeArea(row.area) }}
                    </td>
                    <td class="px-5 py-4" style="color: var(--text-soft)">
                      {{ row.pending }}
                    </td>
                    <td class="px-5 py-4" style="color: var(--text-soft)">
                      {{ row.inProgress }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-else class="px-5 py-8 text-sm" style="color: var(--text-soft)">
              No hay datos de cola por área.
            </div>
          </section>

          <section
            class="rounded-3xl shadow-2xl backdrop-blur"
            style="background: var(--bg-panel); border: 1px solid var(--border-main)"
          >
            <div
              class="border-b px-5 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
              style="border-color: var(--border-main)"
            >
              <div>
                <h2 class="text-lg font-semibold" style="color: var(--text-main)">
                  Agentes del Alcance
                </h2>
                <p class="mt-1 text-sm" style="color: var(--text-soft)">
                  Personal disponible para atención dentro de este panel.
                </p>
              </div>

              <div v-if="isSuperAdminScope" class="min-w-[220px]">
                <select
                  v-model="agentAreaFilter"
                  class="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style="
                    background: var(--bg-soft);
                    color: var(--text-main);
                    border: 1px solid var(--border-main);
                  "
                >
                  <option value="ALL">Todas las áreas</option>
                  <option v-for="area in availableAgentAreas" :key="area" :value="area">
                    {{ area }}
                  </option>
                </select>
              </div>
            </div>

            <div
              v-if="filteredAgents.length"
              class="divide-y"
              style="divide-color: var(--border-main)"
            >
              <article
                v-for="agent in paginatedAgents"
                :key="agent.id"
                class="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
                style="border-top: 1px solid var(--border-main)"
              >
                <div class="flex items-center gap-4">
                  <div
                    class="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold"
                    style="background: rgba(6, 182, 212, 0.15); color: #67e8f9"
                  >
                    {{ getInitials(agent.name) }}
                  </div>

                  <div>
                    <p class="font-semibold" style="color: var(--text-main)">{{ agent.name }}</p>
                    <p class="text-sm" style="color: var(--text-soft)">{{ agent.email }}</p>
                    <p class="mt-1 text-xs" style="color: var(--text-muted)">
                      {{ agent.roles.join(' · ') || 'Sin roles' }}
                    </p>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset"
                    style="
                      background: var(--bg-soft);
                      color: var(--text-soft);
                      border: 1px solid var(--border-main);
                    "
                  >
                    {{ normalizeArea(agent.area) }}
                  </span>

                  <span
                    class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset"
                    style="
                      background: var(--bg-soft);
                      color: var(--text-soft);
                      border: 1px solid var(--border-main);
                    "
                  >
                    {{ agent.activeTickets }}
                    {{ agent.activeTickets === 1 ? 'ticket activo' : 'tickets activos' }}
                  </span>

                  <span
                    class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                    :class="getAgentStatusClass(agent.activeTickets)"
                  >
                    {{ getAgentStatusText(agent.activeTickets) }}
                  </span>
                </div>
              </article>
            </div>
            <div
              v-if="filteredAgents.length"
              class="flex items-center justify-between border-t px-5 py-3"
              style="border-color: var(--border-main)"
            >
              <p class="text-xs" style="color: var(--text-soft)">
                Página {{ agentsPage }} de {{ agentsTotalPages }}
              </p>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                  style="
                    background: var(--bg-soft);
                    color: var(--text-main);
                    border: 1px solid var(--border-main);
                  "
                  :disabled="agentsPage <= 1"
                  @click="goToAgentsPage(agentsPage - 1)"
                >
                  Anterior
                </button>

                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                  style="
                    background: var(--bg-soft);
                    color: var(--text-main);
                    border: 1px solid var(--border-main);
                  "
                  :disabled="agentsPage >= agentsTotalPages"
                  @click="goToAgentsPage(agentsPage + 1)"
                >
                  Siguiente
                </button>
              </div>
            </div>
            <div v-else class="px-5 py-8 text-sm" style="color: var(--text-soft)">
              No hay agentes disponibles para mostrar.
            </div>
          </section>
        </div>

        <div class="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section
            class="rounded-3xl shadow-2xl backdrop-blur"
            style="background: var(--bg-panel); border: 1px solid var(--border-main)"
          >
            <div class="border-b px-5 py-4" style="border-color: var(--border-main)">
              <h2 class="text-lg font-semibold" style="color: var(--text-main)">Tickets en Fila</h2>
              <p class="mt-1 text-sm" style="color: var(--text-soft)">
                Tickets pendientes por ser atendidos.
              </p>
            </div>

            <div v-if="pendingTickets.length" class="overflow-x-auto">
              <table class="min-w-[900px] w-full text-sm">
                <thead>
                  <tr style="background: var(--bg-soft); color: var(--text-soft)">
                    <th class="px-5 py-3 text-left font-semibold">Ticket</th>
                    <th class="px-5 py-3 text-left font-semibold">Asunto</th>
                    <th class="px-5 py-3 text-left font-semibold">Cliente</th>
                    <th class="px-5 py-3 text-left font-semibold">Área</th>
                    <th class="px-5 py-3 text-left font-semibold">Posición</th>
                    <th class="px-5 py-3 text-left font-semibold">Espera</th>
                    <th class="px-5 py-3 text-left font-semibold">Creado</th>
                    <th class="px-5 py-3 text-left font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="ticket in paginatedPendingTickets"
                    :key="ticket.id"
                    style="border-top: 1px solid var(--border-main)"
                  >
                    <td class="px-5 py-4 font-semibold" style="color: #22d3ee">#{{ ticket.id }}</td>
                    <td class="px-5 py-4" style="color: var(--text-main)">{{ ticket.subject }}</td>
                    <td class="px-5 py-4" style="color: var(--text-soft)">
                      {{ ticket.requesterName }}
                    </td>
                    <td class="px-5 py-4" style="color: var(--text-soft)">
                      {{ normalizeArea(ticket.area) }}
                    </td>
                    <td class="px-5 py-4" style="color: var(--text-soft)">
                      {{ ticket.queuePosition }}
                    </td>
                    <td class="px-5 py-4" style="color: var(--text-soft)">
                      {{ formatMinutes(ticket.waitMinutes) }}
                    </td>
                    <td class="px-5 py-4" style="color: var(--text-soft)">
                      {{ formatDate(ticket.createdAt) }}
                    </td>
                    <td class="px-5 py-4">
                      <button
                        type="button"
                        @click="openTicket(ticket.id)"
                        class="rounded-xl px-3 py-2 text-xs font-semibold transition"
                        style="background: #22d3ee; color: #082f49"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              v-if="pendingTickets.length"
              class="flex items-center justify-between border-t px-5 py-3"
              style="border-color: var(--border-main)"
            >
              <p class="text-xs" style="color: var(--text-soft)">
                Página {{ pendingPage }} de {{ pendingTotalPages }}
              </p>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                  style="
                    background: var(--bg-soft);
                    color: var(--text-main);
                    border: 1px solid var(--border-main);
                  "
                  :disabled="pendingPage <= 1"
                  @click="goToPendingPage(pendingPage - 1)"
                >
                  Anterior
                </button>

                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                  style="
                    background: var(--bg-soft);
                    color: var(--text-main);
                    border: 1px solid var(--border-main);
                  "
                  :disabled="pendingPage >= pendingTotalPages"
                  @click="goToPendingPage(pendingPage + 1)"
                >
                  Siguiente
                </button>
              </div>
            </div>

            <div v-else class="px-5 py-8 text-sm" style="color: var(--text-soft)">
              No hay tickets pendientes.
            </div>
          </section>

          <section
            class="rounded-3xl shadow-2xl backdrop-blur"
            style="background: var(--bg-panel); border: 1px solid var(--border-main)"
          >
            <div class="border-b px-5 py-4" style="border-color: var(--border-main)">
              <h2 class="text-lg font-semibold" style="color: var(--text-main)">
                Tickets en Progreso
              </h2>
              <p class="mt-1 text-sm" style="color: var(--text-soft)">
                Casos actualmente en atención por los agentes.
              </p>
            </div>

            <div v-if="inProgressTickets.length" class="overflow-x-auto">
              <table class="min-w-[860px] w-full text-sm">
                <thead>
                  <tr style="background: var(--bg-soft); color: var(--text-soft)">
                    <th class="px-5 py-3 text-left font-semibold">Ticket</th>
                    <th class="px-5 py-3 text-left font-semibold">Asunto</th>
                    <th class="px-5 py-3 text-left font-semibold">Agente</th>
                    <th class="px-5 py-3 text-left font-semibold">Área</th>
                    <th class="px-5 py-3 text-left font-semibold">En Atención</th>
                    <th class="px-5 py-3 text-left font-semibold">Última Actividad</th>
                    <th class="px-5 py-3 text-left font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="ticket in paginatedInProgressTickets"
                    :key="ticket.id"
                    style="border-top: 1px solid var(--border-main)"
                  >
                    <td class="px-5 py-4 font-semibold" style="color: #22d3ee">#{{ ticket.id }}</td>
                    <td class="px-5 py-4" style="color: var(--text-main)">{{ ticket.subject }}</td>
                    <td class="px-5 py-4" style="color: var(--text-soft)">
                      {{ ticket.assignedToName }}
                    </td>
                    <td class="px-5 py-4" style="color: var(--text-soft)">
                      {{ normalizeArea(ticket.area) }}
                    </td>
                    <td class="px-5 py-4" style="color: var(--text-soft)">
                      {{ formatMinutes(ticket.attentionMinutes) }}
                    </td>
                    <td class="px-5 py-4" style="color: var(--text-soft)">
                      {{ formatDate(ticket.updatedAt) }}
                    </td>
                    <td class="px-5 py-4">
                      <button
                        type="button"
                        @click="openTicket(ticket.id)"
                        class="rounded-xl px-3 py-2 text-xs font-semibold transition"
                        style="background: #22d3ee; color: #082f49"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              v-if="inProgressTickets.length"
              class="flex items-center justify-between border-t px-5 py-3"
              style="border-color: var(--border-main)"
            >
              <p class="text-xs" style="color: var(--text-soft)">
                Página {{ inProgressPage }} de {{ inProgressTotalPages }}
              </p>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                  style="
                    background: var(--bg-soft);
                    color: var(--text-main);
                    border: 1px solid var(--border-main);
                  "
                  :disabled="inProgressPage <= 1"
                  @click="goToInProgressPage(inProgressPage - 1)"
                >
                  Anterior
                </button>

                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                  style="
                    background: var(--bg-soft);
                    color: var(--text-main);
                    border: 1px solid var(--border-main);
                  "
                  :disabled="inProgressPage >= inProgressTotalPages"
                  @click="goToInProgressPage(inProgressPage + 1)"
                >
                  Siguiente
                </button>
              </div>
            </div>

            <div v-else class="px-5 py-8 text-sm" style="color: var(--text-soft)">
              No hay tickets en progreso.
            </div>
          </section>
        </div>

        <div class="grid grid-cols-1 gap-6 xl:grid-cols-3 pb-4">
          <section
            class="xl:col-span-2 rounded-3xl shadow-2xl backdrop-blur"
            style="background: var(--bg-panel); border: 1px solid var(--border-main)"
          >
            <div class="border-b px-5 py-4" style="border-color: var(--border-main)">
              <h2 class="text-lg font-semibold" style="color: var(--text-main)">
                Tickets Cerrados Recientes
              </h2>
              <p class="mt-1 text-sm" style="color: var(--text-soft)">
                Historial reciente con calificación de atención del cliente.
              </p>
            </div>

            <div v-if="closedTickets.length" class="overflow-x-auto">
              <table class="min-w-[1100px] w-full text-sm">
                <thead>
                  <tr style="background: var(--bg-soft); color: var(--text-soft)">
                    <th class="px-5 py-3 text-left font-semibold">Ticket</th>
                    <th class="px-5 py-3 text-left font-semibold">Asunto</th>
                    <th class="px-5 py-3 text-left font-semibold">Cliente</th>
                    <th class="px-5 py-3 text-left font-semibold">Agente</th>
                    <th class="px-5 py-3 text-left font-semibold">Área</th>
                    <th class="px-5 py-3 text-left font-semibold">Cerrado</th>
                    <th class="px-5 py-3 text-left font-semibold">Calificación</th>
                    <th class="px-5 py-3 text-left font-semibold">Comentario</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="ticket in paginatedClosedTickets"
                    :key="ticket.id"
                    style="border-top: 1px solid var(--border-main)"
                  >
                    <td class="px-5 py-4 font-semibold" style="color: #22d3ee">#{{ ticket.id }}</td>
                    <td class="px-5 py-4" style="color: var(--text-main)">{{ ticket.subject }}</td>
                    <td class="px-5 py-4" style="color: var(--text-soft)">
                      {{ ticket.requesterName }}
                    </td>
                    <td class="px-5 py-4" style="color: var(--text-soft)">
                      {{ ticket.assignedToName }}
                    </td>
                    <td class="px-5 py-4" style="color: var(--text-soft)">
                      {{ normalizeArea(ticket.area) }}
                    </td>
                    <td class="px-5 py-4" style="color: var(--text-soft)">
                      {{ formatDate(ticket.closedAt) }}
                    </td>
                    <td class="px-5 py-4">
                      <div v-if="ticket.satisfaction" class="flex flex-col">
                        <span class="text-base tracking-wide text-amber-400">
                          {{ stars(ticket.satisfaction.rating) }}
                        </span>
                        <span class="text-xs" style="color: var(--text-muted)">
                          {{ ticket.satisfaction.rating }}/5
                        </span>
                      </div>
                      <span v-else style="color: var(--text-muted)">Sin calificar</span>
                    </td>
                    <td class="px-5 py-4" style="color: var(--text-soft)">
                      {{ ticket.satisfaction?.comment || 'Sin comentario' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              v-if="closedTickets.length"
              class="flex items-center justify-between border-t px-5 py-3"
              style="border-color: var(--border-main)"
            >
              <p class="text-xs" style="color: var(--text-soft)">
                Página {{ closedPage }} de {{ closedTotalPages }}
              </p>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                  style="
                    background: var(--bg-soft);
                    color: var(--text-main);
                    border: 1px solid var(--border-main);
                  "
                  :disabled="closedPage <= 1"
                  @click="goToClosedPage(closedPage - 1)"
                >
                  Anterior
                </button>

                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                  style="
                    background: var(--bg-soft);
                    color: var(--text-main);
                    border: 1px solid var(--border-main);
                  "
                  :disabled="closedPage >= closedTotalPages"
                  @click="goToClosedPage(closedPage + 1)"
                >
                  Siguiente
                </button>
              </div>
            </div>

            <div v-else class="px-5 py-8 text-sm" style="color: var(--text-soft)">
              No hay tickets cerrados recientes.
            </div>
          </section>

          <section
            class="rounded-3xl shadow-2xl backdrop-blur"
            style="background: var(--bg-panel); border: 1px solid var(--border-main)"
          >
            <div class="border-b px-5 py-4" style="border-color: var(--border-main)">
              <h2 class="text-lg font-semibold" style="color: var(--text-main)">
                Top Calificaciones
              </h2>
              <p class="mt-1 text-sm" style="color: var(--text-soft)">
                Mejores atenciones registradas recientemente.
              </p>
            </div>

            <div
              v-if="sortedTopRatedTickets.length"
              class="divide-y"
              style="divide-color: var(--border-main)"
            >
              <article
                v-for="ticket in paginatedTopRatedTickets"
                :key="ticket.id"
                class="px-5 py-4"
                style="border-top: 1px solid var(--border-main)"
              >
                <p class="font-semibold" style="color: var(--text-main)">
                  #{{ ticket.id }} · {{ ticket.subject }}
                </p>
                <p class="mt-1 text-sm" style="color: var(--text-soft)">
                  {{ ticket.requesterName }} · {{ ticket.assignedToName }}
                </p>
                <div class="mt-3 flex items-center justify-between">
                  <span class="text-base tracking-wide text-amber-400">
                    {{ stars(ticket.satisfaction?.rating) }}
                  </span>
                  <span class="text-sm font-semibold" style="color: var(--text-soft)">
                    {{ ticket.satisfaction?.rating }}/5
                  </span>
                </div>
              </article>
            </div>

            <div
              v-if="sortedTopRatedTickets.length"
              class="flex items-center justify-between border-t px-5 py-3"
              style="border-color: var(--border-main)"
            >
              <p class="text-xs" style="color: var(--text-soft)">
                Página {{ topRatedPage }} de {{ topRatedTotalPages }}
              </p>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                  style="
                    background: var(--bg-soft);
                    color: var(--text-main);
                    border: 1px solid var(--border-main);
                  "
                  :disabled="topRatedPage <= 1"
                  @click="goToTopRatedPage(topRatedPage - 1)"
                >
                  Anterior
                </button>

                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                  style="
                    background: var(--bg-soft);
                    color: var(--text-main);
                    border: 1px solid var(--border-main);
                  "
                  :disabled="topRatedPage >= topRatedTotalPages"
                  @click="goToTopRatedPage(topRatedPage + 1)"
                >
                  Siguiente
                </button>
              </div>
            </div>

            <div v-else class="px-5 py-8 text-sm" style="color: var(--text-soft)">
              Aún no hay tickets calificados.
            </div>
          </section>
        </div>
      </template>
    </div>
  </section>
</template>
