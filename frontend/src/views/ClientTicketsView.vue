<!-- src/views/ClientTicketsView.vue -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import SettingsModal from '../components/settings/SettingsModal.vue';
import { apiFetch } from '../lib/api';

interface ClientTicket {
  id: number;
  subject?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  area?: string | null;
  assignedToId?: number | null;
  assignedToName?: string | null;
}

const showLogoutModal = ref(false);

function confirmLogout() {
  showLogoutModal.value = true;
}
function cancelLogout() {
  showLogoutModal.value = false;
}

const router = useRouter();
const { token, user, initAuth, logout } = useAuth();

function doLogout() {
  logout();
  router.push('/login');
}

/* ===========================
   SETTINGS MODAL
=========================== */
const openSettings = ref(false);

const tickets = ref<ClientTicket[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'PENDING', label: 'Abiertos' },
  { value: 'IN_PROGRESS', label: 'En progreso' },
  { value: 'RESOLVED', label: 'Resueltos' },
  { value: 'CLOSED', label: 'Cerrados' },
] as const;

type StatusFilterValue = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

const statusFilter = ref<StatusFilterValue>('ALL');

/* ===========================
   FILTRO ÁREA (CLIENTE)
=========================== */
const areaFilter = ref<string>('ALL');

const availableAreas = computed(() => {
  const set = new Set<string>();

  tickets.value.forEach(t => {
    const name = (t.area ?? '').trim();
    if (name) set.add(name);
  });

  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es-CO', { sensitivity: 'base' }));
});

function formatDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/* ===========================
   FILTRADO: STATUS + ÁREA
=========================== */
const filteredTickets = computed(() => {
  let list = [...tickets.value];

  if (statusFilter.value !== 'ALL') {
    list = list.filter(t => t.status === statusFilter.value);
  }

  if (areaFilter.value !== 'ALL') {
    list = list.filter(t => (t.area ?? '').trim() === areaFilter.value);
  }

  return list.sort((a, b) => {
    const ta = a.updatedAt || a.createdAt;
    const tb = b.updatedAt || b.createdAt;
    const va = ta ? new Date(ta).getTime() : 0;
    const vb = tb ? new Date(tb).getTime() : 0;
    return vb - va;
  });
});

const totalTickets = computed(() => tickets.value.length);
const openCount = computed(() => tickets.value.filter(t => t.status === 'PENDING').length);
const inProgressCount = computed(
  () => tickets.value.filter(t => t.status === 'IN_PROGRESS').length
);
const resolvedCount = computed(() => tickets.value.filter(t => t.status === 'RESOLVED').length);
const closedCount = computed(() => tickets.value.filter(t => t.status === 'CLOSED').length);
const filteredCount = computed(() => filteredTickets.value.length);

async function loadMyTickets() {
  error.value = null;

  const jwt = (token.value ?? '').trim();
  if (!jwt) {
    error.value = 'No hay token JWT. Inicia sesión nuevamente.';
    return;
  }

  isLoading.value = true;
  try {
    const res = await apiFetch('http://localhost:3000/tickets/my');

    if (!res.ok) {
      throw new Error(`Error ${res.status} al cargar tus tickets`);
    }

    const data = await res.json();
    tickets.value = Array.isArray(data) ? data : [];

    if (areaFilter.value !== 'ALL' && !availableAreas.value.includes(areaFilter.value)) {
      areaFilter.value = 'ALL';
    }
  } catch (e: any) {
    console.error(e);
    error.value = e.message ?? 'No se pudo cargar la lista de tickets.';
  } finally {
    isLoading.value = false;
  }
}

function goToNewTicket() {
  router.push('/cliente/nuevo-ticket');
}

function openChat(ticketId: number) {
  router.push(`/cliente/ticket/${ticketId}`);
}

onMounted(() => {
  initAuth();

  if (!(token.value ?? '').trim()) {
    router.push({ name: 'login' });
    return;
  }

  loadMyTickets();
});
</script>

<template>
  <main
    class="min-h-screen flex flex-col"
    :style="{
      background: 'var(--bg-main)',
      color: 'var(--text-main)',
    }"
  >
    <!-- Filtros -->
    <section
      class="px-6 pt-4 pb-3 border-b"
      :style="{
        borderColor: 'var(--border-main)',
        background: 'var(--bg-main)',
      }"
    >
      <div class="flex flex-col gap-2">
        <!-- Status pills -->
        <div class="flex flex-wrap gap-2">
          <button
            v-for="f in STATUS_FILTERS"
            :key="f.value"
            type="button"
            class="px-3 py-1 rounded-full border text-xs font-semibold transition-colors"
            :style="
              statusFilter === f.value
                ? {
                    background: '#10b981',
                    color: '#ffffff',
                    borderColor: '#10b981',
                  }
                : {
                    background: 'transparent',
                    color: 'var(--text-soft)',
                    borderColor: 'var(--border-main)',
                  }
            "
            @click="statusFilter = f.value"
          >
            <template v-if="f.value === 'ALL'">Todos ({{ totalTickets }})</template>
            <template v-else-if="f.value === 'PENDING'">Abiertos ({{ openCount }})</template>
            <template v-else-if="f.value === 'IN_PROGRESS'">
              En progreso ({{ inProgressCount }})
            </template>
            <template v-else-if="f.value === 'RESOLVED'">
              Resueltos ({{ resolvedCount }})
            </template>
            <template v-else-if="f.value === 'CLOSED'">Cerrados ({{ closedCount }})</template>
          </button>
        </div>

        <!-- Select de áreas -->
        <div class="flex flex-col gap-2 md:flex-row md:items-center">
          <select
            v-model="areaFilter"
            class="w-full md:w-[320px] rounded-md px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-emerald-500"
            :style="{
              background: 'var(--input-bg)',
              borderColor: 'var(--border-main)',
              color: 'var(--text-main)',
            }"
          >
            <option value="ALL">Todas las áreas</option>
            <option v-for="a in availableAreas" :key="a" :value="a">
              {{ a }}
            </option>
          </select>

          <p class="text-[11px]" :style="{ color: 'var(--text-soft)' }">
            {{ filteredCount }} de {{ totalTickets }} tickets mostrados.
          </p>
        </div>
      </div>
    </section>

    <!-- Lista de tickets -->
    <section class="flex-1 px-6 py-4 space-y-3">
      <div v-if="filteredTickets.length === 0 && !isLoading" class="mt-6">
        <p class="text-sm" :style="{ color: 'var(--text-soft)' }">
          No tienes tickets que coincidan con los filtros seleccionados.
        </p>
      </div>

      <article
        v-for="t in filteredTickets"
        :key="t.id"
        class="border rounded-lg px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between transition"
        :style="{
          borderColor: 'var(--border-main)',
          background: 'var(--bg-panel)',
        }"
      >
        <div class="space-y-1 min-w-0">
          <h2 class="text-sm md:text-base font-semibold break-words">
            #{{ t.id }} — {{ t.subject || 'Sin asunto' }}
          </h2>

          <p class="text-[11px]" :style="{ color: 'var(--text-soft)' }">
            Área:
            <span :style="{ color: 'var(--text-main)' }">
              {{ t.area || 'Sin área asignada' }}
            </span>
          </p>

          <p class="text-[11px]" :style="{ color: 'var(--text-soft)' }">
            Atendido por:
            <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
              {{ t.assignedToName ? t.assignedToName : 'Sin asignar' }}
            </span>
          </p>

          <p class="text-[11px]" :style="{ color: 'var(--text-muted)' }">
            Última actualización:
            <span :style="{ color: 'var(--text-soft)' }">
              {{ formatDate(t.updatedAt || t.createdAt) }}
            </span>
          </p>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <span
            class="inline-flex items-center px-3 py-1 rounded-full border text-[11px] font-semibold"
            :style="
              t.status === 'PENDING'
                ? {
                    borderColor: '#10b981',
                    color: '#10b981',
                    background: 'rgba(16,185,129,0.08)',
                  }
                : t.status === 'IN_PROGRESS'
                ? {
                    borderColor: '#f59e0b',
                    color: '#d97706',
                    background: 'rgba(245,158,11,0.08)',
                  }
                : t.status === 'RESOLVED'
                ? {
                    borderColor: '#0ea5e9',
                    color: '#0284c7',
                    background: 'rgba(14,165,233,0.08)',
                  }
                : {
                    borderColor: 'var(--border-main)',
                    color: 'var(--text-soft)',
                    background: 'transparent',
                  }
            "
          >
            {{
              t.status === 'PENDING'
                ? 'ABIERTO'
                : t.status === 'IN_PROGRESS'
                ? 'EN PROGRESO'
                : t.status === 'RESOLVED'
                ? 'RESUELTO'
                : t.status === 'CLOSED'
                ? 'CERRADO'
                : 'SIN ESTADO'
            }}
          </span>

          <button
            type="button"
            class="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-xs font-semibold text-white"
            @click="openChat(t.id)"
          >
            Abrir chat
          </button>
        </div>
      </article>
    </section>

    <!-- Settings Modal -->
    <SettingsModal
      v-if="openSettings"
      :authToken="(token || '').trim()"
      @close="openSettings = false"
    />

    <!-- Modal de confirmación para cerrar sesión -->
    <div
      v-if="showLogoutModal"
      class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
    >
      <div
        class="w-full max-w-sm rounded-lg p-6 shadow-xl border"
        :style="{
          background: 'var(--bg-panel)',
          borderColor: 'var(--border-main)',
        }"
      >
        <h2 class="text-lg font-semibold mb-2" :style="{ color: 'var(--text-main)' }">
          ¿Cerrar sesión?
        </h2>

        <p class="text-sm mb-4" :style="{ color: 'var(--text-soft)' }">
          ¿Estás seguro de que deseas cerrar sesión?
        </p>

        <div class="flex justify-end gap-3">
          <button
            @click="cancelLogout"
            class="px-3 py-1 rounded-md text-sm border"
            :style="{
              background: 'var(--bg-soft)',
              borderColor: 'var(--border-main)',
              color: 'var(--text-main)',
            }"
          >
            Cancelar
          </button>

          <button
            @click="doLogout"
            class="px-3 py-1 rounded-md bg-red-500 hover:bg-red-600 text-sm font-semibold text-white"
          >
            Sí, cerrar sesión
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
