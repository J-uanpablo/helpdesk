<!-- src/views/ClientTicketsView.vue -->
<template>
  <main class="p-6 text-white bg-[#050b1a] min-h-screen">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Mis Tickets</h1>

      <router-link
        to="/cliente/nuevo-ticket"
        class="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-sm font-medium"
      >
        + Crear nuevo ticket
      </router-link>
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-red-100 text-red-700 px-4 py-3 rounded mb-4">
      {{ error }}
      <div v-if="debugMessage" class="mt-1 text-xs text-red-600">
        {{ debugMessage }}
      </div>
    </div>

    <!-- Cargando -->
    <div v-if="isLoading" class="text-gray-400">Cargando tus tickets...</div>

    <!-- Lista -->
    <div v-if="!isLoading && tickets.length > 0" class="space-y-3 max-w-3xl">
      <div
        v-for="t in tickets"
        :key="t.id"
        class="border border-slate-700 bg-slate-900/60 p-4 rounded shadow-sm flex justify-between items-center"
      >
        <div>
          <h3 class="font-semibold text-lg">
            {{ t.subject ?? "Sin asunto" }}
          </h3>
          <p class="text-sm text-gray-400">
            Estado: <strong>{{ t.status }}</strong>
          </p>
          <p class="text-xs text-gray-500">
            Creado: {{ formatDate(t.createdAt) }}
          </p>
        </div>

        <router-link
          :to="`/cliente/ticket/${t.id}`"
          class="px-3 py-1 bg-emerald-500 text-white rounded text-sm hover:bg-emerald-600"
        >
          Abrir chat
        </router-link>
      </div>
    </div>

    <!-- Sin tickets -->
    <div
      v-if="!isLoading && tickets.length === 0 && !error"
      class="text-gray-400 text-center mt-10"
    >
      No tienes tickets creados todavía.
    </div>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useAuth } from "../composables/useAuth";

interface ClientTicket {
  id: number;
  subject?: string;
  status?: string;
  createdAt?: string;
}

const { token } = useAuth();

const tickets = ref<ClientTicket[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const debugMessage = ref<string | null>(null);

function formatDate(date?: string) {
  if (!date) return "—";
  return new Date(date).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

async function loadMyTickets() {
  error.value = null;
  debugMessage.value = null;

  const jwt = (token.value ?? "").trim();
  console.log("🔑 JWT en ClientTicketsView:", jwt);

  if (!jwt) {
    error.value = "No hay token JWT. Inicia sesión nuevamente.";
    return;
  }

  isLoading.value = true;
  try {
    const res = await fetch("http://localhost:3000/tickets/my", {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!res.ok) {
      let backendMsg = "";
      try {
        const text = await res.text();
        backendMsg = text;
      } catch {
        backendMsg = "";
      }
      console.error("❌ Error HTTP en /tickets/my:", res.status, backendMsg);
      error.value = `Error ${res.status} al cargar tus tickets`;
      debugMessage.value = backendMsg || null;
      return;
    }

    const data = await res.json();
    tickets.value = data;
  } catch (err: any) {
    console.error(err);
    error.value = err.message;
  } finally {
    isLoading.value = false;
  }
}

onMounted(loadMyTickets);
</script>

<style scoped></style>
