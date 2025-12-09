<!-- src/views/ClientTicketsView.vue -->
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../composables/useAuth";

interface ClientTicket {
  id: number;
  subject?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  area?: string | null;
}
const showLogoutModal = ref(false);

function confirmLogout() {
  showLogoutModal.value = true;
}

function cancelLogout() {
  showLogoutModal.value = false;
}

function doLogout() {
  logout();
  router.push("/login");
}

const router = useRouter();
const { token, user, initAuth, logout } = useAuth();

const tickets = ref<ClientTicket[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

const STATUS_FILTERS = [
  { value: "ALL", label: "Todos" },
  { value: "PENDING", label: "Abiertos" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "RESOLVED", label: "Resueltos" },
  { value: "CLOSED", label: "Cerrados" },
] as const;

type StatusFilterValue =
  | "ALL"
  | "PENDING"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

const statusFilter = ref<StatusFilterValue>("ALL");

function formatDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const filteredTickets = computed(() => {
  let list = [...tickets.value];

  if (statusFilter.value !== "ALL") {
    list = list.filter((t) => t.status === statusFilter.value);
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
const openCount = computed(
  () => tickets.value.filter((t) => t.status === "PENDING").length
);
const inProgressCount = computed(
  () => tickets.value.filter((t) => t.status === "IN_PROGRESS").length
);
const resolvedCount = computed(
  () => tickets.value.filter((t) => t.status === "RESOLVED").length
);
const closedCount = computed(
  () => tickets.value.filter((t) => t.status === "CLOSED").length
);

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
  } catch (e: any) {
    console.error(e);
    error.value = e.message ?? "No se pudo cargar la lista de tickets.";
  } finally {
    isLoading.value = false;
  }
}

function goToNewTicket() {
  router.push("/cliente/nuevo-ticket");
}

function openChat(ticketId: number) {
  router.push(`/cliente/ticket/${ticketId}`);
}

function handleLogout() {
  logout();
  router.push("/login");
}

onMounted(() => {
  initAuth();
  loadMyTickets();
});
</script>

<template>
  <main class="min-h-screen bg-[#050b1a] text-white flex flex-col">
    <!-- Header -->
    <header
      class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-6 py-4 border-b border-slate-800"
    >
      <div>
        <h1 class="text-2xl md:text-3xl font-bold">Mis tickets de ayuda</h1>
        <p class="text-xs text-slate-400">
          Consulta el estado de tus solicitudes y abre el chat con soporte.
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
            @click="loadMyTickets"
            class="h-8 px-3 rounded-md bg-emerald-500 hover:bg-emerald-600 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isLoading || !token"
          >
            {{ isLoading ? "Actualizando..." : "Actualizar lista" }}
          </button>

          <button
            type="button"
            @click="goToNewTicket"
            class="h-8 px-3 rounded-md bg-sky-500 hover:bg-sky-600 text-xs font-semibold"
          >
            Nuevo ticket
          </button>

          <button
            @click="confirmLogout"
            class="px-3 py-1 rounded-md bg-red-500 hover:bg-red-600 text-xs font-semibold text-white"
          >
            Cerrar sesión
          </button>
        </div>

        <p v-if="error" class="text-[11px] text-rose-400 mt-1">
          {{ error }}
        </p>
      </div>
    </header>

    <!-- Filtros -->
    <section class="px-6 pt-4 pb-2 border-b border-slate-800 bg-[#050b1a]">
      <div class="flex flex-wrap gap-2 mb-2">
        <button
          v-for="f in STATUS_FILTERS"
          :key="f.value"
          type="button"
          class="px-3 py-1 rounded-full border text-xs font-semibold transition-colors"
          :class="
            statusFilter === f.value
              ? 'bg-emerald-500 text-white border-emerald-500'
              : 'bg-transparent text-slate-300 border-slate-600 hover:bg-slate-800/60'
          "
          @click="statusFilter = f.value"
        >
          <template v-if="f.value === 'ALL'">
            Todos ({{ totalTickets }})
          </template>
          <template v-else-if="f.value === 'PENDING'">
            Abiertos ({{ openCount }})
          </template>
          <template v-else-if="f.value === 'IN_PROGRESS'">
            En progreso ({{ inProgressCount }})
          </template>
          <template v-else-if="f.value === 'RESOLVED'">
            Resueltos ({{ resolvedCount }})
          </template>
          <template v-else-if="f.value === 'CLOSED'">
            Cerrados ({{ closedCount }})
          </template>
        </button>
      </div>
    </section>

    <!-- Lista de tickets -->
    <section class="flex-1 px-6 py-4 space-y-3">
      <div v-if="filteredTickets.length === 0 && !isLoading" class="mt-6">
        <p class="text-sm text-slate-400">
          No tienes tickets que coincidan con el filtro seleccionado.
        </p>
      </div>

      <article
        v-for="t in filteredTickets"
        :key="t.id"
        class="border border-slate-800 rounded-lg bg-slate-950/80 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
      >
        <div class="space-y-1">
          <h2 class="text-sm md:text-base font-semibold">
            #{{ t.id }} — {{ t.subject || "Sin asunto" }}
          </h2>

          <p class="text-[11px] text-slate-400">
            Área:
            <span class="text-slate-200">
              {{ t.area || "Sin área asignada" }}
            </span>
          </p>

          <p class="text-[11px] text-slate-500">
            Última actualización:
            <span class="text-slate-300">
              {{ formatDate(t.updatedAt || t.createdAt) }}
            </span>
          </p>
        </div>

        <div class="flex items-center gap-3">
          <span
            class="inline-flex items-center px-3 py-1 rounded-full border text-[11px] font-semibold"
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
                ? "ABIERTO"
                : t.status === "IN_PROGRESS"
                ? "EN PROGRESO"
                : t.status === "RESOLVED"
                ? "RESUELTO"
                : t.status === "CLOSED"
                ? "CERRADO"
                : "SIN ESTADO"
            }}
          </span>

          <button
            type="button"
            class="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-xs font-semibold"
            @click="openChat(t.id)"
          >
            Abrir chat
          </button>
        </div>
      </article>
    </section>
    <!-- 🔴 Modal de confirmación para cerrar sesión -->
    <div
      v-if="showLogoutModal"
      class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
    >
      <div
        class="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-sm shadow-xl"
      >
        <h2 class="text-lg font-semibold text-white mb-2">¿Cerrar sesión?</h2>
        <p class="text-sm text-slate-300 mb-4">
          ¿Estás seguro de que deseas cerrar sesión?
        </p>

        <div class="flex justify-end gap-3">
          <button
            @click="cancelLogout"
            class="px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-sm"
          >
            Cancelar
          </button>

          <button
            @click="doLogout"
            class="px-3 py-1 rounded-md bg-red-500 hover:bg-red-600 text-sm font-semibold"
          >
            Sí, cerrar sesión
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
