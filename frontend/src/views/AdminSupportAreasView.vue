<!-- src/views/AdminSupportAreasView.vue -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
import { apiFetch } from '../lib/api';

interface SupportArea {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const { token } = useAuth();

const areas = ref<SupportArea[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

const openMenuId = ref<number | null>(null);

function toggleMenu(id: number) {
  openMenuId.value = openMenuId.value === id ? null : id;
}

function closeMenu() {
  openMenuId.value = null;
}

const searchText = ref('');
const onlyActive = ref(false);

const showModal = ref(false);
const editingArea = ref<SupportArea | null>(null);
const isSaving = ref(false);
const formError = ref<string | null>(null);

const form = ref({
  name: '',
  isActive: true,
});

const deleteTarget = ref<SupportArea | null>(null);
const isDeleting = ref(false);

const filteredAreas = computed(() => {
  const text = searchText.value.trim().toLowerCase();

  return areas.value.filter(area => {
    const matchesText = !text || area.name.toLowerCase().includes(text);
    const matchesActive = !onlyActive.value || area.isActive;
    return matchesText && matchesActive;
  });
});

const page = ref(1);
const pageSize = 8;

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(filteredAreas.value.length / pageSize));
});

const paginatedAreas = computed(() => {
  const start = (page.value - 1) * pageSize;
  const end = start + pageSize;
  return filteredAreas.value.slice(start, end);
});

function goToPage(newPage: number) {
  if (newPage < 1 || newPage > totalPages.value) return;
  page.value = newPage;
}

watch([searchText, onlyActive], () => {
  page.value = 1;
});

const totalAreas = computed(() => areas.value.length);
const activeAreas = computed(() => areas.value.filter(a => a.isActive).length);
const inactiveAreas = computed(() => areas.value.filter(a => !a.isActive).length);

function formatDate(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function ensureToken(): string | null {
  const jwt = (token.value ?? '').trim();
  if (!jwt) {
    error.value = 'No hay token de sesión. Inicia sesión nuevamente.';
    return null;
  }
  return jwt;
}

async function loadAreas() {
  error.value = null;
  const jwt = ensureToken();
  if (!jwt) return;

  isLoading.value = true;
  try {
    const res = await apiFetch('/support-areas', {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Error ${res.status} al cargar las áreas`);
    }

    areas.value = await res.json();
  } catch (e: any) {
    console.error(e);
    error.value = e.message ?? 'No se pudieron cargar las áreas.';
  } finally {
    isLoading.value = false;
  }
}

function openCreateModal() {
  closeMenu();
  editingArea.value = null;
  form.value = {
    name: '',
    isActive: true,
  };
  formError.value = null;
  showModal.value = true;
}

function openEditModal(area: SupportArea) {
  closeMenu();
  editingArea.value = area;
  form.value = {
    name: area.name,
    isActive: area.isActive,
  };
  formError.value = null;
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editingArea.value = null;
  formError.value = null;
}

async function handleSubmit() {
  const name = form.value.name.trim();
  if (!name) {
    formError.value = 'El nombre del área es obligatorio.';
    return;
  }

  const jwt = ensureToken();
  if (!jwt) return;

  isSaving.value = true;
  formError.value = null;

  try {
    if (!editingArea.value) {
      const res = await apiFetch('/support-areas', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          name,
          isActive: form.value.isActive,
        }),
      });

      if (!res.ok) {
        throw new Error(`Error ${res.status} al crear área`);
      }

      const created = await res.json();
      areas.value.push(created);
    } else {
      const res = await apiFetch(`/support-areas/${editingArea.value.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          name,
          isActive: form.value.isActive,
        }),
      });

      if (!res.ok) {
        throw new Error(`Error ${res.status} al actualizar área`);
      }

      const updated = await res.json();
      const idx = areas.value.findIndex(a => a.id === updated.id);
      if (idx !== -1) {
        areas.value[idx] = updated;
      }
    }

    closeModal();
  } catch (e: any) {
    console.error(e);
    formError.value = e.message ?? 'No se pudo guardar el área.';
  } finally {
    isSaving.value = false;
  }
}

async function toggleActive(area: SupportArea) {
  closeMenu();
  const jwt = ensureToken();
  if (!jwt) return;

  try {
    const res = await apiFetch(`/support-areas/${area.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        isActive: !area.isActive,
      }),
    });

    if (!res.ok) {
      throw new Error(`Error ${res.status} al cambiar estado del área`);
    }

    const updated = await res.json();
    const idx = areas.value.findIndex(a => a.id === updated.id);
    if (idx !== -1) {
      areas.value[idx] = updated;
    }
  } catch (e: any) {
    console.error(e);
    error.value = e.message ?? 'No se pudo cambiar el estado del área.';
  }
}

function confirmSoftDelete(area: SupportArea) {
  closeMenu();
  deleteTarget.value = area;
}

async function softDelete() {
  if (!deleteTarget.value) return;
  const jwt = ensureToken();
  if (!jwt) return;

  isDeleting.value = true;
  try {
    const res = await apiFetch(`/support-areas/${deleteTarget.value.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Error ${res.status} al eliminar área`);
    }

    const updated = await res.json();
    const idx = areas.value.findIndex(a => a.id === updated.id);
    if (idx !== -1) {
      areas.value[idx] = updated;
    }

    deleteTarget.value = null;
  } catch (e: any) {
    console.error(e);
    error.value = e.message ?? 'No se pudo eliminar el área.';
  } finally {
    isDeleting.value = false;
  }
}

onMounted(() => {
  loadAreas();
});
</script>

<template>
  <div class="min-h-screen" :style="{ background: 'var(--bg-main)', color: 'var(--text-main)' }">
    <main class="px-6 py-6 max-w-[1600px] mx-auto">
      <div
        class="w-full rounded-2xl border shadow-[0_0_0_1px_rgba(15,23,42,0.06)] backdrop-blur"
        :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
      >
        <!-- HEADER -->
        <div class="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="text-xs" :style="{ color: 'var(--text-soft)' }">
              Administración de áreas de soporte
            </p>
            <h1 class="mt-1 text-2xl font-bold tracking-tight">
              Administración de áreas de soporte
            </h1>
            <p class="mt-1 text-xs" :style="{ color: 'var(--text-soft)' }">
              Crea, edita y desactiva áreas para asignarlas a los agentes.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <div
              class="hidden md:flex items-center gap-2 rounded-xl border px-3 py-2"
              :style="{ background: 'var(--bg-soft)', borderColor: 'var(--border-main)' }"
            >
              <div class="text-[11px]" :style="{ color: 'var(--text-soft)' }">Áreas</div>
              <div class="text-sm font-semibold">{{ totalAreas }}</div>
            </div>

            <button
              type="button"
              @click="openCreateModal"
              class="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.99]"
              style="background: #10b981"
            >
              <span class="text-base leading-none">＋</span>
              Nueva área
            </button>
          </div>
        </div>

        <!-- TOOLBAR -->
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
                  placeholder="Nombre del área..."
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
                  Solo activas
                </span>
              </label>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between">
            <p class="text-[11px]" :style="{ color: 'var(--text-muted)' }">
              Mostrando
              <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
                {{ filteredAreas.length }}
              </span>
              de
              <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
                {{ totalAreas }}
              </span>
              áreas.
            </p>

            <p v-if="error" class="text-[11px]" style="color: #f43f5e">
              {{ error }}
            </p>
          </div>
        </div>

        <!-- TABLA -->
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
                Listado de áreas
              </div>
              <div class="text-[11px]" :style="{ color: 'var(--text-muted)' }">
                Activas:
                <span style="color: #10b981">{{ activeAreas }}</span>
                · Inactivas:
                <span style="color: #f43f5e">{{ inactiveAreas }}</span>
              </div>
            </div>

            <div class="overflow-x-auto min-h-[300px]">
              <table class="min-w-full text-xs">
                <thead :style="{ background: 'var(--bg-soft)', color: 'var(--text-soft)' }">
                  <tr>
                    <th class="px-4 py-3 text-left font-semibold">Área</th>
                    <th class="px-4 py-3 text-left font-semibold">Estado</th>
                    <th class="px-4 py-3 text-left font-semibold">Creado</th>
                    <th class="px-4 py-3 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  <tr v-if="isLoading" :style="{ borderTop: `1px solid var(--border-main)` }">
                    <td
                      colspan="4"
                      class="px-4 py-10 text-center"
                      :style="{ color: 'var(--text-muted)' }"
                    >
                      Cargando áreas...
                    </td>
                  </tr>

                  <tr
                    v-else-if="!filteredAreas.length"
                    :style="{ borderTop: `1px solid var(--border-main)` }"
                  >
                    <td
                      colspan="4"
                      class="px-4 py-10 text-center"
                      :style="{ color: 'var(--text-muted)' }"
                    >
                      No hay áreas que coincidan con los filtros.
                    </td>
                  </tr>

                  <tr
                    v-for="area in paginatedAreas"
                    :key="area.id"
                    class="transition hover:bg-black/5 dark:hover:bg-white/5"
                    :style="{ borderTop: `1px solid var(--border-main)` }"
                  >
                    <td class="px-4 py-3">
                      <div class="flex flex-col">
                        <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
                          {{ area.name }}
                        </span>
                        <span class="text-[10px]" :style="{ color: 'var(--text-muted)' }">
                          ID: {{ area.id }}
                        </span>
                      </div>
                    </td>

                    <td class="px-4 py-3">
                      <span
                        class="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] border"
                        :style="
                          area.isActive
                            ? {
                                background: 'rgba(16,185,129,0.10)',
                                color: '#10b981',
                                borderColor: 'rgba(16,185,129,0.25)',
                              }
                            : {
                                background: 'rgba(244,63,94,0.10)',
                                color: '#f43f5e',
                                borderColor: 'rgba(244,63,94,0.25)',
                              }
                        "
                      >
                        <span
                          class="h-1.5 w-1.5 rounded-full"
                          :style="{ background: area.isActive ? '#10b981' : '#f43f5e' }"
                        />
                        {{ area.isActive ? 'Activa' : 'Inactiva' }}
                      </span>
                    </td>

                    <td class="px-4 py-3 whitespace-nowrap" :style="{ color: 'var(--text-soft)' }">
                      {{ formatDate(area.createdAt) }}
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
                          @click="openEditModal(area)"
                          title="Editar área"
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
                          @click="toggleMenu(area.id)"
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
                        v-if="openMenuId === area.id"
                        class="absolute right-6 top-10 w-36 rounded-xl shadow-lg border py-1.5 z-20"
                        :style="{
                          background: 'var(--bg-panel)',
                          borderColor: 'var(--border-main)',
                        }"
                      >
                        <div class="fixed inset-0 z-[-1]" @click="closeMenu"></div>

                        <button
                          @click="toggleActive(area)"
                          class="w-full text-left px-4 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
                          :style="{ color: 'var(--text-main)' }"
                        >
                          <span
                            class="w-2 h-2 rounded-full"
                            :style="{ background: area.isActive ? '#f59e0b' : '#10b981' }"
                          ></span>
                          {{ area.isActive ? 'Desactivar' : 'Activar' }}
                        </button>

                        <div
                          class="border-t my-1 mx-2"
                          :style="{ borderColor: 'var(--border-main)' }"
                        ></div>

                        <button
                          @click="confirmSoftDelete(area)"
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
                    v-for="n in Math.max(0, 8 - paginatedAreas.length)"
                    :key="`ghost-area-${n}`"
                    :style="{ borderTop: `1px solid var(--border-main)` }"
                  >
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
            v-if="filteredAreas.length > pageSize"
            class="mt-4 flex items-center justify-between"
          >
            <p class="text-[11px]" :style="{ color: 'var(--text-soft)' }">
              Mostrando
              <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
                {{ (page - 1) * pageSize + 1 }}
              </span>
              -
              <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
                {{ Math.min(page * pageSize, filteredAreas.length) }}
              </span>
              de
              <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
                {{ filteredAreas.length }}
              </span>
              áreas
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

      <!-- MODAL NUEVA / EDITAR ÁREA -->
      <div
        v-if="showModal"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      >
        <div
          class="w-full max-w-md rounded-2xl p-6 shadow-xl border"
          :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
        >
          <h2 class="text-lg font-semibold mb-1">
            {{ editingArea ? 'Editar área' : 'Nueva área' }}
          </h2>
          <p class="text-[11px] mb-4" :style="{ color: 'var(--text-soft)' }">
            Define el nombre del área tal como aparecerá para agentes y tickets.
          </p>

          <div class="space-y-3 text-xs">
            <div class="space-y-1">
              <label class="block" :style="{ color: 'var(--text-main)' }">Nombre del área</label>
              <input
                v-model="form.name"
                type="text"
                class="w-full rounded-md border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :style="{
                  background: 'var(--input-bg)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
                placeholder="Ej: Sistemas, Compras, Talento Humano..."
              />
            </div>

            <div class="flex items-center gap-2 mt-2">
              <input
                v-model="form.isActive"
                id="areaIsActive"
                type="checkbox"
                class="w-3 h-3 rounded"
                style="accent-color: #10b981"
              />
              <label for="areaIsActive" class="text-[11px]" :style="{ color: 'var(--text-main)' }">
                Área activa
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
              @click="closeModal"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-lg font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              style="background: #10b981"
              :disabled="isSaving || !form.name.trim()"
              @click="handleSubmit"
            >
              {{ isSaving ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>

          <p v-if="formError" class="mt-3 text-[11px] text-right" style="color: #f43f5e">
            {{ formError }}
          </p>
        </div>
      </div>

      <!-- MODAL ELIMINAR -->
      <div
        v-if="deleteTarget"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      >
        <div
          class="w-full max-w-md rounded-2xl p-6 shadow-xl border"
          :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
        >
          <h2 class="text-lg font-semibold mb-1" style="color: #f43f5e">Eliminar área</h2>
          <p class="text-[11px] mb-4" :style="{ color: 'var(--text-soft)' }">
            ¿Estás seguro que quieres <b>eliminar</b> esta área?
          </p>

          <div
            class="rounded-lg border p-4 text-xs"
            :style="{ background: 'var(--bg-soft)', borderColor: 'var(--border-main)' }"
          >
            <p :style="{ color: 'var(--text-main)' }">
              <b>{{ deleteTarget.name }}</b>
            </p>
            <p class="text-[11px] mt-1" :style="{ color: 'var(--text-muted)' }">
              ID: {{ deleteTarget.id }}
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
              @click="deleteTarget = null"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-lg font-semibold text-white transition-colors hover:bg-rose-600 disabled:opacity-50"
              style="background: #f43f5e"
              :disabled="isDeleting"
              @click="softDelete"
            >
              {{ isDeleting ? 'Eliminando...' : 'Sí, eliminar' }}
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
