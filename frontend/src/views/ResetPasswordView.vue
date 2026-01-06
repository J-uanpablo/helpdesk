<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const token = computed(() => String(route.query.token || ""));
const email = computed(() => String(route.query.email || ""));

const newPassword = ref("");
const confirmPassword = ref("");
const showPassword = ref(false);

const loading = ref(false);
const message = ref<string | null>(null);
const error = ref<string | null>(null);

const API_URL = "http://localhost:3000";

function validate() {
  if (!email.value || !token.value)
    return "El enlace no es válido (faltan datos).";
  if (newPassword.value.length < 8)
    return "La contraseña debe tener mínimo 8 caracteres.";
  if (newPassword.value !== confirmPassword.value)
    return "Las contraseñas no coinciden.";
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.value,
        token: token.value,
        newPassword: newPassword.value,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.message || "No se pudo actualizar la contraseña.");
    }

    message.value =
      data?.message || "Contraseña actualizada. Ya puedes iniciar sesión.";
    setTimeout(() => router.push({ name: "login" }), 900);
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
      <h1 class="text-2xl font-bold mb-1 text-center">Nueva contraseña</h1>
      <p class="text-xs text-slate-400 mb-4 text-center">
        Cambia tu contraseña para
        <span class="text-slate-200">{{ email }}</span>
      </p>

      <div
        v-if="!token || !email"
        class="text-[11px] text-rose-400 text-center"
      >
        El enlace no es válido. Solicita un nuevo restablecimiento.
      </div>

      <form v-else class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-1">
          <label class="block text-xs text-slate-300">Nueva contraseña</label>
          <div class="relative">
            <input
              v-model="newPassword"
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

        <div class="space-y-1">
          <label class="block text-xs text-slate-300"
            >Confirmar contraseña</label
          >
          <input
            v-model="confirmPassword"
            :type="showPassword ? 'text' : 'password'"
            class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="••••••••"
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
          {{ loading ? "Actualizando..." : "Actualizar contraseña" }}
        </button>

        <div class="text-center mt-2">
          <RouterLink
            :to="{ name: 'forgot-password' }"
            class="text-[11px] text-slate-400 hover:text-slate-200"
          >
            Solicitar otro enlace
          </RouterLink>
        </div>
      </form>
    </div>
  </div>
</template>
