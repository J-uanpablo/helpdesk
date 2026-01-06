<script setup lang="ts">
import { ref } from "vue";

const email = ref("");
const loading = ref(false);
const message = ref<string | null>(null);
const error = ref<string | null>(null);

// ⚠️ Ajusta si tu API base está en otro lado
const API_URL = "http://localhost:3000";

async function handleSubmit() {
  error.value = null;
  message.value = null;

  const e = email.value.trim();
  if (!e) return;

  loading.value = true;
  try {
    const res = await fetch(`${API_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: e }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.message || "No se pudo procesar la solicitud.");
    }

    // Siempre respuesta neutra (seguridad)
    message.value =
      data?.message ||
      "Si el correo existe, te enviaremos un enlace para restablecer la contraseña.";
  } catch (err: any) {
    error.value = err?.message || "Error inesperado.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div
    class="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center px-4"
  >
    <div
      class="w-full max-w-md bg-slate-950/80 border border-slate-800 rounded-2xl p-6 shadow-xl"
    >
      <h1 class="text-2xl font-bold mb-1 text-center">
        Restablecer contraseña
      </h1>
      <p class="text-xs text-slate-400 mb-4 text-center">
        Escribe tu correo. Si existe, te enviaremos un enlace.
      </p>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-1">
          <label class="block text-xs text-slate-300">Correo electrónico</label>
          <input
            v-model="email"
            type="email"
            class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="correo@ejemplo.com"
            required
          />
        </div>

        <p v-if="message" class="text-[11px] text-emerald-400">{{ message }}</p>
        <p v-if="error" class="text-[11px] text-rose-400">{{ error }}</p>

        <button
          type="submit"
          class="w-full mt-2 px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="loading"
        >
          {{ loading ? "Enviando..." : "Enviar enlace" }}
        </button>

        <div class="text-center mt-2">
          <RouterLink
            :to="{ name: 'login' }"
            class="text-[11px] text-slate-400 hover:text-slate-200"
          >
            Volver al login
          </RouterLink>
        </div>
      </form>
    </div>
  </div>
</template>
