<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';

const email = ref('');
const loading = ref(false);
const message = ref<string | null>(null);
const error = ref<string | null>(null);

const API_URL = 'http://localhost:3000';

async function handleSubmit() {
  error.value = null;
  message.value = null;

  const e = email.value.trim();
  if (!e) return;

  loading.value = true;
  try {
    const res = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: e }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.message || 'No se pudo procesar la solicitud.');
    }

    message.value =
      data?.message ||
      'Si el correo existe, te enviaremos un enlace para restablecer la contraseña.';
  } catch (err: any) {
    error.value = err?.message || 'Error inesperado.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-8">
    <!-- 🔥 Fondo premium (igual al login) -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        class="absolute inset-0 bg-gradient-to-br from-[#f8fafc] via-[#eef2f7] to-[#e9eef5]"
      ></div>

      <div
        class="absolute -top-40 left-1/4 w-[520px] h-[520px] rounded-full bg-[#0b1933]/5 blur-3xl"
      ></div>

      <div
        class="absolute bottom-[-120px] right-[-80px] w-[460px] h-[460px] rounded-full bg-[#0b1933]/10 blur-3xl"
      ></div>

      <div
        class="absolute top-[20%] right-[18%] w-[240px] h-[240px] rounded-full bg-white/40 blur-3xl"
      ></div>

      <div
        class="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(59,130,246,0.08),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(11,25,51,0.08),transparent_35%)]"
      ></div>

      <div
        class="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:42px_42px]"
      ></div>
    </div>

    <!-- Card -->
    <div
      class="relative z-10 w-full max-w-md rounded-2xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.12)] p-6"
    >
      <!-- Logo -->
      <div class="flex flex-col items-center text-center mb-6">
        <div class="bg-white rounded-2xl p-3 shadow-md mb-3">
          <img
            src="https://clinicasagradafamilia.net/logos-firmas/Logo-IT-Sin-Fondo.png"
            class="w-16 h-16 object-contain"
          />
        </div>

        <h1 class="text-xl font-bold text-[#07152d]">Restablecer contraseña</h1>

        <p class="text-sm text-slate-500 mt-1">Ingresa tu correo y te enviaremos un enlace.</p>
      </div>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-1">
          <label class="block text-sm font-medium text-slate-600"> Correo electrónico </label>

          <input
            v-model="email"
            type="email"
            placeholder="correo@ejemplo.com"
            required
            class="w-full rounded-xl border border-slate-300 bg-white text-slate-800 px-4 py-3 text-sm outline-none transition shadow-sm focus:border-[#d1332f] focus:ring-4 focus:ring-[#d1332f]/15"
          />
        </div>

        <!-- mensajes -->
        <p
          v-if="message"
          class="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg"
        >
          {{ message }}
        </p>

        <p
          v-if="error"
          class="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg"
        >
          {{ error }}
        </p>

        <!-- botón -->
        <button
          type="submit"
          :disabled="loading"
          class="w-full mt-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#c62d28] to-[#df3732] text-sm font-semibold text-white shadow-md hover:scale-[1.01] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? 'Enviando...' : 'Enviar enlace' }}
        </button>

        <!-- volver -->
        <div class="text-center mt-2">
          <RouterLink
            :to="{ name: 'login' }"
            class="text-xs text-slate-500 hover:text-[#d1332f] transition"
          >
            ← Volver al login
          </RouterLink>
        </div>
      </form>
    </div>
  </div>
</template>
