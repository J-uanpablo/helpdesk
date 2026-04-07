<!-- src/views/LoginView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const router = useRouter();
const { login, isAuthLoading, authError, token, user, initAuth } = useAuth();

const email = ref('');
const password = ref('');
const showPassword = ref(false);

initAuth();

function isStaff(roles: string[] | undefined | null): boolean {
  const list = roles || [];
  return list.includes('admin') || list.includes('support') || list.includes('super-admin');
}

async function handleSubmit() {
  if (!email.value.trim() || !password.value.trim()) return;

  try {
    await login(email.value.trim(), password.value);

    if (token.value && user.value) {
      const roles = user.value.roles || [];

      if (isStaff(roles)) {
        await router.push({ name: 'soporte' });
      } else {
        await router.push({ name: 'cliente' });
      }
    }
  } catch {
    // authError ya se maneja desde useAuth
  }
}
</script>

<template>
  <div
    class="min-h-screen relative overflow-hidden bg-[#f4f7fb] text-slate-900 flex items-center justify-center px-4 py-8"
  >
    <!-- Fondo premium -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        class="absolute inset-0 bg-gradient-to-br from-[#f8fafc] via-[#eef2f7] to-[#e9eef5]"
      ></div>

      <div
        class="absolute -top-40 left-1/4 w-[520px] h-[520px] rounded-full bg-[#0b1933]/[0.02] blur-3xl"
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
      class="relative z-10 w-full max-w-md rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.12)] p-6 sm:p-8"
    >
      <!-- Header -->
      <div class="flex flex-col items-center text-center mb-8">
        <div class="rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.10)] mb-4">
          <img
            src="https://clinicasagradafamilia.net/logos-firmas/Logo-IT-Sin-Fondo.png"
            alt="IT Management"
            class="w-20 h-20 object-contain"
          />
        </div>

        <h1 class="text-3xl font-extrabold text-[#07152d]">Mesa de Ayuda</h1>
        <p class="text-sm text-slate-500 mt-2">Inicia sesión para continuar</p>
      </div>

      <!-- Formulario -->
      <form class="space-y-5" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <label class="block text-sm font-medium text-slate-700">Correo electrónico</label>
          <input
            v-model="email"
            type="email"
            placeholder="correo@ejemplo.com"
            required
            class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition shadow-sm focus:border-[#d1332f] focus:ring-4 focus:ring-[#d1332f]/15"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-slate-700">Contraseña</label>

          <div class="relative">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              required
              autocomplete="current-password"
              class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-20 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition shadow-sm focus:border-[#d1332f] focus:ring-4 focus:ring-[#d1332f]/15"
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

        <p
          v-if="authError"
          class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          {{ authError }}
        </p>

        <button
          type="submit"
          :disabled="isAuthLoading"
          class="w-full rounded-xl bg-gradient-to-r from-[#c62d28] to-[#df3732] px-4 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(209,51,47,0.22)] transition duration-200 hover:scale-[1.01] hover:from-[#b92a25] hover:to-[#d5332f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ isAuthLoading ? 'Iniciando sesión...' : 'Entrar' }}
        </button>

        <div class="text-center pt-1">
          <RouterLink
            :to="{ name: 'forgot-password' }"
            class="text-xs font-medium text-slate-500 transition hover:text-[#d1332f]"
          >
            ¿Olvidaste tu contraseña?
          </RouterLink>
        </div>
      </form>
    </div>
  </div>
</template>
