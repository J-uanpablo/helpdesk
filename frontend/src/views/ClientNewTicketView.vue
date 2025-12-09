<!-- src/views/ClientNewTicketView.vue -->
<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../composables/useAuth";

const router = useRouter();
const { token, user, initAuth, logout } = useAuth();

const isSubmitting = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

const form = reactive({
  subject: "",
  area: "",
  description: "",
});

function handleLogout() {
  logout();
  router.push("/login");
}

async function handleSubmit() {
  error.value = null;
  success.value = null;

  const jwt = (token.value ?? "").trim();
  if (!jwt) {
    error.value = "No hay sesión. Inicia sesión nuevamente.";
    return;
  }

  if (!form.subject.trim() || !form.description.trim() || !form.area.trim()) {
    error.value = "Debes completar asunto, área y descripción.";
    return;
  }

  isSubmitting.value = true;
  try {
    const res = await fetch("http://localhost:3000/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        subject: form.subject,
        description: form.description,
        area: form.area,
      }),
    });

    if (!res.ok) {
      throw new Error(`Error ${res.status} al crear el ticket`);
    }

    const data = await res.json();
    success.value = `Ticket #${data.id} creado correctamente.`;
    form.subject = "";
    form.area = "";
    form.description = "";

    setTimeout(() => {
      router.push("/cliente");
    }, 1200);
  } catch (e: any) {
    console.error(e);
    error.value = e.message ?? "No se pudo crear el ticket.";
  } finally {
    isSubmitting.value = false;
  }
}

initAuth();
</script>

<template>
  <main class="min-h-screen bg-[#050b1a] text-white flex flex-col">
    <header
      class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-6 py-4 border-b border-slate-800"
    >
      <div>
        <h1 class="text-2xl md:text-3xl font-bold">Nuevo ticket de ayuda</h1>
        <p class="text-xs text-slate-400">
          Describe tu problema para que el equipo de soporte pueda ayudarte.
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
          <router-link
            to="/cliente"
            class="h-8 px-3 rounded-md border border-slate-600 text-xs flex items-center hover:bg-slate-800"
          >
            ← Volver a mis tickets
          </router-link>

          <button
            type="button"
            @click="handleLogout"
            class="h-8 px-3 rounded-md bg-red-500 hover:bg-red-600 text-xs font-semibold text-white"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>

    <section class="flex-1 px-6 py-6 max-w-3xl w-full mx-auto">
      <form
        class="space-y-4 bg-slate-950/80 border border-slate-800 rounded-lg px-4 py-4"
        @submit.prevent="handleSubmit"
      >
        <div>
          <label class="block text-xs text-slate-300 mb-1">
            Asunto del ticket
          </label>
          <input
            v-model="form.subject"
            type="text"
            class="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Ej: No tengo internet en mi equipo"
          />
        </div>

        <div>
          <label class="block text-xs text-slate-300 mb-1">
            Área a la que va dirigido
          </label>
          <input
            v-model="form.area"
            type="text"
            class="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Ej: Sistemas, Talento humano, etc."
          />
        </div>

        <div>
          <label class="block text-xs text-slate-300 mb-1">
            Describe tu problema
          </label>
          <textarea
            v-model="form.description"
            rows="5"
            class="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Cuéntanos qué sucede con la mayor cantidad de detalles posible..."
          ></textarea>
        </div>

        <div class="flex items-center justify-between pt-2">
          <div class="text-xs">
            <p v-if="error" class="text-rose-400">
              {{ error }}
            </p>
            <p v-if="success" class="text-emerald-400">
              {{ success }}
            </p>
          </div>

          <button
            type="submit"
            class="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? "Creando..." : "Crear ticket" }}
          </button>
        </div>
      </form>
    </section>
  </main>
</template>
