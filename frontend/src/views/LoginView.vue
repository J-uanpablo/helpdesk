<!-- src/views/LoginView.vue -->
<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../composables/useAuth";

const router = useRouter();
const { login, isAuthLoading, authError, token, user, initAuth } = useAuth();

const email = ref("");
const password = ref("");
const showPassword = ref(false); // 👈 toggle ver/ocultar

initAuth(); // por si ya había sesión guardada

function isStaff(roles: string[] | undefined | null): boolean {
  const list = roles || [];
  return (
    list.includes("admin") ||
    list.includes("support") ||
    list.includes("super-admin")
  );
}

async function handleSubmit() {
  if (!email.value.trim() || !password.value.trim()) {
    return;
  }

  try {
    await login(email.value.trim(), password.value);

    // después de login, decidimos a dónde mandar según rol
    if (token.value && user.value) {
      const roles = user.value.roles || [];

      if (isStaff(roles)) {
        await router.push({ name: "soporte" });
      } else {
        await router.push({ name: "cliente" });
      }
    }
  } catch {
    // el error ya se guarda en authError
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
      <h1 class="text-2xl font-bold mb-1 text-center">Mesa de ayuda</h1>
      <p class="text-xs text-slate-400 mb-4 text-center">
        Inicia sesión para gestionar tus tickets.
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

        <div class="space-y-1">
          <label class="block text-xs text-slate-300">Contraseña</label>
          <div class="relative">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              class="absolute inset-y-0 right-2 text-[11px] text-slate-400 hover:text-slate-200"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? "Ocultar" : "Ver" }}
            </button>
          </div>
        </div>

        <p v-if="authError" class="text-[11px] text-rose-400">
          {{ authError }}
        </p>

        <button
          type="submit"
          class="w-full mt-2 px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isAuthLoading"
        >
          {{ isAuthLoading ? "Iniciando sesión..." : "Entrar" }}
        </button>
      </form>
    </div>
  </div>
</template>
