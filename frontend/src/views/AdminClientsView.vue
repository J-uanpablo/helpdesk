<!-- src/views/AdminClientsView.vue -->
<script setup lang="ts">
import { reactive, ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { apiFetch } from '../lib/api';

interface AdminClient {
  id: number;
  name: string;
  email: string;
  cargo?: string | null;
  sede?: string | null;
  clientArea?: string | null;
  isActive: boolean;
  createdAt: string;
}

const router = useRouter();
const { token, initAuth } = useAuth();

const clients = ref<AdminClient[]>([]);
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
const sedeFilter = ref('all');
const areaFilter = ref('all');
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
const showNewClientPassword = ref(false);
const showEditClientPassword = ref(false);

// =============================
// FORMULARIOS
// =============================
const newClientForm = reactive({
  name: '',
  email: '',
  cargo: '',
  sede: '',
  clientArea: '',
  password: '',
  isActive: true,
});

const editClientForm = reactive({
  id: 0,
  name: '',
  email: '',
  cargo: '',
  sede: '',
  clientArea: '',
  password: '',
  isActive: true,
});

// =============================
// DELETE TARGET
// =============================
const deleteClientTarget = reactive({
  id: 0,
  name: '',
  email: '',
});

// =============================
// COMPUTED
// =============================
const filteredClients = computed(() => {
  const text = searchText.value.trim().toLowerCase();

  return clients.value.filter(c => {
    const matchesText =
      !text || c.name.toLowerCase().includes(text) || c.email.toLowerCase().includes(text);

    const matchesSede =
      sedeFilter.value === 'all' || (c.sede || '').toLowerCase() === sedeFilter.value.toLowerCase();

    const matchesArea =
      areaFilter.value === 'all' ||
      (c.clientArea || '').toLowerCase() === areaFilter.value.toLowerCase();

    const matchesActive = !onlyActive.value || c.isActive;

    return matchesText && matchesSede && matchesArea && matchesActive;
  });
});

const totalClients = computed(() => clients.value.length);

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(filteredClients.value.length / pageSize));
});

const paginatedClients = computed(() => {
  const start = (page.value - 1) * pageSize;
  const end = start + pageSize;
  return filteredClients.value.slice(start, end);
});

function goToPage(newPage: number) {
  if (newPage < 1 || newPage > totalPages.value) return;
  page.value = newPage;
}

watch([searchText, sedeFilter, areaFilter, onlyActive], () => {
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
async function loadClients() {
  if (!token.value) return;
  error.value = null;
  isLoading.value = true;

  try {
    const res = await apiFetch('/users/clients');

    if (!res.ok) throw new Error('Error cargando clientes');

    clients.value = await res.json();
  } catch (err: any) {
    error.value = err.message || 'Error al cargar datos';
  } finally {
    isLoading.value = false;
  }
}

// =============================
// CREATE
// =============================
async function createClient() {
  if (!token.value) return;
  error.value = null;

  try {
    const res = await apiFetch('/users/clients', {
      method: 'POST',
      body: JSON.stringify({
        name: newClientForm.name.trim(),
        email: newClientForm.email.trim(),
        cargo: newClientForm.cargo.trim() || undefined,
        sede: newClientForm.sede.trim() || undefined,
        clientArea: newClientForm.clientArea.trim() || undefined,
        password: newClientForm.password,
        isActive: newClientForm.isActive,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Error creando cliente');
    }

    const created = await res.json();
    clients.value.push(created);

    Object.assign(newClientForm, {
      name: '',
      email: '',
      cargo: '',
      sede: '',
      clientArea: '',
      password: '',
      isActive: true,
    });

    showNewClientPassword.value = false;
    showNewModal.value = false;
  } catch (err: any) {
    error.value = err.message || 'Error creando cliente';
  }
}

// =============================
// EDIT
// =============================
function openEditClient(c: AdminClient) {
  closeMenu();

  Object.assign(editClientForm, {
    id: c.id,
    name: c.name,
    email: c.email,
    cargo: c.cargo || '',
    sede: c.sede || '',
    clientArea: c.clientArea || '',
    password: '',
    isActive: c.isActive,
  });

  showEditClientPassword.value = false;
  showEditModal.value = true;
}

async function updateClient() {
  if (!token.value) return;
  error.value = null;

  try {
    const payload: any = {
      name: editClientForm.name.trim(),
      email: editClientForm.email.trim(),
      cargo: editClientForm.cargo.trim() || undefined,
      sede: editClientForm.sede.trim() || undefined,
      clientArea: editClientForm.clientArea.trim() || undefined,
      isActive: editClientForm.isActive,
    };

    if (editClientForm.password) {
      payload.password = editClientForm.password;
    }

    const res = await apiFetch(`/users/clients/${editClientForm.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Error actualizando cliente');
    }

    const updated = await res.json();
    const idx = clients.value.findIndex(c => c.id === updated.id);
    if (idx !== -1) clients.value[idx] = updated;

    showEditModal.value = false;
  } catch (err: any) {
    error.value = err.message || 'Error actualizando cliente';
  }
}

// =============================
// TOGGLE ACTIVE
// =============================
async function toggleClientActive(c: AdminClient) {
  closeMenu();
  if (!token.value) return;
  error.value = null;

  try {
    const res = await apiFetch(`/users/clients/${c.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !c.isActive }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Error cambiando estado');
    }

    const updated = await res.json();
    const idx = clients.value.findIndex(x => x.id === updated.id);
    if (idx !== -1) clients.value[idx] = updated;
  } catch (err: any) {
    error.value = err.message || 'Error cambiando estado';
  }
}

// =============================
// DELETE
// =============================
function openDeleteClient(c: AdminClient) {
  closeMenu();
  Object.assign(deleteClientTarget, {
    id: c.id,
    name: c.name,
    email: c.email,
  });
  showDeleteModal.value = true;
}

async function confirmDeleteClient() {
  if (!token.value) return;
  error.value = null;

  try {
    const res = await apiFetch(`/users/clients/${deleteClientTarget.id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Error eliminando cliente');
    }

    clients.value = clients.value.filter(c => c.id !== deleteClientTarget.id);
    showDeleteModal.value = false;
  } catch (err: any) {
    error.value = err.message || 'Error eliminando cliente';
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

  await loadClients();
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
              Administración de usuarios finales
            </p>
            <h1 class="mt-1 text-2xl font-bold tracking-tight">Administración de clientes</h1>
            <p class="mt-1 text-xs" :style="{ color: 'var(--text-soft)' }">
              Crea y gestiona los clientes que usan la mesa de ayuda.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <div
              class="hidden md:flex items-center gap-2 rounded-xl border px-3 py-2"
              :style="{ background: 'var(--bg-soft)', borderColor: 'var(--border-main)' }"
            >
              <div class="text-[11px]" :style="{ color: 'var(--text-soft)' }">Clientes</div>
              <div class="text-sm font-semibold">{{ totalClients }}</div>
            </div>

            <button
              type="button"
              @click="showNewModal = true"
              class="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.99]"
              style="background: #10b981"
            >
              <span class="text-base leading-none">＋</span>
              Nuevo cliente
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
                      new Set(clients.map(c => (c.clientArea || '').trim()).filter(x => x))
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
                <span class="text-xs" :style="{ color: 'var(--text-soft)' }">Sede</span>
                <select
                  v-model="sedeFilter"
                  class="rounded-lg border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  :style="{
                    background: 'var(--input-bg)',
                    borderColor: 'var(--border-main)',
                    color: 'var(--text-main)',
                  }"
                >
                  <option value="all">Todas</option>
                  <option
                    v-for="s in Array.from(
                      new Set(clients.map(c => (c.sede || '').trim()).filter(x => x))
                    )"
                    :key="s"
                    :value="s"
                  >
                    {{ s }}
                  </option>
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
                {{ filteredClients.length }}
              </span>
              de
              <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
                {{ totalClients }}
              </span>
              clientes.
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
                Listado de clientes
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
                    <th class="px-4 py-3 text-left font-semibold">Área</th>
                    <th class="px-4 py-3 text-left font-semibold">Sede</th>
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
                      Cargando clientes...
                    </td>
                  </tr>

                  <tr
                    v-else-if="!filteredClients.length"
                    :style="{ borderTop: `1px solid var(--border-main)` }"
                  >
                    <td
                      colspan="8"
                      class="px-4 py-10 text-center"
                      :style="{ color: 'var(--text-muted)' }"
                    >
                      No hay clientes que coincidan con los filtros.
                    </td>
                  </tr>

                  <tr
                    v-for="c in paginatedClients"
                    :key="c.id"
                    class="transition hover:bg-black/5 dark:hover:bg-white/5"
                    :style="{ borderTop: `1px solid var(--border-main)` }"
                  >
                    <td class="px-4 py-3">
                      <div class="flex flex-col">
                        <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
                          {{ c.name }}
                        </span>
                        <span class="text-[10px]" :style="{ color: 'var(--text-muted)' }">
                          ID: {{ c.id }}
                        </span>
                      </div>
                    </td>

                    <td class="px-4 py-3" :style="{ color: 'var(--text-main)' }">
                      {{ c.email }}
                    </td>

                    <td class="px-4 py-3" :style="{ color: 'var(--text-main)' }">
                      {{ c.cargo || '—' }}
                    </td>

                    <td class="px-4 py-3" :style="{ color: 'var(--text-main)' }">
                      {{ c.clientArea || '—' }}
                    </td>

                    <td class="px-4 py-3" :style="{ color: 'var(--text-main)' }">
                      {{ c.sede || '—' }}
                    </td>

                    <td class="px-4 py-3">
                      <span
                        class="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] border"
                        :style="
                          c.isActive
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
                          :style="{ background: c.isActive ? '#10b981' : '#94a3b8' }"
                        />
                        {{ c.isActive ? 'Activo' : 'Inactivo' }}
                      </span>
                    </td>

                    <td class="px-4 py-3 whitespace-nowrap" :style="{ color: 'var(--text-soft)' }">
                      {{ formatDate(c.createdAt) }}
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
                          @click="openEditClient(c)"
                          title="Editar cliente"
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
                          @click="toggleMenu(c.id)"
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
                        v-if="openMenuId === c.id"
                        class="absolute right-6 top-10 w-36 rounded-xl shadow-lg border py-1.5 z-20"
                        :style="{
                          background: 'var(--bg-panel)',
                          borderColor: 'var(--border-main)',
                        }"
                      >
                        <div class="fixed inset-0 z-[-1]" @click="closeMenu"></div>

                        <button
                          @click="toggleClientActive(c)"
                          class="w-full text-left px-4 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
                          :style="{ color: 'var(--text-main)' }"
                        >
                          <span
                            class="w-2 h-2 rounded-full"
                            :style="{ background: c.isActive ? '#f59e0b' : '#10b981' }"
                          ></span>
                          {{ c.isActive ? 'Desactivar' : 'Activar' }}
                        </button>

                        <div
                          class="border-t my-1 mx-2"
                          :style="{ borderColor: 'var(--border-main)' }"
                        ></div>

                        <button
                          @click="openDeleteClient(c)"
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
                    v-for="n in Math.max(0, 8 - paginatedClients.length)"
                    :key="`ghost-client-${n}`"
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

          <!-- PAGINACIÓN -->
          <div
            v-if="filteredClients.length > pageSize"
            class="mt-4 flex items-center justify-between"
          >
            <p class="text-[11px]" :style="{ color: 'var(--text-soft)' }">
              Mostrando
              <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
                {{ (page - 1) * pageSize + 1 }}
              </span>
              -
              <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
                {{ Math.min(page * pageSize, filteredClients.length) }}
              </span>
              de
              <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
                {{ filteredClients.length }}
              </span>
              clientes
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

      <!-- MODAL NUEVO CLIENTE -->
      <div
        v-if="showNewModal"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      >
        <div
          class="w-full max-w-md rounded-2xl p-6 shadow-xl border"
          :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
        >
          <h2 class="text-lg font-semibold mb-1">Nuevo cliente</h2>
          <p class="text-[11px] mb-4" :style="{ color: 'var(--text-soft)' }">
            Crea un usuario final que podrá crear tickets y dar seguimiento a sus solicitudes.
          </p>

          <div class="space-y-3 text-xs">
            <div class="space-y-1">
              <label class="block" :style="{ color: 'var(--text-main)' }">Nombre completo</label>
              <input
                v-model="newClientForm.name"
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
                v-model="newClientForm.email"
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
                v-model="newClientForm.cargo"
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
              <label class="block" :style="{ color: 'var(--text-main)' }">Área</label>
              <input
                v-model="newClientForm.clientArea"
                type="text"
                class="w-full rounded-md border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :style="{
                  background: 'var(--input-bg)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
                placeholder="Ej: Talento Humano, Compras, Contabilidad..."
              />
            </div>

            <div class="space-y-1">
              <label class="block" :style="{ color: 'var(--text-main)' }">Sede</label>
              <input
                v-model="newClientForm.sede"
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
              <label class="block" :style="{ color: 'var(--text-main)' }">Contraseña inicial</label>
              <div class="relative">
                <input
                  v-model="newClientForm.password"
                  :type="showNewClientPassword ? 'text' : 'password'"
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
                  @click="showNewClientPassword = !showNewClientPassword"
                >
                  {{ showNewClientPassword ? 'Ocultar' : 'Ver' }}
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2 mt-2">
              <input
                v-model="newClientForm.isActive"
                id="newClientActive"
                type="checkbox"
                class="w-3 h-3 rounded"
                style="accent-color: #10b981"
              />
              <label
                for="newClientActive"
                class="text-[11px]"
                :style="{ color: 'var(--text-main)' }"
              >
                Cliente activo
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
              :disabled="!newClientForm.name || !newClientForm.email || !newClientForm.password"
              @click="createClient"
            >
              Crear cliente
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL EDITAR CLIENTE -->
      <div
        v-if="showEditModal"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      >
        <div
          class="w-full max-w-md rounded-2xl p-6 shadow-xl border"
          :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
        >
          <h2 class="text-lg font-semibold mb-1">Editar cliente</h2>
          <p class="text-[11px] mb-4" :style="{ color: 'var(--text-soft)' }">
            Actualiza los datos del usuario final.
          </p>

          <div class="space-y-3 text-xs">
            <div class="space-y-1">
              <label class="block" :style="{ color: 'var(--text-main)' }">Nombre completo</label>
              <input
                v-model="editClientForm.name"
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
                v-model="editClientForm.email"
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
                v-model="editClientForm.cargo"
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
              <label class="block" :style="{ color: 'var(--text-main)' }">Área</label>
              <input
                v-model="editClientForm.clientArea"
                type="text"
                class="w-full rounded-md border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :style="{
                  background: 'var(--input-bg)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
                placeholder="Ej: Talento Humano, Compras, Contabilidad..."
              />
            </div>

            <div class="space-y-1">
              <label class="block" :style="{ color: 'var(--text-main)' }">Sede</label>
              <input
                v-model="editClientForm.sede"
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
              <label class="block" :style="{ color: 'var(--text-main)' }">Nueva contraseña</label>
              <div class="relative">
                <input
                  v-model="editClientForm.password"
                  :type="showEditClientPassword ? 'text' : 'password'"
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
                  @click="showEditClientPassword = !showEditClientPassword"
                >
                  {{ showEditClientPassword ? 'Ocultar' : 'Ver' }}
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2 mt-2">
              <input
                v-model="editClientForm.isActive"
                id="editClientActive"
                type="checkbox"
                class="w-3 h-3 rounded"
                style="accent-color: #10b981"
              />
              <label
                for="editClientActive"
                class="text-[11px]"
                :style="{ color: 'var(--text-main)' }"
              >
                Cliente activo
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
              @click="updateClient"
            >
              Guardar cambios
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL ELIMINAR CLIENTE -->
      <div
        v-if="showDeleteModal"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      >
        <div
          class="w-full max-w-md rounded-2xl p-6 shadow-xl border"
          :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
        >
          <h2 class="text-lg font-semibold mb-1" style="color: #f43f5e">Eliminar cliente</h2>
          <p class="text-[11px] mb-4" :style="{ color: 'var(--text-soft)' }">
            ¿Estás seguro que quieres <b>eliminar</b> este cliente?
          </p>

          <div
            class="rounded-lg border p-4 text-xs"
            :style="{ background: 'var(--bg-soft)', borderColor: 'var(--border-main)' }"
          >
            <p :style="{ color: 'var(--text-main)' }">
              <b>{{ deleteClientTarget.name }}</b> ({{ deleteClientTarget.email }})
            </p>
            <p class="text-[11px] mt-1" :style="{ color: 'var(--text-muted)' }">
              ID: {{ deleteClientTarget.id }}
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
              @click="confirmDeleteClient"
            >
              Sí, eliminar
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
