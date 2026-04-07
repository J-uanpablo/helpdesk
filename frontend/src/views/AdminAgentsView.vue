<!-- src/views/AdminAgentsView.vue -->
<script setup lang="ts">
import { reactive, ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { apiFetch } from '../lib/api';

interface AgentRow {
  id: number;
  name: string;
  email: string;
  cargo?: string | null;
  supportArea?: string | null;
  isActive: boolean;
  roles: string[];
  mainRole: string;
  createdAt: string;
}

interface SupportArea {
  id: number;
  name: string;
  isActive: boolean;
}

const router = useRouter();
const { token, initAuth } = useAuth();

const agents = ref<AgentRow[]>([]);
const supportAreas = ref<SupportArea[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

// =============================
// ESTADO DEL MENÚ DESPLEGABLE DE ACCIONES
// =============================
const openMenuId = ref<number | null>(null);

function toggleMenu(id: number) {
  openMenuId.value = openMenuId.value === id ? null : id;
}

function closeMenu() {
  openMenuId.value = null;
}

// =============================
// FILTROS
// =============================
const searchText = ref('');
const areaFilter = ref('all');
const roleFilter = ref('all');
const onlyActive = ref(false);

// =============================
// PAGINACIÓN
// =============================
const page = ref(1);
const pageSize = 8;

// =============================
// MODALES
// =============================
const showNewModal = ref(false);
const showEditModal = ref(false);
const showDeleteModal = ref(false);

// =============================
// TOGGLES PASSWORD
// =============================
const showNewAgentPassword = ref(false);
const showEditAgentPassword = ref(false);

// =============================
// FORMULARIOS
// =============================
const newAgentForm = reactive({
  name: '',
  email: '',
  cargo: '',
  password: '',
  role: 'support',
  supportArea: '',
  isActive: true,
});

const editAgentForm = reactive({
  id: 0,
  name: '',
  email: '',
  cargo: '',
  password: '',
  role: 'support',
  supportArea: '',
  isActive: true,
});

// =============================
// DELETE TARGET
// =============================
const deleteAgentTarget = reactive({
  id: 0,
  name: '',
  email: '',
  mainRole: '',
});

// =============================
// COMPUTED
// =============================
const filteredAgents = computed(() => {
  const text = searchText.value.trim().toLowerCase();

  return agents.value.filter(a => {
    const matchesText =
      !text || a.name.toLowerCase().includes(text) || a.email.toLowerCase().includes(text);

    const matchesArea =
      areaFilter.value === 'all' ||
      (a.supportArea || '').toLowerCase() === areaFilter.value.toLowerCase();

    const matchesRole = roleFilter.value === 'all' || a.mainRole === roleFilter.value;
    const matchesActive = !onlyActive.value || a.isActive;

    return matchesText && matchesArea && matchesRole && matchesActive;
  });
});

const totalAgents = computed(() => agents.value.length);

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(filteredAgents.value.length / pageSize));
});

const paginatedAgents = computed(() => {
  const start = (page.value - 1) * pageSize;
  const end = start + pageSize;
  return filteredAgents.value.slice(start, end);
});

function goToPage(newPage: number) {
  if (newPage < 1 || newPage > totalPages.value) return;
  page.value = newPage;
}

watch([searchText, areaFilter, roleFilter, onlyActive], () => {
  page.value = 1;
});

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// =============================
// LOAD DATA
// =============================
async function loadAgentsAndAreas() {
  if (!token.value) return;
  error.value = null;
  isLoading.value = true;

  try {
    const [agentsRes, areasRes] = await Promise.all([
      apiFetch('http://localhost:3000/users/agents'),
      apiFetch('http://localhost:3000/support-areas'),
    ]);

    if (!agentsRes.ok) throw new Error('Error cargando agentes');
    if (!areasRes.ok) throw new Error('Error cargando áreas');

    agents.value = await agentsRes.json();
    supportAreas.value = await areasRes.json();
  } catch (err: any) {
    error.value = err.message || 'Error al cargar datos';
  } finally {
    isLoading.value = false;
  }
}

// =============================
// CREATE
// =============================
async function createAgent() {
  if (!token.value) return;
  error.value = null;

  try {
    const res = await apiFetch('http://localhost:3000/users/agents', {
      method: 'POST',
      body: JSON.stringify({
        name: newAgentForm.name.trim(),
        email: newAgentForm.email.trim(),
        cargo: newAgentForm.cargo.trim() || undefined,
        password: newAgentForm.password,
        role: newAgentForm.role,
        supportArea: newAgentForm.supportArea || undefined,
        isActive: newAgentForm.isActive,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Error creando agente');
    }

    const created = await res.json();
    agents.value.push(created);

    Object.assign(newAgentForm, {
      name: '',
      email: '',
      cargo: '',
      password: '',
      role: 'support',
      supportArea: '',
      isActive: true,
    });

    showNewAgentPassword.value = false;
    showNewModal.value = false;
  } catch (err: any) {
    error.value = err.message || 'Error creando agente';
  }
}

// =============================
// EDIT
// =============================
function openEditAgent(a: AgentRow) {
  closeMenu();

  Object.assign(editAgentForm, {
    id: a.id,
    name: a.name,
    email: a.email,
    cargo: a.cargo || '',
    password: '',
    role: a.mainRole,
    supportArea: a.supportArea || '',
    isActive: a.isActive,
  });

  showEditAgentPassword.value = false;
  showEditModal.value = true;
}

async function updateAgent() {
  if (!token.value) return;
  error.value = null;

  try {
    const payload: any = {
      name: editAgentForm.name.trim(),
      email: editAgentForm.email.trim(),
      cargo: editAgentForm.cargo.trim() || undefined,
      role: editAgentForm.role,
      supportArea: editAgentForm.supportArea || undefined,
      isActive: editAgentForm.isActive,
    };

    if (editAgentForm.password) {
      payload.password = editAgentForm.password;
    }

    const res = await apiFetch(`http://localhost:3000/users/agents/${editAgentForm.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Error actualizando agente');
    }

    const updated = await res.json();
    const idx = agents.value.findIndex(a => a.id === updated.id);
    if (idx !== -1) agents.value[idx] = updated;

    showEditModal.value = false;
  } catch (err: any) {
    error.value = err.message || 'Error actualizando agente';
  }
}

// =============================
// TOGGLE ACTIVE
// =============================
async function toggleAgentActive(a: AgentRow) {
  closeMenu();
  if (!token.value) return;
  error.value = null;

  try {
    const res = await apiFetch(`http://localhost:3000/users/agents/${a.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !a.isActive }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Error cambiando estado');
    }

    const updated = await res.json();
    const idx = agents.value.findIndex(x => x.id === updated.id);
    if (idx !== -1) agents.value[idx] = updated;
  } catch (err: any) {
    error.value = err.message || 'Error cambiando estado';
  }
}

// =============================
// DELETE
// =============================
function openDeleteAgent(a: AgentRow) {
  closeMenu();
  Object.assign(deleteAgentTarget, {
    id: a.id,
    name: a.name,
    email: a.email,
    mainRole: a.mainRole,
  });
  showDeleteModal.value = true;
}

async function confirmDeleteAgent() {
  if (!token.value) return;
  error.value = null;

  try {
    const res = await apiFetch(`http://localhost:3000/users/agents/${deleteAgentTarget.id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Error eliminando agente');
    }

    agents.value = agents.value.filter(a => a.id !== deleteAgentTarget.id);
    showDeleteModal.value = false;
  } catch (err: any) {
    error.value = err.message || 'Error eliminando agente';
  }
}

// =============================
// INIT
// =============================
onMounted(async () => {
  initAuth();

  if (!token.value) {
    router.push({ name: 'login' });
    return;
  }

  await loadAgentsAndAreas();
});
</script>

<template>
  <div class="min-h-screen" :style="{ background: 'var(--bg-main)', color: 'var(--text-main)' }">
    <main class="px-6 py-6 max-w-[1600px] mx-auto">
      <div
        class="w-full rounded-2xl border shadow-[0_0_0_1px_rgba(15,23,42,0.06)] backdrop-blur"
        :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
      >
        <div class="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="text-xs" :style="{ color: 'var(--text-soft)' }">
              Administración de agentes y roles
            </p>
            <h1 class="mt-1 text-2xl font-bold tracking-tight">Administración de agentes</h1>
            <p class="mt-1 text-xs" :style="{ color: 'var(--text-soft)' }">
              Crea y gestiona los usuarios de soporte, administradores y superadministradores.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <div
              class="hidden md:flex items-center gap-2 rounded-xl border px-3 py-2"
              :style="{ background: 'var(--bg-soft)', borderColor: 'var(--border-main)' }"
            >
              <div class="text-[11px]" :style="{ color: 'var(--text-soft)' }">Agentes</div>
              <div class="text-sm font-semibold">{{ totalAgents }}</div>
            </div>

            <button
              type="button"
              @click="showNewModal = true"
              class="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.99]"
              style="background: #10b981"
            >
              <span class="text-base leading-none">＋</span>
              Nuevo agente
            </button>
          </div>
        </div>

        <div class="border-t px-6 py-4" :style="{ borderColor: 'var(--border-main)' }">
          <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div class="flex flex-1 items-center gap-2">
              <span class="text-xs" :style="{ color: 'var(--text-soft)' }">Buscar</span>
              <div class="relative flex-1 max-w-sm">
                <input
                  v-model="searchText"
                  type="text"
                  class="w-full rounded-xl border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  :style="{
                    background: 'var(--input-bg)',
                    borderColor: 'var(--border-main)',
                    color: 'var(--text-main)',
                  }"
                  placeholder="Nombres o correo..."
                />
                <div
                  class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px]"
                  :style="{ color: 'var(--text-muted)' }"
                >
                  ⌘K
                </div>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <div
                class="flex items-center gap-2 rounded-xl border px-3 py-2"
                :style="{ background: 'var(--bg-soft)', borderColor: 'var(--border-main)' }"
              >
                <span class="text-xs" :style="{ color: 'var(--text-soft)' }">Área</span>
                <select
                  v-model="areaFilter"
                  class="rounded-lg border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  :style="{
                    background: 'var(--input-bg)',
                    borderColor: 'var(--border-main)',
                    color: 'var(--text-main)',
                  }"
                >
                  <option value="all">Todas</option>
                  <option
                    v-for="a in Array.from(
                      new Set(agents.map(ag => (ag.supportArea || '').trim()).filter(x => x))
                    )"
                    :key="a"
                    :value="a"
                  >
                    {{ a }}
                  </option>
                </select>
              </div>

              <div
                class="flex items-center gap-2 rounded-xl border px-3 py-2"
                :style="{ background: 'var(--bg-soft)', borderColor: 'var(--border-main)' }"
              >
                <span class="text-xs" :style="{ color: 'var(--text-soft)' }">Rol</span>
                <select
                  v-model="roleFilter"
                  class="rounded-lg border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  :style="{
                    background: 'var(--input-bg)',
                    borderColor: 'var(--border-main)',
                    color: 'var(--text-main)',
                  }"
                >
                  <option value="all">Todos</option>
                  <option value="support">Soporte</option>
                  <option value="admin">Administrador</option>
                  <option value="super-admin">Super admin</option>
                </select>
              </div>

              <label class="flex items-center gap-2 cursor-pointer ml-2">
                <div
                  class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200"
                  :style="{ background: onlyActive ? '#4f46e5' : 'var(--border-main)' }"
                >
                  <span
                    class="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 shadow-sm"
                    :class="onlyActive ? 'translate-x-4' : 'translate-x-1'"
                  />
                </div>
                <input v-model="onlyActive" type="checkbox" class="sr-only" />
                <span class="text-xs font-medium" :style="{ color: 'var(--text-main)' }">
                  Solo activos
                </span>
              </label>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between">
            <p class="text-[11px]" :style="{ color: 'var(--text-muted)' }">
              Mostrando
              <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
                {{ filteredAgents.length }}
              </span>
              de
              <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
                {{ totalAgents }}
              </span>
              agentes.
            </p>
            <p v-if="error" class="text-[11px]" style="color: #f43f5e">{{ error }}</p>
          </div>
        </div>

        <div class="px-6 pb-6">
          <div
            class="overflow-hidden rounded-2xl border"
            :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
          >
            <div
              class="flex items-center justify-between border-b px-4 py-3"
              :style="{ borderColor: 'var(--border-main)' }"
            >
              <div class="text-xs font-semibold" :style="{ color: 'var(--text-main)' }">
                Listado de agentes
              </div>
              <div class="text-[11px]" :style="{ color: 'var(--text-muted)' }">
                Estado:
                <span :style="{ color: 'var(--text-main)' }">
                  {{ onlyActive ? 'Solo activos' : 'Todos' }}
                </span>
              </div>
            </div>

            <div class="overflow-x-auto min-h-[300px]">
              <table class="min-w-full text-xs">
                <thead :style="{ background: 'var(--bg-soft)', color: 'var(--text-soft)' }">
                  <tr>
                    <th class="px-4 py-3 text-left font-semibold">Nombre</th>
                    <th class="px-4 py-3 text-left font-semibold">Correo</th>
                    <th class="px-4 py-3 text-left font-semibold">Cargo</th>
                    <th class="px-4 py-3 text-left font-semibold">Rol</th>
                    <th class="px-4 py-3 text-left font-semibold">Área</th>
                    <th class="px-4 py-3 text-left font-semibold">Estado</th>
                    <th class="px-4 py-3 text-left font-semibold">Creado</th>
                    <th class="px-4 py-3 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  <tr v-if="isLoading" :style="{ borderTop: `1px solid var(--border-main)` }">
                    <td
                      colspan="8"
                      class="px-4 py-10 text-center"
                      :style="{ color: 'var(--text-muted)' }"
                    >
                      Cargando agentes...
                    </td>
                  </tr>

                  <tr
                    v-else-if="!filteredAgents.length"
                    :style="{ borderTop: `1px solid var(--border-main)` }"
                  >
                    <td
                      colspan="8"
                      class="px-4 py-10 text-center"
                      :style="{ color: 'var(--text-muted)' }"
                    >
                      No hay agentes que coincidan con los filtros.
                    </td>
                  </tr>

                  <tr
                    v-for="a in paginatedAgents"
                    :key="a.id"
                    class="transition hover:bg-black/5 dark:hover:bg-white/5"
                    :style="{ borderTop: `1px solid var(--border-main)` }"
                  >
                    <td class="px-4 py-3">
                      <div class="flex flex-col">
                        <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
                          {{ a.name }}
                        </span>
                        <span class="text-[10px]" :style="{ color: 'var(--text-muted)' }">
                          ID: {{ a.id }}
                        </span>
                      </div>
                    </td>

                    <td class="px-4 py-3" :style="{ color: 'var(--text-main)' }">
                      {{ a.email }}
                    </td>

                    <td class="px-4 py-3" :style="{ color: 'var(--text-main)' }">
                      {{ a.cargo || '—' }}
                    </td>

                    <td class="px-4 py-3">
                      <span
                        class="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold border"
                        :style="
                          a.mainRole === 'super-admin'
                            ? {
                                background: 'rgba(139,92,246,0.10)',
                                color: '#8b5cf6',
                                borderColor: 'rgba(139,92,246,0.25)',
                              }
                            : a.mainRole === 'admin'
                            ? {
                                background: 'rgba(14,165,233,0.10)',
                                color: '#0ea5e9',
                                borderColor: 'rgba(14,165,233,0.25)',
                              }
                            : {
                                background: 'rgba(56,189,248,0.1)',
                                color: '#0284c7',
                                borderColor: 'rgba(56,189,248,0.25)',
                              }
                        "
                      >
                        {{
                          a.mainRole === 'super-admin'
                            ? 'Super administrador'
                            : a.mainRole === 'admin'
                            ? 'Administrador'
                            : 'Soporte'
                        }}
                      </span>
                    </td>

                    <td class="px-4 py-3" :style="{ color: 'var(--text-main)' }">
                      {{ a.supportArea || '—' }}
                    </td>

                    <td class="px-4 py-3">
                      <span
                        class="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] border"
                        :style="
                          a.isActive
                            ? {
                                background: 'rgba(16,185,129,0.10)',
                                color: '#10b981',
                                borderColor: 'rgba(16,185,129,0.25)',
                              }
                            : {
                                background: 'var(--bg-soft)',
                                color: 'var(--text-soft)',
                                borderColor: 'var(--border-main)',
                              }
                        "
                      >
                        <span
                          class="h-1.5 w-1.5 rounded-full"
                          :style="{ background: a.isActive ? '#10b981' : '#94a3b8' }"
                        />
                        {{ a.isActive ? 'Activo' : 'Inactivo' }}
                      </span>
                    </td>

                    <td class="px-4 py-3 whitespace-nowrap" :style="{ color: 'var(--text-soft)' }">
                      {{ formatDate(a.createdAt) }}
                    </td>

                    <td class="px-4 py-3 relative">
                      <div class="flex items-center justify-end gap-1">
                        <button
                          class="h-8 w-8 flex items-center justify-center rounded-lg border transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                          :style="{
                            background: 'var(--bg-panel)',
                            borderColor: 'var(--border-main)',
                            color: 'var(--text-main)',
                          }"
                          @click="openEditAgent(a)"
                          title="Editar agente"
                        >
                          <svg
                            class="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            ></path>
                          </svg>
                        </button>

                        <button
                          class="h-8 w-8 flex items-center justify-center rounded-lg border transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                          :style="{
                            background: 'var(--bg-panel)',
                            borderColor: 'var(--border-main)',
                            color: 'var(--text-main)',
                          }"
                          @click="toggleMenu(a.id)"
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                            ></path>
                          </svg>
                        </button>
                      </div>

                      <div
                        v-if="openMenuId === a.id"
                        class="absolute right-6 top-10 w-36 rounded-xl shadow-lg border py-1.5 z-20"
                        :style="{
                          background: 'var(--bg-panel)',
                          borderColor: 'var(--border-main)',
                        }"
                      >
                        <div class="fixed inset-0 z-[-1]" @click="closeMenu"></div>

                        <button
                          @click="toggleAgentActive(a)"
                          class="w-full text-left px-4 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
                          :style="{ color: 'var(--text-main)' }"
                        >
                          <span
                            class="w-2 h-2 rounded-full"
                            :style="{ background: a.isActive ? '#f59e0b' : '#10b981' }"
                          ></span>
                          {{ a.isActive ? 'Desactivar' : 'Activar' }}
                        </button>

                        <div
                          class="border-t my-1 mx-2"
                          :style="{ borderColor: 'var(--border-main)' }"
                        ></div>

                        <button
                          @click="openDeleteAgent(a)"
                          class="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                        >
                          <svg
                            class="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            ></path>
                          </svg>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>

                  <tr
                    v-for="n in Math.max(0, 8 - paginatedAgents.length)"
                    :key="`ghost-agent-${n}`"
                    :style="{ borderTop: `1px solid var(--border-main)` }"
                  >
                    <td class="px-4 py-3 opacity-0">.</td>
                    <td class="px-4 py-3 opacity-0">.</td>
                    <td class="px-4 py-3 opacity-0">.</td>
                    <td class="px-4 py-3 opacity-0">.</td>
                    <td class="px-4 py-3 opacity-0">.</td>
                    <td class="px-4 py-3 opacity-0">.</td>
                    <td class="px-4 py-3 opacity-0">.</td>
                    <td class="px-4 py-3 opacity-0">.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div
            v-if="filteredAgents.length > pageSize"
            class="mt-4 flex items-center justify-between"
          >
            <p class="text-[11px]" :style="{ color: 'var(--text-soft)' }">
              Mostrando
              <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
                {{ (page - 1) * pageSize + 1 }}
              </span>
              -
              <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
                {{ Math.min(page * pageSize, filteredAgents.length) }}
              </span>
              de
              <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
                {{ filteredAgents.length }}
              </span>
              agentes
            </p>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg border text-xs transition disabled:opacity-50"
                :style="{
                  background: 'var(--bg-soft)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
                :disabled="page === 1"
                @click="goToPage(page - 1)"
              >
                Anterior
              </button>

              <span class="text-xs font-medium px-2" :style="{ color: 'var(--text-main)' }">
                Página {{ page }} de {{ totalPages }}
              </span>

              <button
                type="button"
                class="px-3 py-1.5 rounded-lg border text-xs transition disabled:opacity-50"
                :style="{
                  background: 'var(--bg-soft)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
                :disabled="page === totalPages"
                @click="goToPage(page + 1)"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL NUEVO AGENTE -->
      <div
        v-if="showNewModal"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      >
        <div
          class="w-full max-w-md rounded-2xl p-6 shadow-xl border"
          :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
        >
          <h2 class="text-lg font-semibold mb-1">Nuevo agente</h2>
          <p class="text-[11px] mb-4" :style="{ color: 'var(--text-soft)' }">
            Crea un usuario de soporte, administrador o superadministrador.
          </p>

          <div class="space-y-3 text-xs">
            <div class="space-y-1">
              <label class="block" :style="{ color: 'var(--text-main)' }">Nombre completo</label>
              <input
                v-model="newAgentForm.name"
                type="text"
                class="w-full rounded-md border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :style="{
                  background: 'var(--input-bg)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
              />
            </div>

            <div class="space-y-1">
              <label class="block" :style="{ color: 'var(--text-main)' }">Correo</label>
              <input
                v-model="newAgentForm.email"
                type="email"
                class="w-full rounded-md border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :style="{
                  background: 'var(--input-bg)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
              />
            </div>

            <div class="space-y-1">
              <label class="block" :style="{ color: 'var(--text-main)' }">Cargo</label>
              <input
                v-model="newAgentForm.cargo"
                type="text"
                class="w-full rounded-md border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :style="{
                  background: 'var(--input-bg)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
                placeholder="Ej: Analista de soporte, Coordinador TI..."
              />
            </div>

            <div class="space-y-1">
              <label class="block" :style="{ color: 'var(--text-main)' }">Rol</label>
              <select
                v-model="newAgentForm.role"
                class="w-full rounded-md border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :style="{
                  background: 'var(--input-bg)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
              >
                <option value="support">Soporte</option>
                <option value="admin">Administrador</option>
                <option value="super-admin">Super administrador</option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="block" :style="{ color: 'var(--text-main)' }">Área de soporte</label>
              <select
                v-model="newAgentForm.supportArea"
                class="w-full rounded-md border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :style="{
                  background: 'var(--input-bg)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
              >
                <option value="">(Sin área asignada)</option>
                <option v-for="a in supportAreas" :key="a.id" :value="a.name">
                  {{ a.name }}
                </option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="block" :style="{ color: 'var(--text-main)' }">Contraseña inicial</label>
              <div class="relative">
                <input
                  v-model="newAgentForm.password"
                  :type="showNewAgentPassword ? 'text' : 'password'"
                  class="w-full rounded-md border px-3 py-1.5 pr-16 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  :style="{
                    background: 'var(--input-bg)',
                    borderColor: 'var(--border-main)',
                    color: 'var(--text-main)',
                  }"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-2 text-[10px]"
                  :style="{ color: 'var(--text-soft)' }"
                  @click="showNewAgentPassword = !showNewAgentPassword"
                >
                  {{ showNewAgentPassword ? 'Ocultar' : 'Ver' }}
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2 mt-2">
              <input
                v-model="newAgentForm.isActive"
                id="newAgentActive"
                type="checkbox"
                class="w-3 h-3 rounded"
                style="accent-color: #10b981"
              />
              <label
                for="newAgentActive"
                class="text-[11px]"
                :style="{ color: 'var(--text-main)' }"
              >
                Agente activo
              </label>
            </div>
          </div>

          <div class="mt-5 flex justify-end gap-2 text-xs">
            <button
              type="button"
              class="px-4 py-2 rounded-lg border transition-colors hover:bg-black/5"
              :style="{
                background: 'var(--bg-soft)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-main)',
              }"
              @click="showNewModal = false"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-lg font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              style="background: #10b981"
              :disabled="!newAgentForm.name || !newAgentForm.email || !newAgentForm.password"
              @click="createAgent"
            >
              Crear agente
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL EDITAR AGENTE -->
      <div
        v-if="showEditModal"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      >
        <div
          class="w-full max-w-md rounded-2xl p-6 shadow-xl border"
          :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
        >
          <h2 class="text-lg font-semibold mb-1">Editar agente</h2>
          <p class="text-[11px] mb-4" :style="{ color: 'var(--text-soft)' }">
            Actualiza los datos del agente o administrador.
          </p>

          <div class="space-y-3 text-xs">
            <div class="space-y-1">
              <label class="block" :style="{ color: 'var(--text-main)' }">Nombre completo</label>
              <input
                v-model="editAgentForm.name"
                type="text"
                class="w-full rounded-md border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :style="{
                  background: 'var(--input-bg)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
              />
            </div>

            <div class="space-y-1">
              <label class="block" :style="{ color: 'var(--text-main)' }">Correo</label>
              <input
                v-model="editAgentForm.email"
                type="email"
                class="w-full rounded-md border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :style="{
                  background: 'var(--input-bg)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
              />
            </div>

            <div class="space-y-1">
              <label class="block" :style="{ color: 'var(--text-main)' }">Cargo</label>
              <input
                v-model="editAgentForm.cargo"
                type="text"
                class="w-full rounded-md border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :style="{
                  background: 'var(--input-bg)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
                placeholder="Ej: Analista de soporte, Coordinador TI..."
              />
            </div>

            <div class="space-y-1">
              <label class="block" :style="{ color: 'var(--text-main)' }">Rol</label>
              <select
                v-model="editAgentForm.role"
                class="w-full rounded-md border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :style="{
                  background: 'var(--input-bg)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
              >
                <option value="support">Soporte</option>
                <option value="admin">Administrador</option>
                <option value="super-admin">Super administrador</option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="block" :style="{ color: 'var(--text-main)' }">Área de soporte</label>
              <select
                v-model="editAgentForm.supportArea"
                class="w-full rounded-md border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :style="{
                  background: 'var(--input-bg)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
              >
                <option value="">(Sin área asignada)</option>
                <option v-for="a in supportAreas" :key="a.id" :value="a.name">
                  {{ a.name }}
                </option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="block" :style="{ color: 'var(--text-main)' }">Nueva contraseña</label>
              <div class="relative">
                <input
                  v-model="editAgentForm.password"
                  :type="showEditAgentPassword ? 'text' : 'password'"
                  class="w-full rounded-md border px-3 py-1.5 pr-16 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Dejar en blanco para no cambiarla"
                  :style="{
                    background: 'var(--input-bg)',
                    borderColor: 'var(--border-main)',
                    color: 'var(--text-main)',
                  }"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-2 text-[10px]"
                  :style="{ color: 'var(--text-soft)' }"
                  @click="showEditAgentPassword = !showEditAgentPassword"
                >
                  {{ showEditAgentPassword ? 'Ocultar' : 'Ver' }}
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2 mt-2">
              <input
                v-model="editAgentForm.isActive"
                id="editAgentActive"
                type="checkbox"
                class="w-3 h-3 rounded"
                style="accent-color: #10b981"
              />
              <label
                for="editAgentActive"
                class="text-[11px]"
                :style="{ color: 'var(--text-main)' }"
              >
                Agente activo
              </label>
            </div>
          </div>

          <div class="mt-5 flex justify-end gap-2 text-xs">
            <button
              type="button"
              class="px-4 py-2 rounded-lg border transition-colors hover:bg-black/5"
              :style="{
                background: 'var(--bg-soft)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-main)',
              }"
              @click="showEditModal = false"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-lg font-semibold text-white transition-colors hover:bg-emerald-600"
              style="background: #10b981"
              @click="updateAgent"
            >
              Guardar cambios
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL ELIMINAR AGENTE -->
      <div
        v-if="showDeleteModal"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      >
        <div
          class="w-full max-w-md rounded-2xl p-6 shadow-xl border"
          :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
        >
          <h2 class="text-lg font-semibold mb-1" style="color: #f43f5e">Eliminar agente</h2>
          <p class="text-[11px] mb-4" :style="{ color: 'var(--text-soft)' }">
            ¿Estás seguro que quieres <b>eliminar</b> este agente?
          </p>

          <div
            class="rounded-lg border p-4 text-xs"
            :style="{ background: 'var(--bg-soft)', borderColor: 'var(--border-main)' }"
          >
            <p :style="{ color: 'var(--text-main)' }">
              <b>{{ deleteAgentTarget.name }}</b> ({{ deleteAgentTarget.email }})
            </p>
            <p class="text-[11px] mt-1" :style="{ color: 'var(--text-muted)' }">
              ID: {{ deleteAgentTarget.id }} · Rol: {{ deleteAgentTarget.mainRole }}
            </p>
          </div>

          <div class="mt-5 flex justify-end gap-2 text-xs">
            <button
              type="button"
              class="px-4 py-2 rounded-lg border transition-colors hover:bg-black/5"
              :style="{
                background: 'var(--bg-soft)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-main)',
              }"
              @click="showDeleteModal = false"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-lg font-semibold text-white transition-colors hover:bg-rose-600"
              style="background: #f43f5e"
              @click="confirmDeleteAgent"
            >
              Sí, eliminar
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
