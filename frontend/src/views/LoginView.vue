<!-- src/views/LoginView.vue -->
<script setup lang="ts">
import { ref } from "vue";
import { useAuth } from "../composables/useAuth";

const email = ref("");
const password = ref("");
const showPassword = ref(false);

const { login, isAuthLoading, authError, user, token } = useAuth();

const formError = ref<string | null>(null);
const loginSuccess = ref(false);

async function handleSubmit() {
  formError.value = null;
  loginSuccess.value = false;

  if (!email.value.trim() || !password.value.trim()) {
    formError.value = "Debe ingresar correo y contraseña.";
    return;
  }

  try {
    await login(email.value.trim(), password.value);
    loginSuccess.value = true;
    // Aquí NO recargamos, dejamos que App.vue decida qué mostrar
  } catch (err) {
    // authError ya se setea en el composable
  }
}
</script>

<template>
  <div
    class="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center px-4"
  >
    <div
      class="w-full max-w-md bg-slate-950/80 border border-slate-800 rounded-2xl shadow-xl p-6 md:p-8"
    >
      <div class="mb-6 text-center">
        <h1 class="text-2xl font-bold mb-1">Iniciar sesión</h1>
        <p class="text-xs text-slate-400">
          Accede a la mesa de ayuda con tu usuario y contraseña.
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-1">
          <label class="text-xs text-slate-300" for="email">
            Correo electrónico
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="usuario@empresa.com"
            autocomplete="email"
          />
        </div>

        <div class="space-y-1">
          <label class="text-xs text-slate-300" for="password">
            Contraseña
          </label>
          <div class="relative">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="••••••••"
              autocomplete="current-password"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 px-3 text-[11px] text-slate-400 hover:text-slate-200"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? "Ocultar" : "Ver" }}
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between text-xs text-slate-400">
          <label class="inline-flex items-center gap-1">
            <input
              type="checkbox"
              class="rounded border-slate-600 bg-slate-900 text-emerald-500"
              checked
              disabled
            />
            <span>Mantener sesión (JWT)</span>
          </label>
          <button type="button" class="text-emerald-400 hover:text-emerald-300">
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        <button
          type="submit"
          class="w-full mt-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isAuthLoading"
        >
          {{ isAuthLoading ? "Verificando..." : "Entrar" }}
        </button>
      </form>

      <p v-if="formError" class="mt-3 text-xs text-rose-400">
        {{ formError }}
      </p>
      <p v-if="authError && !formError" class="mt-3 text-xs text-rose-400">
        {{ authError }}
      </p>

      <div
        v-if="loginSuccess && user"
        class="mt-4 text-[11px] text-emerald-300 bg-emerald-900/20 border border-emerald-700 rounded-md px-3 py-2"
      >
        Sesión iniciada como:
        <span class="font-semibold">{{ user.name }}</span>
        <span v-if="user.email">({{ user.email }})</span>.
        <br />
        Ya puedes usar este JWT para consumir la API desde el panel de ayuda.
      </div>

      <div
        v-if="token"
        class="mt-4 text-[10px] text-slate-400 bg-slate-900/70 border border-slate-700 rounded-md px-3 py-2 break-all"
      >
        <span class="font-semibold">Token JWT:</span>
        <br />
        {{ token }}
      </div>
    </div>
  </div>
</template>
