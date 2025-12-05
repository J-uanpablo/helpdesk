<!-- src/views/ClientNewTicketView.vue -->
<template>
  <main class="p-6 text-white bg-[#050b1a] min-h-screen">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Crear nuevo ticket</h1>

      <router-link
        to="/cliente"
        class="text-sm px-3 py-1 border border-slate-600 rounded hover:bg-slate-800"
      >
        ← Volver a mis tickets
      </router-link>
    </div>

    <form
      class="max-w-2xl bg-slate-900/70 border border-slate-700 rounded-lg p-5 space-y-4"
      @submit.prevent="handleSubmit"
    >
      <!-- ASUNTO -->
      <div>
        <label class="block text-sm font-medium mb-1">
          Asunto del ticket
        </label>
        <input
          v-model="form.subject"
          type="text"
          class="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="Ej: Problema con el acceso al sistema"
          required
        />
      </div>

      <!-- ÁREA -->
      <div>
        <label class="block text-sm font-medium mb-1">
          Área a la que va dirigido
        </label>
        <select
          v-model="form.area"
          class="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          required
        >
          <!-- Opción placeholder deshabilitada -->
          <option disabled value="">Selecciona un área</option>
          <option value="Sistemas">Sistemas</option>
          <option value="Talento Humano">Talento Humano</option>
          <option value="Contabilidad">Contabilidad</option>
          <option value="Dirección">Dirección</option>
        </select>
      </div>

      <!-- DESCRIPCIÓN -->
      <div>
        <label class="block text-sm font-medium mb-1">
          Describe tu solicitud o problema
        </label>
        <textarea
          v-model="form.description"
          rows="6"
          class="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="Detalla qué está pasando, pasos para reproducir, capturas, etc."
          required
        ></textarea>
      </div>

      <!-- MENSAJES -->
      <p v-if="error" class="text-red-400 text-sm">
        {{ error }}
      </p>

      <p v-if="success" class="text-emerald-400 text-sm">
        Ticket creado correctamente, redirigiendo...
      </p>

      <!-- BOTÓN -->
      <button
        type="submit"
        class="px-6 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-sm font-medium disabled:opacity-50"
        :disabled="isSubmitting"
      >
        {{ isSubmitting ? "Creando..." : "Crear ticket" }}
      </button>
    </form>
  </main>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../composables/useAuth";

const { token } = useAuth();
const router = useRouter();

const form = reactive({
  subject: "",
  description: "",
  area: "",
});

const isSubmitting = ref(false);
const error = ref<string | null>(null);
const success = ref(false);

async function handleSubmit() {
  error.value = null;
  success.value = false;

  const jwt = (token.value ?? "").trim();
  if (!jwt) {
    error.value = "No hay sesión activa. Inicia sesión nuevamente.";
    return;
  }

  // Validación extra por si acaso
  if (!form.subject.trim() || !form.description.trim() || !form.area.trim()) {
    error.value = "Debes completar todos los campos y seleccionar un área.";
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
        subject: form.subject.trim(),
        description: form.description.trim(),
        area: form.area.trim(),
      }),
    });

    if (!res.ok) {
      throw new Error(`Error ${res.status} al crear el ticket`);
    }

    const created = await res.json();
    success.value = true;

    setTimeout(() => {
      if (created?.id) {
        router.push(`/cliente/ticket/${created.id}`);
      } else {
        router.push("/cliente");
      }
    }, 600);
  } catch (e: any) {
    console.error(e);
    error.value = e.message ?? "No se pudo crear el ticket.";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped></style>
