<!-- src/layouts/HelpdeskLayout.vue -->
<template>
  <div class="h-full flex bg-[#050b1a] text-white">
    <!-- router-view ocupa el resto -->
    <div class="flex-1 min-h-0 flex overflow-hidden">
      <router-view v-slot="{ Component }">
        <component :is="Component" class="flex-1 min-h-0 flex overflow-hidden" />
      </router-view>
    </div>

    <SupportReportModal
      :open="activeModal === 'reports'"
      v-model:from="reportFrom"
      v-model:to="reportTo"
      v-model:area="reportArea"
      :areas="reportAreas"
      :isSuperAdmin="isSuperAdmin"
      @close="close()"
      @download="downloadSupportReport"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import SupportReportModal from '../components/reports/SupportReportModal.vue';
import { useAuth } from '../composables/useAuth';
import { useUiBus } from '../composables/useUiBus';

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const { user, token } = useAuth();
const { activeModal, close } = useUiBus();

const roles = computed(() => user.value?.roles || []);
const isSuperAdmin = computed(() => roles.value.includes('super-admin'));
const isAdmin = computed(() => {
  const r = roles.value;
  return r.includes('admin') || r.includes('super-admin');
});

const reportFrom = ref('');
const reportTo = ref('');
const reportArea = ref<string>('ALL');
const reportAreas = ref<string[]>([]);

function getJwt(): string {
  return (token.value ?? '').trim();
}

async function loadReportAreas() {
  if (!isAdmin.value) {
    reportAreas.value = [];
    return;
  }
  const jwt = getJwt();
  if (!jwt) {
    reportAreas.value = [];
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/support-areas`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) {
      reportAreas.value = [];
      return;
    }
    const data = await res.json();
    reportAreas.value = (Array.isArray(data) ? data : [])
      .map((a: any) => String(a?.name ?? '').trim())
      .filter(Boolean)
      .sort((a: string, b: string) => a.localeCompare(b, 'es-CO', { sensitivity: 'base' }));
  } catch {
    reportAreas.value = [];
  }
}

async function downloadSupportReport() {
  const jwt = getJwt();
  if (!jwt) return;
  if (!reportFrom.value || !reportTo.value) {
    alert('Selecciona desde y hasta');
    return;
  }

  const params = new URLSearchParams({ from: reportFrom.value, to: reportTo.value });

  if (isSuperAdmin.value && reportArea.value !== 'ALL') {
    params.set('area', reportArea.value);
  }

  const url = `${API_BASE}/reports/support-performance.xlsx?${params.toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    alert(`Error ${res.status} descargando reporte.\n${txt}`);
    return;
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  const areaPart =
    isSuperAdmin.value && reportArea.value !== 'ALL'
      ? `_${reportArea.value.replace(/\s+/g, '_')}`
      : '_todas';

  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `reporte_soporte${areaPart}_${reportFrom.value}_a_${reportTo.value}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(objectUrl);
  close();
}

watch(
  () => getJwt(),
  jwt => {
    if (!jwt) {
      reportAreas.value = [];
      return;
    }
    loadReportAreas();
  },
  { immediate: true }
);

onMounted(() => {
  if (getJwt()) loadReportAreas();
});
</script>
