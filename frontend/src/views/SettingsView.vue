<template>
  <main class="min-h-screen" :style="{ background: 'var(--bg-main)', color: 'var(--text-main)' }">
    <header
      class="px-6 py-4 border-b flex items-center justify-between"
      :style="{
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-main)',
      }"
    >
      <div>
        <h1 class="text-xl font-semibold">Configuración</h1>
        <p class="text-xs" :style="{ color: 'var(--text-soft)' }">
          Ajustes de cuenta y preferencias.
        </p>
      </div>

      <button
        class="text-xs px-3 py-1 border rounded transition"
        :style="{
          background: 'var(--bg-soft)',
          borderColor: 'var(--border-main)',
          color: 'var(--text-main)',
        }"
        @click="goBack"
      >
        ← Volver
      </button>
    </header>

    <section class="px-6 py-6 grid grid-cols-12 gap-6">
      <!-- Menú -->
      <aside class="col-span-12 md:col-span-3">
        <div
          class="rounded-xl border p-2"
          :style="{
            background: 'var(--bg-panel)',
            borderColor: 'var(--border-main)',
          }"
        >
          <button
            v-for="item in visibleMenu"
            :key="item.key"
            class="w-full text-left px-3 py-2 rounded-md text-sm transition"
            :style="
              tab === item.key
                ? {
                    background: 'var(--bg-soft)',
                    color: 'var(--text-main)',
                  }
                : {
                    background: 'transparent',
                    color: 'var(--text-soft)',
                  }
            "
            @click="tab = item.key"
          >
            {{ item.label }}
          </button>
        </div>
      </aside>

      <!-- Contenido -->
      <div class="col-span-12 md:col-span-9">
        <!-- Apariencia -->
        <div
          v-if="tab === 'appearance'"
          class="rounded-xl border p-5"
          :style="{
            background: 'var(--bg-panel)',
            borderColor: 'var(--border-main)',
          }"
        >
          <h2 class="text-lg font-semibold mb-3">Apariencia</h2>

          <div
            class="flex items-center justify-between rounded-lg p-4 border"
            :style="{
              background: 'var(--bg-soft)',
              borderColor: 'var(--border-main)',
            }"
          >
            <div>
              <p class="text-sm font-semibold">Tema</p>
              <p class="text-xs" :style="{ color: 'var(--text-soft)' }">Elige claro u oscuro.</p>
            </div>

            <div class="flex gap-2">
              <button
                class="px-3 py-2 rounded-md text-xs border text-white transition"
                :style="
                  theme === 'light'
                    ? {
                        background: '#10b981',
                        borderColor: '#10b981',
                      }
                    : {
                        background: 'var(--bg-panel)',
                        borderColor: 'var(--border-main)',
                        color: 'var(--text-main)',
                      }
                "
                @click="setTheme('light')"
              >
                Claro
              </button>
              <button
                class="px-3 py-2 rounded-md text-xs border text-white transition"
                :style="
                  theme === 'dark'
                    ? {
                        background: '#10b981',
                        borderColor: '#10b981',
                      }
                    : {
                        background: 'var(--bg-panel)',
                        borderColor: 'var(--border-main)',
                        color: 'var(--text-main)',
                      }
                "
                @click="setTheme('dark')"
              >
                Oscuro
              </button>
            </div>
          </div>
        </div>

        <!-- Seguridad -->
        <div
          v-else-if="tab === 'security'"
          class="rounded-xl border p-5"
          :style="{
            background: 'var(--bg-panel)',
            borderColor: 'var(--border-main)',
          }"
        >
          <h2 class="text-lg font-semibold mb-3">Seguridad</h2>

          <div
            class="rounded-lg p-4 border"
            :style="{
              background: 'var(--bg-soft)',
              borderColor: 'var(--border-main)',
            }"
          >
            <p class="text-sm font-semibold mb-1">Cambiar contraseña</p>
            <p class="text-xs mb-4" :style="{ color: 'var(--text-soft)' }">
              Recomendado: mínimo 10 caracteres.
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                v-model="pw.current"
                type="password"
                placeholder="Contraseña actual"
                class="px-3 py-2 rounded border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :style="{
                  background: 'var(--input-bg)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
              />
              <input
                v-model="pw.next"
                type="password"
                placeholder="Nueva contraseña"
                class="px-3 py-2 rounded border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :style="{
                  background: 'var(--input-bg)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
              />
              <input
                v-model="pw.confirm"
                type="password"
                placeholder="Confirmar nueva contraseña"
                class="px-3 py-2 rounded border text-sm md:col-span-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :style="{
                  background: 'var(--input-bg)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-main)',
                }"
              />
            </div>

            <p v-if="pwError" class="text-xs mt-3" style="color: #f43f5e">
              {{ pwError }}
            </p>
            <p v-if="pwOk" class="text-xs mt-3" style="color: #10b981">
              {{ pwOk }}
            </p>

            <div class="mt-4 flex justify-end">
              <button
                class="px-4 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
                style="background: #10b981"
                @click="changePassword"
                :disabled="pwLoading"
              >
                {{ pwLoading ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Plantillas -->
        <div
          v-else-if="tab === 'templates'"
          class="rounded-xl border p-5"
          :style="{
            background: 'var(--bg-panel)',
            borderColor: 'var(--border-main)',
          }"
        >
          <h2 class="text-lg font-semibold mb-1">Plantillas</h2>
          <p class="text-xs mb-4" :style="{ color: 'var(--text-soft)' }">
            Respuestas rápidas para soporte. Se filtran por área.
          </p>

          <QuickRepliesManager />
        </div>

        <!-- Cuenta -->
        <div
          v-else
          class="rounded-xl border p-5"
          :style="{
            background: 'var(--bg-panel)',
            borderColor: 'var(--border-main)',
          }"
        >
          <h2 class="text-lg font-semibold mb-3">Cuenta</h2>
          <div class="text-sm">
            <p>
              <span :style="{ color: 'var(--text-soft)' }">Usuario:</span>
              {{ user?.name }}
            </p>
            <p>
              <span :style="{ color: 'var(--text-soft)' }">Email:</span>
              {{ user?.email }}
            </p>
            <p>
              <span :style="{ color: 'var(--text-soft)' }">Rol:</span>
              {{ roleLabel }}
            </p>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';

// crea este componente luego (es básicamente tu QuickReplies.vue pero CRUD completo)
import QuickRepliesManager from '../components/chat/QuickRepliesManager.vue';

const router = useRouter();
const { user } = useAuth();

// tabs
type TabKey = 'account' | 'appearance' | 'security' | 'templates';
const tab = ref<TabKey>('account');

// roles
const roles = computed(() => (user.value as any)?.roles ?? []);
const isSupport = computed(
  () =>
    roles.value.includes('ADMIN') ||
    roles.value.includes('SUPER_ADMIN') ||
    roles.value.includes('AGENT')
);

// menu visible por rol
const visibleMenu = computed(() => {
  const base = [
    { key: 'account', label: 'Cuenta' },
    { key: 'appearance', label: 'Apariencia' },
    { key: 'security', label: 'Seguridad' },
  ] as { key: TabKey; label: string }[];

  if (isSupport.value) base.push({ key: 'templates', label: 'Plantillas' });
  return base;
});

const roleLabel = computed(() => {
  if (roles.value.includes('SUPER_ADMIN')) return 'SUPER ADMIN';
  if (roles.value.includes('ADMIN')) return 'ADMIN';
  if (roles.value.includes('AGENT')) return 'AGENTE';
  return 'CLIENTE';
});

// Theme
const theme = ref<'dark' | 'light'>('dark');

function applyTheme(t: 'dark' | 'light') {
  // básico: data-theme en html (luego ajustas Tailwind si quieres)
  document.documentElement.setAttribute('data-theme', t);
}

function setTheme(t: 'dark' | 'light') {
  theme.value = t;
  localStorage.setItem('theme', t);
  applyTheme(t);
}

onMounted(() => {
  const saved = (localStorage.getItem('theme') as any) || 'dark';
  theme.value = saved === 'light' ? 'light' : 'dark';
  applyTheme(theme.value);
});

// Password change (placeholder - lo conectamos a tu backend)
const pw = ref({ current: '', next: '', confirm: '' });
const pwLoading = ref(false);
const pwError = ref('');
const pwOk = ref('');

async function changePassword() {
  pwError.value = '';
  pwOk.value = '';

  if (!pw.value.current || !pw.value.next) {
    pwError.value = 'Completa todos los campos.';
    return;
  }
  if (pw.value.next !== pw.value.confirm) {
    pwError.value = 'La confirmación no coincide.';
    return;
  }

  pwLoading.value = true;
  try {
    // TODO: llamar tu endpoint real: POST /auth/change-password
    // por ahora placeholder:
    await new Promise(r => setTimeout(r, 400));
    pwOk.value = 'Contraseña actualizada.';
    pw.value = { current: '', next: '', confirm: '' };
  } catch (e: any) {
    pwError.value = e?.message || 'No se pudo cambiar la contraseña.';
  } finally {
    pwLoading.value = false;
  }
}

function goBack() {
  router.back();
}
</script>
