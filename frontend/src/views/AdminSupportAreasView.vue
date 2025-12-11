<!-- src/views/AdminSupportAreasView.vue -->
<template>
  <main class="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
    <!-- Header -->
    <header
      class="px-6 py-4 border-b border-slate-800 flex items-center justify-between"
    >
      <div>
        <h1 class="text-xl md:text-2xl font-bold">
          Administración de áreas de soporte
        </h1>
        <p class="text-xs text-slate-400 mt-1">
          Crea, edita y desactiva áreas para asignarlas a los agentes.
        </p>
      </div>

      <router-link
        to="/soporte"
        class="text-xs px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-800/70"
      >
        ← Volver al panel
      </router-link>
    </header>

    <!-- Contenido principal -->
    <section class="flex-1 px-6 py-4">
      <!-- Barra superior: botón + resumen -->
      <div
        class="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
      >
        <button
          type="button"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          @click="openCreateModal"
        >
          <span class="text-lg leading-none">＋</span>
          Nueva área
        </button>

        <p class="text-[11px] text-slate-400">
          Total áreas:
          <span class="font-semibold text-slate-100">{{ totalAreas }}</span> ·
          Activas:
          <span class="font-semibold text-emerald-400">{{ activeAreas }}</span>
          · Inactivas:
          <span class="font-semibold text-rose-300">{{ inactiveAreas }}</span>
        </p>
      </div>

      <!-- Mensajes de error -->
      <div
        v-if="error"
        class="mb-3 rounded-md border border-rose-500 bg-rose-500/10 px-4 py-2 text-xs text-rose-100"
      >
        {{ error }}
      </div>

      <!-- Tabla / lista -->
      <div
        class="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60"
      >
        <!-- Encabezado de tabla -->
        <div
          class="hidden md:grid md:grid-cols-[2fr,1fr,1.5fr,1fr] gap-3 px-4 py-2 border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-400 bg-slate-950/70"
        >
          <span>Área</span>
          <span class="text-center">Estado</span>
          <span class="text-center">Creada</span>
          <span class="text-right">Acciones</span>
        </div>

        <!-- Loading -->
        <div
          v-if="isLoading"
          class="px-4 py-6 text-center text-xs text-slate-400"
        >
          Cargando áreas de soporte...
        </div>

        <!-- Sin datos -->
        <div
          v-else-if="areas.length === 0"
          class="px-4 py-6 text-center text-xs text-slate-500"
        >
          No hay áreas creadas todavía. <br />
          Pulsa
          <span class="font-semibold text-slate-200">“Nueva área”</span>
          para registrar la primera.
        </div>

        <!-- Lista de áreas -->
        <ul v-else class="divide-y divide-slate-800 text-sm">
          <li
            v-for="area in areas"
            :key="area.id"
            class="px-4 py-3 flex flex-col gap-2 md:grid md:grid-cols-[2fr,1fr,1.5fr,1fr] md:items-center"
          >
            <!-- Nombre -->
            <div>
              <p class="font-semibold text-slate-100">
                {{ area.name }}
              </p>
              <p class="text-[11px] text-slate-500 md:hidden mt-0.5">
                Creada:
                {{ formatDate(area.createdAt) }}
              </p>
            </div>

            <!-- Estado -->
            <div class="md:text-center">
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border"
                :class="
                  area.isActive
                    ? 'border-emerald-500 text-emerald-300 bg-emerald-500/10'
                    : 'border-rose-500 text-rose-300 bg-rose-500/10'
                "
              >
                <span
                  class="w-1.5 h-1.5 rounded-full"
                  :class="area.isActive ? 'bg-emerald-400' : 'bg-rose-400'"
                />
                {{ area.isActive ? "Activa" : "Inactiva" }}
              </span>
            </div>

            <!-- Fecha creada (desktop) -->
            <div class="hidden md:block text-center text-[11px] text-slate-400">
              {{ formatDate(area.createdAt) }}
            </div>

            <!-- Acciones -->
            <div class="flex items-center justify-end gap-2">
              <button
                type="button"
                class="px-2 py-1 rounded-md border border-slate-700 text-[11px] hover:bg-slate-800/80"
                @click="openEditModal(area)"
              >
                Editar
              </button>

              <button
                type="button"
                class="px-2 py-1 rounded-md border text-[11px]"
                :class="
                  area.isActive
                    ? 'border-amber-500 text-amber-300 hover:bg-amber-500/10'
                    : 'border-emerald-500 text-emerald-300 hover:bg-emerald-500/10'
                "
                @click="toggleActive(area)"
              >
                {{ area.isActive ? "Desactivar" : "Activar" }}
              </button>

              <button
                type="button"
                class="px-2 py-1 rounded-md border border-rose-500 text-[11px] text-rose-300 hover:bg-rose-500/10"
                @click="confirmSoftDelete(area)"
              >
                Eliminar
              </button>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <!-- Modal crear / editar área -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
    >
      <div
        class="w-full max-w-md rounded-xl bg-slate-950 border border-slate-800 shadow-xl p-5"
      >
        <h2 class="text-lg font-semibold mb-1">
          {{ editingArea ? "Editar área" : "Nueva área" }}
        </h2>
        <p class="text-[11px] text-slate-400 mb-4">
          Define el nombre del área tal como aparecerá al cliente y a los
          agentes.
        </p>

        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div>
            <label class="block text-[11px] text-slate-300 mb-1">
              Nombre del área
            </label>
            <input
              v-model="form.name"
              type="text"
              class="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: Sistemas, Talento Humano, Mantenimiento..."
            />
          </div>

          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2 text-[11px] text-slate-300">
              <input
                v-model="form.isActive"
                type="checkbox"
                class="rounded border-slate-600 bg-slate-900"
              />
              <span>Área activa</span>
            </label>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              class="px-3 py-1.5 rounded-md border border-slate-600 text-xs hover:bg-slate-800/80"
              @click="closeModal"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="px-4 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isSaving || !form.name.trim()"
            >
              {{ isSaving ? "Guardando..." : "Guardar" }}
            </button>
          </div>

          <p v-if="formError" class="mt-2 text-[11px] text-rose-300 text-right">
            {{ formError }}
          </p>
        </form>
      </div>
    </div>

    <!-- Modal confirmación eliminación -->
    <div
      v-if="deleteTarget"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
    >
      <div
        class="w-full max-w-md rounded-xl bg-slate-950 border border-rose-500/60 shadow-xl p-5"
      >
        <h2 class="text-lg font-semibold mb-2 text-rose-200">
          ¿Eliminar área?
        </h2>
        <p class="text-[12px] text-slate-200 mb-4">
          Estás a punto de marcar como
          <span class="font-semibold">inactiva</span>
          el área:
        </p>
        <p class="text-sm font-semibold mb-4 text-rose-100">
          “{{ deleteTarget.name }}”
        </p>
        <p class="text-[11px] text-slate-400 mb-4">
          Los tickets antiguos seguirán mostrando el nombre de esta área, pero
          ya no aparecerá como opción para nuevas asignaciones si la dejas
          inactiva.
        </p>

        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            class="px-3 py-1.5 rounded-md border border-slate-600 text-xs hover:bg-slate-800/80"
            @click="deleteTarget = null"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="px-4 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isDeleting"
            @click="softDelete"
          >
            {{ isDeleting ? "Eliminando..." : "Eliminar área" }}
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useAuth } from "../composables/useAuth";

interface SupportArea {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const { token, user } = useAuth();

const areas = ref<SupportArea[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

// Modal / formulario
const showModal = ref(false);
const editingArea = ref<SupportArea | null>(null);
const isSaving = ref(false);
const formError = ref<string | null>(null);
const form = ref({
  name: "",
  isActive: true,
});

// Confirmación eliminación
const deleteTarget = ref<SupportArea | null>(null);
const isDeleting = ref(false);

// Contadores
const totalAreas = computed(() => areas.value.length);
const activeAreas = computed(
  () => areas.value.filter((a) => a.isActive).length
);
const inactiveAreas = computed(
  () => areas.value.filter((a) => !a.isActive).length
);

// Helpers
function formatDate(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function ensureToken(): string | null {
  const jwt = (token.value ?? "").trim();
  if (!jwt) {
    error.value = "No hay token de sesión. Inicia sesión nuevamente.";
    return null;
  }
  return jwt;
}

// Cargar áreas
async function loadAreas() {
  error.value = null;
  const jwt = ensureToken();
  if (!jwt) return;

  isLoading.value = true;
  try {
    const res = await fetch("http://localhost:3000/support-areas", {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Error ${res.status} al cargar las áreas`);
    }

    const data = await res.json();
    areas.value = data;
  } catch (e: any) {
    console.error(e);
    error.value = e.message ?? "No se pudieron cargar las áreas.";
  } finally {
    isLoading.value = false;
  }
}

// Abrir modal crear
function openCreateModal() {
  editingArea.value = null;
  form.value = {
    name: "",
    isActive: true,
  };
  formError.value = null;
  showModal.value = true;
}

// Abrir modal editar
function openEditModal(area: SupportArea) {
  editingArea.value = area;
  form.value = {
    name: area.name,
    isActive: area.isActive,
  };
  formError.value = null;
  showModal.value = true;
}

// Cerrar modal
function closeModal() {
  showModal.value = false;
  editingArea.value = null;
  formError.value = null;
}

// Guardar (crear / editar)
async function handleSubmit() {
  const name = form.value.name.trim();
  if (!name) {
    formError.value = "El nombre del área es obligatorio.";
    return;
  }

  const jwt = ensureToken();
  if (!jwt) return;

  isSaving.value = true;
  formError.value = null;

  try {
    if (!editingArea.value) {
      // Crear
      const res = await fetch("http://localhost:3000/support-areas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
      // Editar
      const res = await fetch(
        `http://localhost:3000/support-areas/${editingArea.value.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            name,
            isActive: form.value.isActive,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(`Error ${res.status} al actualizar área`);
      }

      const updated = await res.json();
      const idx = areas.value.findIndex((a) => a.id === updated.id);
      if (idx !== -1) {
        areas.value[idx] = updated;
      }
    }

    closeModal();
  } catch (e: any) {
    console.error(e);
    formError.value =
      e.message ?? "No se pudo guardar el área. Intenta nuevamente.";
  } finally {
    isSaving.value = false;
  }
}

// Activar / desactivar
async function toggleActive(area: SupportArea) {
  const jwt = ensureToken();
  if (!jwt) return;

  try {
    const res = await fetch(`http://localhost:3000/support-areas/${area.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
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
    const idx = areas.value.findIndex((a) => a.id === updated.id);
    if (idx !== -1) {
      areas.value[idx] = updated;
    }
  } catch (e: any) {
    console.error(e);
    error.value =
      e.message ?? "No se pudo cambiar el estado del área seleccionada.";
  }
}

// Confirmar eliminación (soft delete)
function confirmSoftDelete(area: SupportArea) {
  deleteTarget.value = area;
}

// Ejecutar eliminación
async function softDelete() {
  if (!deleteTarget.value) return;
  const jwt = ensureToken();
  if (!jwt) return;

  isDeleting.value = true;
  try {
    const res = await fetch(
      `http://localhost:3000/support-areas/${deleteTarget.value.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Error ${res.status} al eliminar área`);
    }

    // DELETE devuelve el área actualizada (inactiva)
    const updated = await res.json();
    const idx = areas.value.findIndex((a) => a.id === updated.id);
    if (idx !== -1) {
      areas.value[idx] = updated;
    }

    deleteTarget.value = null;
  } catch (e: any) {
    console.error(e);
    error.value = e.message ?? "No se pudo eliminar el área.";
  } finally {
    isDeleting.value = false;
  }
}

onMounted(() => {
  loadAreas();
});
</script>

<style scoped>
/* Puedes añadir pequeños ajustes si hace falta */
</style>
