<template>
  <div
    class="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4"
    @click.self="emitClose"
  >
    <div
      class="w-full max-w-2xl rounded-xl border shadow-2xl"
      :style="{
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-main)',
        color: 'var(--text-main)',
      }"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between border-b px-5 py-4"
        :style="{ borderColor: 'var(--border-main)' }"
      >
        <h2 class="text-base font-semibold">Configuración</h2>

        <button
          type="button"
          class="rounded px-2 py-1 transition-opacity hover:opacity-70"
          @click="emitClose"
          aria-label="Cerrar"
          title="Cerrar"
        >
          ✕
        </button>
      </div>

      <!-- Body -->
      <div class="p-5">
        <!-- Tabs -->
        <div class="mb-4 flex gap-2">
          <button
            type="button"
            class="rounded-md border px-3 py-2 text-xs font-semibold"
            :style="tabStyle('templates')"
            @click="tab = 'templates'"
          >
            ⚡ Plantillas rápidas
          </button>

          <button
            type="button"
            class="rounded-md border px-3 py-2 text-xs font-semibold"
            :style="tabStyle('theme')"
            @click="tab = 'theme'"
          >
            🌓 Tema
          </button>

          <button
            type="button"
            class="rounded-md border px-3 py-2 text-xs font-semibold"
            :style="tabStyle('password')"
            @click="tab = 'password'"
          >
            🔒 Contraseña
          </button>
        </div>

        <!-- Content -->
        <div v-if="tab === 'templates'">
          <QuickRepliesSettings :authToken="props.authToken" />
        </div>

        <div v-else-if="tab === 'theme'">
          <p class="mb-2 text-sm font-semibold">Tema de la interfaz</p>
          <p class="mb-4 text-xs" :style="{ color: 'var(--text-soft)' }">
            Elige cómo quieres ver la mesa de ayuda.
          </p>

          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              type="button"
              class="rounded-xl border p-4 text-left transition hover:scale-[1.01]"
              :style="themeCardStyle('light')"
              @click="applyTheme('light')"
            >
              <div class="mb-1 text-sm font-bold">☀️ Claro</div>
              <div class="text-xs" :style="{ color: 'var(--text-soft)' }">
                Mejor para ambientes bien iluminados.
              </div>
            </button>

            <button
              type="button"
              class="rounded-xl border p-4 text-left transition hover:scale-[1.01]"
              :style="themeCardStyle('dark')"
              @click="applyTheme('dark')"
            >
              <div class="mb-1 text-sm font-bold">🌙 Oscuro</div>
              <div class="text-xs" :style="{ color: 'var(--text-soft)' }">
                Ideal para trabajar con menos brillo.
              </div>
            </button>
          </div>

          <div class="mt-4 text-xs" :style="{ color: 'var(--text-muted)' }">
            Tema actual:
            <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
              {{ theme === 'dark' ? 'Oscuro' : 'Claro' }}
            </span>
          </div>
        </div>

        <div v-else-if="tab === 'password'" class="text-sm">
          <p class="mb-2 text-sm font-semibold">Cambiar contraseña</p>
          <p class="mb-4 text-xs" :style="{ color: 'var(--text-soft)' }">
            Actualiza tu contraseña de acceso a la mesa de ayuda.
          </p>

          <div class="space-y-4">
            <div>
              <label class="mb-1 block text-xs font-medium">Contraseña actual</label>
              <div class="relative">
                <input
                  v-model="passwordForm.currentPassword"
                  :type="showCurrentPassword ? 'text' : 'password'"
                  class="w-full rounded-lg border px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  :style="inputStyle"
                  placeholder="Ingresa tu contraseña actual"
                  autocomplete="current-password"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-2 text-[11px] font-medium"
                  :style="{ color: 'var(--text-soft)' }"
                  @click="showCurrentPassword = !showCurrentPassword"
                >
                  {{ showCurrentPassword ? 'Ocultar' : 'Ver' }}
                </button>
              </div>
            </div>

            <div>
              <label class="mb-1 block text-xs font-medium">Nueva contraseña</label>
              <div class="relative">
                <input
                  v-model="passwordForm.newPassword"
                  :type="showNewPassword ? 'text' : 'password'"
                  class="w-full rounded-lg border px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  :style="inputStyle"
                  placeholder="Ingresa tu nueva contraseña"
                  autocomplete="new-password"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-2 text-[11px] font-medium"
                  :style="{ color: 'var(--text-soft)' }"
                  @click="showNewPassword = !showNewPassword"
                >
                  {{ showNewPassword ? 'Ocultar' : 'Ver' }}
                </button>
              </div>
            </div>

            <div>
              <label class="mb-1 block text-xs font-medium">Confirmar nueva contraseña</label>
              <div class="relative">
                <input
                  v-model="passwordForm.confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  class="w-full rounded-lg border px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  :style="inputStyle"
                  placeholder="Confirma tu nueva contraseña"
                  autocomplete="new-password"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-2 text-[11px] font-medium"
                  :style="{ color: 'var(--text-soft)' }"
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  {{ showConfirmPassword ? 'Ocultar' : 'Ver' }}
                </button>
              </div>
            </div>

            <div
              class="rounded-lg border px-3 py-2 text-[11px]"
              :style="{
                background: 'var(--bg-soft)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-soft)',
              }"
            >
              Recomendación: usa mínimo 8 caracteres, combinando mayúsculas, minúsculas, números y
              símbolos.
            </div>

            <p v-if="passwordError" class="text-xs font-medium text-rose-500">
              {{ passwordError }}
            </p>

            <p v-if="passwordSuccess" class="text-xs font-medium text-emerald-500">
              {{ passwordSuccess }}
            </p>

            <div class="flex justify-end">
              <button
                type="button"
                class="rounded-lg px-4 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                style="background: #10b981"
                :disabled="isChangingPassword"
                @click="changePassword"
              >
                {{ isChangingPassword ? 'Guardando...' : 'Actualizar contraseña' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="flex justify-end border-t px-5 py-4"
        :style="{ borderColor: 'var(--border-main)' }"
      >
        <button
          type="button"
          class="rounded-md border px-4 py-2 text-xs font-semibold"
          :style="{
            background: 'var(--bg-soft)',
            borderColor: 'var(--border-main)',
            color: 'var(--text-main)',
          }"
          @click="emitClose"
        >
          Cerrar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import QuickRepliesSettings from './QuickRepliesSettings.vue';
import { useTheme } from '../../composables/useTheme';
import { apiFetch } from '../../lib/api';

const props = defineProps<{ authToken: string }>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const tab = ref<'templates' | 'theme' | 'password'>('templates');
const { theme, applyTheme } = useTheme();

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);

const isChangingPassword = ref(false);
const passwordError = ref('');
const passwordSuccess = ref('');

const inputStyle = computed(() => ({
  background: 'var(--input-bg)',
  borderColor: 'var(--border-main)',
  color: 'var(--text-main)',
}));

function emitClose() {
  emit('close');
}

function tabStyle(current: 'templates' | 'theme' | 'password') {
  const active = tab.value === current;

  return {
    background: active ? '#10b981' : 'var(--bg-soft)',
    borderColor: active ? '#10b981' : 'var(--border-main)',
    color: active ? '#052e16' : 'var(--text-main)',
  };
}

function themeCardStyle(mode: 'dark' | 'light') {
  const active = theme.value === mode;

  return {
    background: active ? 'rgba(16,185,129,0.12)' : 'var(--bg-soft)',
    borderColor: active ? '#10b981' : 'var(--border-main)',
    color: 'var(--text-main)',
  };
}

function resetPasswordMessages() {
  passwordError.value = '';
  passwordSuccess.value = '';
}

function resetPasswordForm() {
  passwordForm.currentPassword = '';
  passwordForm.newPassword = '';
  passwordForm.confirmPassword = '';
  showCurrentPassword.value = false;
  showNewPassword.value = false;
  showConfirmPassword.value = false;
}

async function changePassword() {
  resetPasswordMessages();

  const currentPassword = passwordForm.currentPassword.trim();
  const newPassword = passwordForm.newPassword.trim();
  const confirmPassword = passwordForm.confirmPassword.trim();

  if (!currentPassword || !newPassword || !confirmPassword) {
    passwordError.value = 'Debes completar todos los campos.';
    return;
  }

  if (newPassword.length < 8) {
    passwordError.value = 'La nueva contraseña debe tener al menos 8 caracteres.';
    return;
  }

  if (newPassword !== confirmPassword) {
    passwordError.value = 'La confirmación de la contraseña no coincide.';
    return;
  }

  if (currentPassword === newPassword) {
    passwordError.value = 'La nueva contraseña debe ser diferente a la actual.';
    return;
  }

  isChangingPassword.value = true;

  try {
    const res = await apiFetch('http://localhost:3000/auth/change-password', {
      method: 'PATCH',
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || 'No se pudo actualizar la contraseña.');
    }

    passwordSuccess.value = 'Contraseña actualizada correctamente.';
    resetPasswordForm();
  } catch (err: any) {
    passwordError.value = err?.message || 'Ocurrió un error al actualizar la contraseña.';
  } finally {
    isChangingPassword.value = false;
  }
}
</script>
