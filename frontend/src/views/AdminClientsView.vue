<!-- src/views/AdminClientsView.vue -->
<script setup lang="ts">
import { reactive, ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../composables/useAuth";

interface AdminClient {
  id: number;
  name: string;
  email: string;
  cargo?: string | null;
  sede?: string | null;
  supportArea?: string | null; // texto libre
  isActive: boolean;
  createdAt: string;
}

const router = useRouter();
const { token, user, initAuth, logout } = useAuth();

const clients = ref<AdminClient[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

// filtros
const searchText = ref("");
const sedeFilter = ref("all");
const areaFilter = ref("all");

// modales
const showNewModal = ref(false);
const showEditModal = ref(false);

// toggles ver/ocultar contraseña
const showNewClientPassword = ref(false);
const showEditClientPassword = ref(false);

// formularios
const newClientForm = reactive({
  name: "",
  email: "",
  cargo: "",
  sede: "",
  supportArea: "", // texto que escribes a mano
  password: "",
  isActive: true,
});

const editClientForm = reactive({
  id: 0,
  name: "",
  email: "",
  cargo: "",
  sede: "",
  supportArea: "",
  password: "",
  isActive: true,
});

// helpers
const filteredClients = computed(() => {
  const text = searchText.value.trim().toLowerCase();
  const sede = sedeFilter.value;
  const area = areaFilter.value;

  return clients.value.filter((c) => {
    const matchesText =
      !text ||
      c.name.toLowerCase().includes(text) ||
      c.email.toLowerCase().includes(text);

    const sedeValue = (c.sede || "").trim().toLowerCase();
    const areaValue = (c.supportArea || "").trim().toLowerCase();

    const matchesSede = sede === "all" || sedeValue === sede.toLowerCase();
    const matchesArea = area === "all" || areaValue === area.toLowerCase();

    return matchesText && matchesSede && matchesArea;
  });
});

const totalClients = computed(() => clients.value.length);

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("es-CO");
}

// =============================
// Cargar clientes
// =============================
async function loadClients() {
  error.value = null;
  if (!token.value) return;

  isLoading.value = true;
  try {
    const res = await fetch("http://localhost:3000/users/clients", {
      headers: {
        Authorization: `Bearer ${token.value}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Error ${res.status} al cargar los clientes`);
    }

    const data = (await res.json()) as AdminClient[];
    clients.value = data;
  } catch (e: any) {
    console.error(e);
    error.value = e.message || "Error al cargar los clientes";
  } finally {
    isLoading.value = false;
  }
}

// =============================
// Crear cliente
// =============================
async function createClient() {
  if (!token.value) return;
  error.value = null;

  try {
    const payload: any = {
      name: newClientForm.name.trim(),
      email: newClientForm.email.trim(),
      cargo: newClientForm.cargo.trim() || undefined,
      sede: newClientForm.sede.trim() || undefined,
      supportArea: newClientForm.supportArea.trim() || undefined,
      password: newClientForm.password,
      isActive: newClientForm.isActive,
    };

    const res = await fetch("http://localhost:3000/users/clients", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.value}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        data.message || `Error ${res.status} al crear el cliente`
      );
    }

    const created = (await res.json()) as AdminClient;
    clients.value.push(created);
    showNewModal.value = false;

    // limpiar formulario
    newClientForm.name = "";
    newClientForm.email = "";
    newClientForm.cargo = "";
    newClientForm.sede = "";
    newClientForm.supportArea = "";
    newClientForm.password = "";
    newClientForm.isActive = true;
    showNewClientPassword.value = false;
  } catch (e: any) {
    console.error(e);
    error.value = e.message || "Error al crear el cliente";
  }
}

// =============================
// Abrir modal de edición
// =============================
function openEditClient(c: AdminClient) {
  editClientForm.id = c.id;
  editClientForm.name = c.name;
  editClientForm.email = c.email;
  editClientForm.cargo = c.cargo || "";
  editClientForm.sede = c.sede || "";
  editClientForm.supportArea = c.supportArea || "";
  editClientForm.password = "";
  editClientForm.isActive = c.isActive;
  showEditClientPassword.value = false;
  showEditModal.value = true;
}

// =============================
// Guardar cambios cliente
// =============================
async function updateClient() {
  if (!token.value) return;
  error.value = null;

  try {
    const payload: any = {
      name: editClientForm.name.trim(),
      email: editClientForm.email.trim(),
      cargo: editClientForm.cargo.trim() || undefined,
      sede: editClientForm.sede.trim() || undefined,
      supportArea: editClientForm.supportArea.trim() || undefined,
      isActive: editClientForm.isActive,
    };

    if (editClientForm.password) {
      payload.password = editClientForm.password;
    }

    const res = await fetch(
      `http://localhost:3000/users/clients/${editClientForm.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token.value}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        data.message || `Error ${res.status} al actualizar el cliente`
      );
    }

    const updated = (await res.json()) as AdminClient;

    const idx = clients.value.findIndex((c) => c.id === updated.id);
    if (idx !== -1) {
      clients.value[idx] = updated;
    }

    showEditModal.value = false;
  } catch (e: any) {
    console.error(e);
    error.value = e.message || "Error al actualizar el cliente";
  }
}

// =============================
// Activar / desactivar cliente
// =============================
async function toggleClientActive(c: AdminClient) {
  if (!token.value) return;
  error.value = null;

  try {
    const res = await fetch(`http://localhost:3000/users/clients/${c.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.value}`,
      },
      body: JSON.stringify({ isActive: !c.isActive }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        data.message || `Error ${res.status} al actualizar el estado`
      );
    }

    const updated = (await res.json()) as AdminClient;
    const idx = clients.value.findIndex((x) => x.id === updated.id);
    if (idx !== -1) {
      clients.value[idx] = updated;
    }
  } catch (e: any) {
    console.error(e);
    error.value = e.message || "Error al cambiar estado del cliente";
  }
}

function goBackToPanel() {
  router.push({ name: "soporte" });
}

async function confirmLogout() {
  await logout();
  router.push({ name: "login" });
}

onMounted(async () => {
  initAuth();
  if (!token.value) {
    router.push({ name: "login" });
    return;
  }
  await loadClients();
});
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <!-- HEADER -->
    <header class="px-6 pt-4 pb-3 border-b border-slate-800">
      <div
        class="max-w-6xl mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <p class="text-xs text-slate-400 mb-1">
            Administración de usuarios finales
          </p>
          <h1 class="text-2xl md:text-3xl font-bold">
            Administración de clientes
          </h1>
          <p class="text-xs text-slate-400">
            Crea y gestiona los usuarios finales que usan la mesa de ayuda.
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
              @click="goBackToPanel"
              class="h-8 px-3 rounded-md bg-slate-700 hover:bg-slate-600 text-xs font-semibold"
            >
              ← Volver al panel
            </button>

            <button
              type="button"
              @click="showNewModal = true"
              class="h-8 px-3 rounded-md bg-emerald-500 hover:bg-emerald-600 text-xs font-semibold"
            >
              Nuevo cliente
            </button>

            <button
              @click="confirmLogout"
              class="h-8 px-3 rounded-md bg-red-500 hover:bg-red-600 text-xs font-semibold"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- CONTENIDO -->
    <main class="px-6 py-4">
      <div class="max-w-6xl mx-auto space-y-3">
        <!-- filtros -->
        <div
          class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
        >
          <!-- Buscar -->
          <div class="flex-1 flex flex-col md:flex-row md:items-center gap-2">
            <label class="text-xs text-slate-400">Buscar:</label>
            <input
              v-model="searchText"
              type="text"
              class="flex-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Nombre o correo..."
            />
          </div>

          <!-- Filtro Área + Sede -->
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex items-center gap-2">
              <label class="text-xs text-slate-400">Área:</label>
              <select
                v-model="areaFilter"
                class="rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Todas las áreas</option>
                <option
                  v-for="a in Array.from(
                    new Set(
                      clients
                        .map((c) => (c.supportArea || '').trim())
                        .filter((x) => x)
                    )
                  )"
                  :key="a"
                  :value="a"
                >
                  {{ a }}
                </option>
              </select>
            </div>

            <div class="flex items-center gap-2">
              <label class="text-xs text-slate-400">Sede:</label>
              <select
                v-model="sedeFilter"
                class="rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Todas las sedes</option>
                <option
                  v-for="s in Array.from(
                    new Set(
                      clients.map((c) => (c.sede || '').trim()).filter((x) => x)
                    )
                  )"
                  :key="s"
                  :value="s"
                >
                  {{ s }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <p class="text-[11px] text-slate-500">
          Mostrando {{ filteredClients.length }} de {{ totalClients }} clientes.
        </p>

        <p v-if="error" class="text-[11px] text-rose-400">
          {{ error }}
        </p>

        <!-- tabla -->
        <div class="Overflow-x-auto rounded-xl border border-slate-800">
          <table class="min-w-full text-xs">
            <thead class="bg-slate-900/70 text-slate-400">
              <tr>
                <th class="px-4 py-2 text-left font-semibold">Nombre</th>
                <th class="px-4 py-2 text-left font-semibold">Correo</th>
                <th class="px-4 py-2 text-left font-semibold">Cargo</th>
                <th class="px-4 py-2 text-left font-semibold">Área</th>
                <th class="px-4 py-2 text-left font-semibold">Sede</th>
                <th class="px-4 py-2 text-left font-semibold">Estado</th>
                <th class="px-4 py-2 text-left font-semibold">Creado</th>
                <th class="px-4 py-2 text-left font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-if="isLoading"
                class="border-t border-slate-800 bg-slate-950/60"
              >
                <td colspan="8" class="px-4 py-6 text-center text-slate-500">
                  Cargando clientes...
                </td>
              </tr>

              <tr
                v-else-if="!filteredClients.length"
                class="border-t border-slate-800 bg-slate-950/60"
              >
                <td colspan="8" class="px-4 py-6 text-center text-slate-500">
                  No hay clientes que coincidan con los filtros seleccionados.
                </td>
              </tr>

              <tr
                v-for="c in filteredClients"
                :key="c.id"
                class="border-t border-slate-800 hover:bg-slate-900/60"
              >
                <td class="px-4 py-2">
                  <div class="flex flex-col">
                    <span class="font-semibold text-slate-100">
                      {{ c.name }}
                    </span>
                    <span class="text-[10px] text-slate-500">
                      ID: {{ c.id }}
                    </span>
                  </div>
                </td>

                <td class="px-4 py-2 text-slate-200">
                  {{ c.email }}
                </td>

                <td class="px-4 py-2 text-slate-200">
                  {{ c.cargo || "—" }}
                </td>

                <td class="px-4 py-2 text-slate-200">
                  {{ c.supportArea || "—" }}
                </td>

                <td class="px-4 py-2 text-slate-200">
                  {{ c.sede || "—" }}
                </td>

                <td class="px-4 py-2">
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                    :class="
                      c.isActive
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : 'bg-slate-700/60 text-slate-300'
                    "
                  >
                    <span
                      class="w-1.5 h-1.5 rounded-full"
                      :class="c.isActive ? 'bg-emerald-400' : 'bg-slate-400'"
                    ></span>
                    {{ c.isActive ? "Activo" : "Inactivo" }}
                  </span>
                </td>

                <td class="px-4 py-2 text-slate-400">
                  {{ formatDate(c.createdAt) }}
                </td>

                <td class="px-4 py-2">
                  <div class="flex gap-2">
                    <button
                      class="px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-[10px] font-semibold"
                      @click="openEditClient(c)"
                    >
                      Editar
                    </button>

                    <button
                      class="px-2 py-1 rounded-md text-[10px] font-semibold"
                      :class="
                        c.isActive
                          ? 'bg-amber-500/80 hover:bg-amber-500 text-slate-900'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-slate-900'
                      "
                      @click="toggleClientActive(c)"
                    >
                      {{ c.isActive ? "Desactivar" : "Activar" }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- MODAL NUEVO CLIENTE -->
      <div
        v-if="showNewModal"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      >
        <div
          class="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl"
        >
          <h2 class="text-lg font-semibold mb-1">Nuevo cliente</h2>
          <p class="text-[11px] text-slate-400 mb-4">
            Crea un usuario final que pueda crear y consultar tickets.
          </p>

          <div class="space-y-3 text-xs">
            <div class="space-y-1">
              <label class="block text-slate-300">Nombre completo</label>
              <input
                v-model="newClientForm.name"
                type="text"
                class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div class="space-y-1">
              <label class="block text-slate-300">Correo</label>
              <input
                v-model="newClientForm.email"
                type="email"
                class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div class="space-y-1">
              <label class="block text-slate-300">Cargo</label>
              <input
                v-model="newClientForm.cargo"
                type="text"
                class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div class="space-y-1">
              <label class="block text-slate-300">Área</label>
              <input
                v-model="newClientForm.supportArea"
                type="text"
                class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ej: Sistemas, Talento humano..."
              />
            </div>

            <div class="space-y-1">
              <label class="block text-slate-300">Sede</label>
              <input
                v-model="newClientForm.sede"
                type="text"
                class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div class="space-y-1">
              <label class="block text-slate-300">Contraseña inicial</label>
              <div class="relative">
                <input
                  v-model="newClientForm.password"
                  :type="showNewClientPassword ? 'text' : 'password'"
                  class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 pr-16 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-2 text-[10px] text-slate-400 hover:text-slate-200"
                  @click="showNewClientPassword = !showNewClientPassword"
                >
                  {{ showNewClientPassword ? "Ocultar" : "Ver" }}
                </button>
              </div>
              <p class="text-[10px] text-slate-500">
                El cliente podrá cambiarla más adelante (implementación futura).
              </p>
            </div>

            <div class="flex items-center gap-2 mt-1">
              <input
                v-model="newClientForm.isActive"
                id="newClientActive"
                type="checkbox"
                class="w-3 h-3 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
              />
              <label for="newClientActive" class="text-[11px] text-slate-300">
                Cliente activo
              </label>
            </div>
          </div>

          <div class="mt-5 flex justify-end gap-2 text-xs">
            <button
              type="button"
              class="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600"
              @click="showNewModal = false"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 font-semibold disabled:opacity-50"
              :disabled="
                !newClientForm.name ||
                !newClientForm.email ||
                !newClientForm.password
              "
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
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      >
        <div
          class="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl"
        >
          <h2 class="text-lg font-semibold mb-1">Editar cliente</h2>
          <p class="text-[11px] text-slate-400 mb-4">
            Actualiza los datos del usuario final.
          </p>

          <div class="space-y-3 text-xs">
            <div class="space-y-1">
              <label class="block text-slate-300">Nombre completo</label>
              <input
                v-model="editClientForm.name"
                type="text"
                class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div class="space-y-1">
              <label class="block text-slate-300">Correo</label>
              <input
                v-model="editClientForm.email"
                type="email"
                class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div class="space-y-1">
              <label class="block text-slate-300">Cargo</label>
              <input
                v-model="editClientForm.cargo"
                type="text"
                class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div class="space-y-1">
              <label class="block text-slate-300">Área</label>
              <input
                v-model="editClientForm.supportArea"
                type="text"
                class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ej: Sistemas, Talento humano..."
              />
            </div>

            <div class="space-y-1">
              <label class="block text-slate-300">Sede</label>
              <input
                v-model="editClientForm.sede"
                type="text"
                class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div class="space-y-1">
              <label class="block text-slate-300">Nueva contraseña</label>
              <div class="relative">
                <input
                  v-model="editClientForm.password"
                  :type="showEditClientPassword ? 'text' : 'password'"
                  class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 pr-16 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Dejar en blanco para no cambiarla"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-2 text-[10px] text-slate-400 hover:text-slate-200"
                  @click="showEditClientPassword = !showEditClientPassword"
                >
                  {{ showEditClientPassword ? "Ocultar" : "Ver" }}
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2 mt-1">
              <input
                v-model="editClientForm.isActive"
                id="editClientActive"
                type="checkbox"
                class="w-3 h-3 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
              />
              <label for="editClientActive" class="text-[11px] text-slate-300">
                Cliente activo
              </label>
            </div>
          </div>

          <div class="mt-5 flex justify-end gap-2 text-xs">
            <button
              type="button"
              class="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600"
              @click="showEditModal = false"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 font-semibold"
              @click="updateClient"
            >
              Guardar cambios
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
