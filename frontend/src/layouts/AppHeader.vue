<template>
  <header
    class="relative shrink-0 border-b flex items-center justify-between px-6 h-16 shadow-sm z-30"
    :style="{
      background: 'var(--bg-panel)',
      borderColor: 'var(--border-main)',
      color: 'var(--text-main)',
    }"
  >
    <div class="flex items-center gap-4 h-full">
      <div class="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center">
        <img :src="brandLogo" alt="IT Management" class="h-10 w-10 object-contain" />
      </div>

      <div class="min-w-0 flex-1">
        <h1 class="truncate text-lg font-bold md:text-xl flex items-center gap-2">
          {{ titleToShow }}
          <span
            v-if="subtitleToShow"
            class="text-[10px] font-normal tracking-wider uppercase px-2 py-0.5 rounded-full border"
            :style="{ borderColor: 'var(--border-main)', color: 'var(--text-soft)' }"
          >
            {{ subtitleToShow }}
          </span>
        </h1>
      </div>
    </div>

    <nav class="hidden lg:flex items-center h-full gap-6 absolute left-1/2 -translate-x-1/2">
      <a
        v-if="showBackToClientTickets"
        @click="goClientTickets"
        class="cursor-pointer h-full flex items-center border-b-2 border-transparent px-1 text-sm font-medium transition-colors hover:text-blue-600 hover:border-gray-300"
        title="Volver (ESC)"
      >
        ← Mis tickets
      </a>

      <template v-if="isStaff">
        <a @click="goSupport" :class="navLinkClass('/soporte')"> Mesa de ayuda </a>

        <a @click="goClientTickets" :class="navLinkClass('/cliente')"> Mis tickets </a>

        <a @click="goClientNewTicket" :class="navLinkClass('/cliente/nuevo-ticket')">
          Nuevo ticket
        </a>

        <a v-if="isAdmin" @click="open('reports')" :class="simpleNavLinkClass"> Informes </a>

        <a v-if="isSuperAdmin" @click="goAdminClients" :class="navLinkClass('/admin/clientes')">
          Admin. clientes
        </a>

        <a v-if="isSuperAdmin" @click="goAdminAgents" :class="navLinkClass('/admin/agentes')">
          Admin. agentes
        </a>

        <a v-if="isSuperAdmin" @click="goAdminAreas" :class="navLinkClass('/admin/areas')">
          Admin. áreas
        </a>
      </template>

      <template v-else>
        <a @click="goClientTickets" :class="navLinkClass('/cliente')"> Mis tickets </a>
        <a @click="goClientNewTicket" :class="navLinkClass('/cliente/nuevo-ticket')">
          Nuevo ticket
        </a>
      </template>
    </nav>

    <div class="flex items-center gap-3 shrink-0 h-full relative">
      <div v-if="isDropdownOpen" @click="isDropdownOpen = false" class="fixed inset-0 z-40"></div>

      <button
        @click="isDropdownOpen = !isDropdownOpen"
        class="flex items-center gap-3 h-10 px-2 rounded-md hover:bg-black/5 transition-colors z-50 relative border border-transparent hover:border-black/10"
      >
        <div
          class="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm"
          style="background: linear-gradient(135deg, #e0f2fe, #bae6fd); color: #0369a1"
        >
          {{ userInitials }}
        </div>

        <div class="hidden sm:block text-left leading-tight">
          <p class="text-xs font-bold uppercase" :style="{ color: 'var(--text-main)' }">
            {{ user?.name || 'Usuario' }}
          </p>
          <p
            class="text-[10px] font-semibold uppercase mt-0.5"
            :style="{ color: 'var(--text-muted)' }"
          >
            {{ mainRoleLabel }}
          </p>
        </div>

        <svg class="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          ></path>
        </svg>
      </button>

      <div
        v-if="isDropdownOpen"
        class="absolute right-0 top-14 mt-2 w-48 rounded-xl shadow-lg border py-1.5 z-50 transition-all"
        :style="{
          background: 'var(--bg-panel)',
          borderColor: 'var(--border-main)',
          color: 'var(--text-main)',
        }"
      >
        <div
          class="px-4 py-2 border-b sm:hidden mb-1"
          :style="{ borderColor: 'var(--border-main)' }"
        >
          <p class="text-xs font-bold truncate">{{ user?.name || 'Usuario' }}</p>
          <p class="text-[10px] uppercase truncate" :style="{ color: 'var(--text-muted)' }">
            {{ mainRoleLabel }}
          </p>
        </div>

        <button
          @click="
            openSettings = true;
            isDropdownOpen = false;
          "
          class="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-black/5 transition-colors"
        >
          <span>⚙️</span> Configuración
        </button>
        <button
          @click="
            confirmLogout();
            isDropdownOpen = false;
          "
          class="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-red-600 hover:bg-red-50 transition-colors"
        >
          <span>🚪</span> Cerrar sesión
        </button>
      </div>
    </div>

    <Teleport to="body">
      <SettingsModal
        v-if="openSettings"
        :authToken="(token ?? '').trim()"
        @close="openSettings = false"
      />
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showLogoutModal"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity"
        @click.self="cancelLogout"
      >
        <div
          class="w-full max-w-sm rounded-xl border p-6 shadow-2xl"
          :style="{
            background: 'var(--bg-panel)',
            borderColor: 'var(--border-main)',
            color: 'var(--text-main)',
          }"
        >
          <div class="flex items-center gap-3 mb-3">
            <div
              class="h-10 w-10 rounded-lg border flex items-center justify-center"
              :style="{ background: 'var(--bg-soft)', borderColor: 'var(--border-main)' }"
            >
              <img :src="brandLogo" alt="IT Management" class="h-6 w-6 object-contain opacity-90" />
            </div>
            <h2 class="text-lg font-semibold">¿Cerrar sesión?</h2>
          </div>

          <p class="mb-6 text-sm" :style="{ color: 'var(--text-soft)' }">
            ¿Estás seguro de que deseas salir de tu cuenta?
          </p>

          <div class="flex justify-end gap-3">
            <button
              type="button"
              @click="cancelLogout"
              class="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5"
              :style="{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }"
            >
              Cancelar
            </button>

            <button
              type="button"
              @click="doLogout"
              class="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors bg-red-600 hover:bg-red-700 shadow-sm"
            >
              Sí, cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </header>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { useUiBus } from '../composables/useUiBus';
import SettingsModal from '../components/settings/SettingsModal.vue';

const props = defineProps<{
  title?: string;
  subtitle?: string;
}>();

const route = useRoute();
const router = useRouter();
const { user, token, logout } = useAuth();
const { open } = useUiBus();

const roles = computed(() => user.value?.roles || []);
const isSuperAdmin = computed(() => roles.value.includes('super-admin'));
const isAdmin = computed(() => {
  const r = roles.value;
  return r.includes('admin') || r.includes('super-admin');
});
const isStaff = computed(() => {
  const r = roles.value;
  return r.includes('admin') || r.includes('support') || r.includes('super-admin');
});

// Extraer etiqueta del rol principal para mostrar debajo del nombre
const mainRoleLabel = computed(() => {
  if (isSuperAdmin.value) return 'Super Admin';
  if (isAdmin.value) return 'Administrador';
  if (isStaff.value) return 'Soporte';
  return 'Cliente';
});

// Extraer iniciales del usuario para el avatar
const userInitials = computed(() => {
  const name = user.value?.name || 'U';
  return name.substring(0, 2).toUpperCase();
});

const titleToShow = computed(() => {
  return (
    props.title ||
    (route.meta?.title as string) ||
    (isStaff.value ? 'Mesa de ayuda' : 'Mis tickets')
  );
});

const subtitleToShow = computed(() => {
  return props.subtitle || (route.meta?.subtitle as string) || '';
});

const showBackToClientTickets = computed(() => {
  return typeof route.path === 'string' && route.path.startsWith('/cliente/ticket/');
});
const simpleNavLinkClass = computed(() => {
  return isDarkTheme.value
    ? 'cursor-pointer h-full flex items-center border-b-2 border-transparent px-2 text-sm font-medium transition-all duration-200 text-gray-400 hover:text-white hover:border-gray-600'
    : 'cursor-pointer h-full flex items-center border-b-2 border-transparent px-2 text-sm font-medium transition-all duration-200 text-slate-500 hover:text-slate-900 hover:border-slate-400';
});

// Lógica para marcar las pestañas activas
const isRouteActive = (path: string) => {
  if (typeof route.path !== 'string') return false;

  if (path === '/cliente') {
    return route.path === '/cliente' || route.path.startsWith('/cliente/ticket/');
  }

  return route.path === path || route.path.startsWith(path + '/');
};

const navLinkClass = (path: string) => {
  const active = isRouteActive(path);

  if (active) {
    return [
      'cursor-pointer h-full flex items-center border-b-2 px-2 text-sm font-medium transition-all duration-200',
      isDarkTheme.value ? 'border-[#5eead4] text-[#5eead4]' : 'border-[#0f766e] text-[#0f766e]',
    ];
  }

  return [
    'cursor-pointer h-full flex items-center border-b-2 px-2 text-sm font-medium transition-all duration-200',
    isDarkTheme.value
      ? 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
      : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-400',
  ];
};

const isDarkTheme = ref(false);
let themeObserver: MutationObserver | null = null;

function updateThemeState() {
  const root = document.documentElement;
  const body = document.body;
  isDarkTheme.value =
    root.classList.contains('theme-dark') || body.classList.contains('theme-dark');
}

onMounted(() => {
  updateThemeState();
  themeObserver = new MutationObserver(() => {
    updateThemeState();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
});

onBeforeUnmount(() => {
  if (themeObserver) {
    themeObserver.disconnect();
    themeObserver = null;
  }
});

const brandLogo = computed(() => {
  return isDarkTheme.value
    ? 'https://clinicasagradafamilia.net/logos-firmas/Logo_IT-Plateado-Sin-Fondo.png'
    : 'https://clinicasagradafamilia.net/logos-firmas/Logo-IT-Sin-Fondo.png';
});

function goClientTickets() {
  router.push('/cliente');
}
function goClientNewTicket() {
  router.push('/cliente/nuevo-ticket');
}
function goSupport() {
  router.push('/soporte');
}
function goAdminAgents() {
  router.push('/admin/agentes');
}
function goAdminAreas() {
  router.push('/admin/areas');
}
function goAdminClients() {
  router.push('/admin/clientes');
}

const isDropdownOpen = ref(false);
const openSettings = ref(false);
const showLogoutModal = ref(false);

function confirmLogout() {
  showLogoutModal.value = true;
}
function cancelLogout() {
  showLogoutModal.value = false;
}
async function doLogout() {
  try {
    showLogoutModal.value = false;
    openSettings.value = false;
    await Promise.resolve(logout());
    await router.replace({ name: 'login' });
  } catch (e) {
    console.error('Error cerrando sesión:', e);
    router.replace('/login');
  }
}
</script>
