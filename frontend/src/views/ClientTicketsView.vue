<!-- src/views/ClientTicketsView.vue -->
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useAuth } from "../composables/useAuth";

interface ClientTicket {
  id: number;
  subject?: string;
  status?: string;
  createdAt?: string;
}

const { token, user } = useAuth();

const tickets = ref<ClientTicket[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

async function loadMyTickets() {
  error.value = null;

  const jwt = (token.value ?? "").trim();
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
      throw new Error(`Error ${res.status} al cargar tus tickets`);
    }

    const data = await res.json();
    tickets.value = data;
  } catch (err: any) {
    console.error(err);
    error.value = err.message || "No se pudieron cargar tus tickets.";
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadMyTickets();
});
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
    <header class="px-6 pt-4 pb-3 border-b border-slate-800">
      <div
        class="max-w-4xl mx-auto flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 class="text-2xl font-bold">Mis tickets</h1>
          <p class="text-xs text-slate-400">
            Aquí puedes ver los tickets que has creado en la mesa de ayuda.
          </p>
        </div>
        <div class="text-right text-[11px] text-slate-300">
          <p>
            Sesión:
            <span class="font-semibold">
              {{ user?.name || "Usuario" }}
            </span>
          </p>
          <p v-if="user?.email" class="text-slate-500">
            {{ user.email }}
          </p>
        </div>
      </div>
    </header>

    <main class="flex-1 px-4 py-4">
      <div
        class="max-w-4xl mx-auto bg-slate-950/70 border border-slate-800 rounded-xl p-4"
      >
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold">Listado de tickets</h2>
          <button
            type="button"
            class="text-xs px-3 py-1 rounded-md border border-emerald-500 text-emerald-300 hover:bg-emerald-500/10"
            @click="loadMyTickets"
            :disabled="isLoading"
          >
            {{ isLoading ? "Actualizando..." : "Actualizar" }}
          </button>
        </div>

        <p v-if="error" class="text-xs text-rose-400 mb-3">
          {{ error }}
        </p>

        <div
          v-if="tickets.length === 0 && !isLoading"
          class="text-sm text-slate-500"
        >
          Aún no tienes tickets registrados.
        </div>

        <ul v-else class="space-y-2">
          <li
            v-for="t in tickets"
            :key="t.id"
            class="border border-slate-800 rounded-lg px-3 py-2 text-sm bg-slate-900/80"
          >
            <div class="flex justify-between items-center gap-2">
              <span class="font-semibold">
                Ticket #{{ t.id }} – {{ t.subject || "Sin asunto" }}
              </span>
              <span
                class="text-[11px] px-2 py-0.5 rounded-full border"
                :class="{
                  'border-emerald-500 text-emerald-300': t.status === 'PENDING',
                  'border-amber-400 text-amber-300': t.status === 'IN_PROGRESS',
                  'border-sky-400 text-sky-300': t.status === 'RESOLVED',
                  'border-slate-500 text-slate-300':
                    !t.status || t.status === 'CLOSED',
                }"
              >
                {{
                  t.status === "PENDING"
                    ? "Abierto"
                    : t.status === "IN_PROGRESS"
                    ? "En progreso"
                    : t.status === "RESOLVED"
                    ? "Resuelto"
                    : t.status === "CLOSED"
                    ? "Cerrado"
                    : t.status || "Sin estado"
                }}
              </span>
            </div>
            <p class="text-[11px] text-slate-500 mt-0.5">
              {{ t.createdAt ? new Date(t.createdAt).toLocaleString() : "" }}
            </p>
          </li>
        </ul>
      </div>
    </main>
  </div>
</template>
