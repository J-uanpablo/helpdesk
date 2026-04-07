<!-- src/views/ResetPasswordView.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';

const route = useRoute();
const router = useRouter();

const token = computed(() => String(route.query.token || ''));
const email = computed(() => String(route.query.email || ''));

const newPassword = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);

const loading = ref(false);
const message = ref<string | null>(null);
const error = ref<string | null>(null);

const API_URL = 'http://localhost:3000';

function validate() {
  if (!email.value || !token.value) {
    return 'El enlace no es válido (faltan datos).';
  }
  if (newPassword.value.length < 8) {
    return 'La contraseña debe tener mínimo 8 caracteres.';
  }
  if (newPassword.value !== confirmPassword.value) {
    return 'Las contraseñas no coinciden.';
  }
  return null;
}

async function handleSubmit() {
  error.value = null;
  message.value = null;

  const v = validate();
  if (v) {
    error.value = v;
    return;
  }

  loading.value = true;
  try {
    const res = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        token: token.value,
        newPassword: newPassword.value,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.message || 'No se pudo actualizar la contraseña.');
    }

    message.value = data?.message || 'Contraseña actualizada. Ya puedes iniciar sesión.';

    setTimeout(() => {
      router.push({ name: 'login' });
    }, 900);
  } catch (err: any) {
    error.value = err?.message || 'Error inesperado.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-8">
    <!-- Fondo premium -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <!-- base -->
      <div
        class="absolute inset-0 bg-gradient-to-br from-[#f8fafc] via-[#eef2f7] to-[#e9eef5]"
      ></div>

      <!-- glows -->
      <div
        class="absolute -top-40 left-1/4 w-[520px] h-[520px] rounded-full bg-[#0b1933]/1 blur-3xl"
      ></div>

      <div
        class="absolute bottom-[-120px] right-[-80px] w-[460px] h-[460px] rounded-full bg-[#0b1933]/10 blur-3xl"
      ></div>

      <div
        class="absolute top-[20%] right-[18%] w-[240px] h-[240px] rounded-full bg-white/40 blur-3xl"
      ></div>

      <!-- spotlight radial -->
      <div
        class="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(59,130,246,0.08),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(11,25,51,0.08),transparent_35%)]"
      ></div>

      <!-- grid sutil -->
      <div
        class="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:42px_42px]"
      ></div>
    </div>

    <!-- Card -->
    <div
      class="relative z-10 w-full max-w-md rounded-2xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.12)] p-6"
    >
      <!-- Logo / Encabezado -->
      <div class="flex flex-col items-center text-center mb-6">
        <div class="bg-white rounded-2xl p-3 shadow-md mb-3">
          <img
            src="https://clinicasagradafamilia.net/logos-firmas/Logo-IT-Sin-Fondo.png"
            alt="IT Management"
            class="w-16 h-16 object-contain"
          />
        </div>

        <h1 class="text-xl font-bold text-[#07152d]">Nueva contraseña</h1>

        <p class="text-sm text-slate-500 mt-1">
          Cambia tu contraseña para
          <span class="font-medium text-slate-700 break-all">{{ email || 'tu cuenta' }}</span>
        </p>
      </div>

      <!-- Enlace inválido -->
      <div
        v-if="!token || !email"
        class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 text-center"
      >
        El enlace no es válido. Solicita un nuevo restablecimiento.
      </div>

      <!-- Form -->
      <form v-else class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-1.5">
          <label class="block text-sm font-medium text-slate-600">Nueva contraseña</label>
          <div class="relative">
            <input
              v-model="newPassword"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              required
              class="w-full rounded-xl border border-slate-300 text-slate-800 bg-white px-4 py-3 pr-20 text-sm outline-none transition shadow-sm focus:border-[#d1332f] focus:ring-4 focus:ring-[#d1332f]/15"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-3 text-xs font-medium text-slate-500 hover:text-[#07152d] transition"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? 'Ocultar' : 'Ver' }}
            </button>
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="block text-sm font-medium text-slate-600">Confirmar contraseña</label>
          <input
            v-model="confirmPassword"
            :type="showPassword ? 'text' : 'password'"
            placeholder="••••••••"
            required
            class="w-full rounded-xl border border-slate-300 bg-white text-slate-800 px-4 py-3 text-sm outline-none transition shadow-sm focus:border-[#d1332f] focus:ring-4 focus:ring-[#d1332f]/15"
          />
        </div>

        <p
          v-if="message"
          class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          {{ message }}
        </p>

        <p
          v-if="error"
          class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full mt-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#c62d28] to-[#df3732] text-sm font-semibold text-white shadow-md hover:scale-[1.01] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? 'Actualizando...' : 'Actualizar contraseña' }}
        </button>

        <div class="text-center mt-2">
          <RouterLink
            :to="{ name: 'forgot-password' }"
            class="text-xs text-slate-500 hover:text-[#d1332f] transition"
          >
            Solicitar otro enlace
          </RouterLink>
        </div>
      </form>
    </div>
  </div>
</template>
