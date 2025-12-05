<!-- src/views/AdminAgentsView.vue -->
<template>
  <main class="min-h-screen bg-[#050b1a] text-white p-6">
    <header class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Gestión de agentes</h1>
        <p class="text-sm text-gray-400">
          Crea y administra los agentes de soporte y sus áreas.
        </p>
      </div>

      <router-link
        to="/soporte"
        class="text-sm px-3 py-1 border border-slate-600 rounded hover:bg-slate-800"
      >
        ← Volver al panel de tickets
      </router-link>
    </header>

    <section class="grid gap-6 md:grid-cols-[2fr,1.3fr]">
      <!-- LISTA DE AGENTES -->
      <div class="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">Agentes registrados</h2>
          <button
            class="text-xs px-2 py-1 border border-slate-600 rounded hover:bg-slate-800"
            @click="loadAgents"
          >
            Recargar
          </button>
        </div>

        <div v-if="error" class="mb-3 text-sm text-red-400">
          {{ error }}
        </div>

        <div v-if="isLoading" class="text-gray-400 text-sm">
          Cargando agentes...
        </div>

        <div v-else>
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="border-b border-slate-700 text-xs text-gray-400">
                <th class="py-2 text-left">Nombre</th>
                <th class="py-2 text-left">Correo</th>
                <th class="py-2 text-left">Área</th>
                <th class="py-2 text-center">Activo</th>
                <th class="py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="agent in agents"
                :key="agent.id"
                class="border-b border-slate-800/70"
              >
                <td class="py-2">
                  <input
                    v-model="agent.editName"
                    type="text"
                    class="bg-transparent border border-slate-700 rounded px-2 py-1 text-xs w-full"
                  />
                </td>
                <td class="py-2 text-xs text-gray-300">
                  {{ agent.email }}
                </td>
                <td class="py-2">
                  <select
                    v-model="agent.editArea"
                    class="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs w-full"
                  >
                    <option value="">(Sin área)</option>
                    <option value="Sistemas">Sistemas</option>
                    <option value="Talento Humano">Talento Humano</option>
                    <option value="Contabilidad">Contabilidad</option>
                    <option value="Dirección">Dirección</option>
                  </select>
                </td>
                <td class="py-2 text-center">
                  <label class="inline-flex items-center gap-1 text-xs">
                    <input
                      v-model="agent.editIsActive"
                      type="checkbox"
                      class="accent-emerald-500"
                    />
                    <span>{{ agent.editIsActive ? "Sí" : "No" }}</span>
                  </label>
                </td>
                <td class="py-2 text-right">
                  <button
                    class="text-xs px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50"
                    :disabled="agent.isSaving"
                    @click="saveAgent(agent)"
                  >
                    {{ agent.isSaving ? "Guardando..." : "Guardar" }}
                  </button>
                </td>
              </tr>

              <tr v-if="agents.length === 0">
                <td colspan="5" class="py-4 text-center text-gray-500 text-sm">
                  No hay agentes registrados.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- FORMULARIO NUEVO AGENTE -->
      <div class="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
        <h2 class="text-lg font-semibold mb-4">Crear nuevo agente</h2>

        <form class="space-y-3" @submit.prevent="handleCreateAgent">
          <div>
            <label class="block text-xs mb-1">Nombre completo</label>
            <input
              v-model="form.name"
              type="text"
              class="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label class="block text-xs mb-1">Correo electrónico</label>
            <input
              v-model="form.email"
              type="email"
              class="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label class="block text-xs mb-1">Contraseña inicial</label>
            <input
              v-model="form.password"
              type="password"
              class="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: Agent123!"
              required
            />
          </div>

          <div>
            <label class="block text-xs mb-1">Área de soporte</label>
            <select
              v-model="form.supportArea"
              class="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm"
            >
              <option value="">Selecciona un área</option>
              <option value="Sistemas">Sistemas</option>
              <option value="Talento Humano">Talento Humano</option>
              <option value="Contabilidad">Contabilidad</option>
              <option value="Dirección">Dirección</option>
            </select>
          </div>

          <p v-if="formError" class="text-xs text-red-400">
            {{ formError }}
          </p>
          <p v-if="formSuccess" class="text-xs text-emerald-400">
            Agente creado correctamente.
          </p>

          <button
            type="submit"
            class="mt-2 px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold disabled:opacity-50"
            :disabled="isCreating"
          >
            {{ isCreating ? "Creando..." : "Crear agente" }}
          </button>
        </form>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useAuth } from "../composables/useAuth";

const { token } = useAuth();

interface AgentRow {
  id: number;
  name: string;
  email: string;
  supportArea: string | null;
  isActive: boolean;

  // campos de edición
  editName: string;
  editArea: string;
  editIsActive: boolean;
  isSaving: boolean;
}

const agents = ref<AgentRow[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

// Formulario nuevo agente
const form = reactive({
  name: "",
  email: "",
  password: "",
  supportArea: "",
});
const isCreating = ref(false);
const formError = ref<string | null>(null);
const formSuccess = ref(false);

function getJwt(): string | null {
  const jwt = (token.value ?? "").trim();
  return jwt || null;
}

async function loadAgents() {
  error.value = null;
  isLoading.value = true;

  const jwt = getJwt();
  if (!jwt) {
    error.value = "No hay sesión activa.";
    isLoading.value = false;
    return;
  }

  try {
    const res = await fetch("http://localhost:3000/users/agents", {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Error ${res.status} al cargar agentes`);
    }

    const data = await res.json();
    agents.value = data.map((a: any) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      supportArea: a.supportArea ?? null,
      isActive: a.isActive,

      editName: a.name ?? "",
      editArea: a.supportArea ?? "",
      editIsActive: a.isActive,
      isSaving: false,
    }));
  } catch (e: any) {
    console.error(e);
    error.value = e.message ?? "No se pudieron cargar los agentes.";
  } finally {
    isLoading.value = false;
  }
}

async function saveAgent(agent: AgentRow) {
  const jwt = getJwt();
  if (!jwt) {
    error.value = "No hay sesión activa.";
    return;
  }

  agent.isSaving = true;

  try {
    const res = await fetch(`http://localhost:3000/users/agents/${agent.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        name: agent.editName,
        supportArea: agent.editArea || null,
        isActive: agent.editIsActive,
      }),
    });

    if (!res.ok) {
      throw new Error(`Error ${res.status} al actualizar el agente`);
    }

    const updated = await res.json();

    agent.name = updated.name;
    agent.supportArea = updated.supportArea ?? null;
    agent.isActive = updated.isActive;

    agent.editName = updated.name;
    agent.editArea = updated.supportArea ?? "";
    agent.editIsActive = updated.isActive;
  } catch (e: any) {
    console.error(e);
    error.value = e.message ?? "No se pudo actualizar el agente.";
  } finally {
    agent.isSaving = false;
  }
}

async function handleCreateAgent() {
  formError.value = null;
  formSuccess.value = false;

  const jwt = getJwt();
  if (!jwt) {
    formError.value = "No hay sesión activa.";
    return;
  }

  if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
    formError.value = "Nombre, correo y contraseña son obligatorios.";
    return;
  }

  isCreating.value = true;

  try {
    const res = await fetch("http://localhost:3000/users/agents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password.trim(),
        supportArea: form.supportArea || null,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status} al crear el agente`);
    }

    const created = await res.json();
    formSuccess.value = true;

    agents.value.push({
      id: created.id,
      name: created.name,
      email: created.email,
      supportArea: created.supportArea ?? null,
      isActive: created.isActive,

      editName: created.name,
      editArea: created.supportArea ?? "",
      editIsActive: created.isActive,
      isSaving: false,
    });

    // limpiar form
    form.name = "";
    form.email = "";
    form.password = "";
    form.supportArea = "";
  } catch (e: any) {
    console.error(e);
    formError.value = e.message ?? "No se pudo crear el agente.";
  } finally {
    isCreating.value = false;
  }
}

onMounted(() => {
  loadAgents();
});
</script>

<style scoped></style>
