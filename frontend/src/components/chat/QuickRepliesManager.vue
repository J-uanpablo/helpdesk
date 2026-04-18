<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <input
        v-model="q"
        type="text"
        class="w-full px-3 py-2 rounded border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
        :style="{
          background: 'var(--input-bg)',
          borderColor: 'var(--border-main)',
          color: 'var(--text-main)',
        }"
        placeholder="Buscar por título o contenido..."
      />
      <button
        type="button"
        class="px-3 py-2 rounded text-xs font-semibold text-white transition"
        style="background: #10b981"
        @click="openCreate"
      >
        ＋ Nueva
      </button>
    </div>

    <div v-if="error" class="text-xs" style="color: #f43f5e">{{ error }}</div>

    <div v-if="loading" class="text-xs" :style="{ color: 'var(--text-soft)' }">Cargando...</div>

    <div
      v-else
      class="rounded-lg border overflow-hidden"
      :style="{
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-main)',
      }"
    >
      <div v-if="filtered.length === 0" class="p-3 text-xs" :style="{ color: 'var(--text-soft)' }">
        No hay plantillas.
      </div>

      <div
        v-for="t in filtered"
        :key="t.id"
        class="p-3 last:border-b-0"
        :style="{ borderBottom: '1px solid var(--border-main)' }"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-sm font-semibold truncate" :style="{ color: 'var(--text-main)' }">
              {{ t.title }}
            </div>

            <div class="text-xs whitespace-pre-line mt-1" :style="{ color: 'var(--text-soft)' }">
              {{ t.content }}
            </div>

            <div class="text-[11px] mt-2" :style="{ color: 'var(--text-muted)' }">
              Estado:
              <span class="font-semibold" :style="{ color: t.isActive ? '#10b981' : '#f43f5e' }">
                {{ t.isActive ? 'Activa' : 'Inactiva' }}
              </span>
            </div>
          </div>

          <div class="flex gap-2 shrink-0">
            <button
              class="px-3 py-1 rounded text-xs border transition"
              :style="{
                background: 'var(--bg-soft)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-main)',
              }"
              @click="openEdit(t)"
            >
              Editar
            </button>

            <button
              class="px-3 py-1 rounded text-xs font-semibold text-white transition"
              style="background: #f43f5e"
              @click="remove(t)"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Crear/Editar -->
    <div
      v-if="modalOpen"
      class="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center"
      @click.self="closeModal"
    >
      <div
        class="w-full max-w-lg rounded-xl border p-5"
        :style="{
          background: 'var(--bg-panel)',
          borderColor: 'var(--border-main)',
        }"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold" :style="{ color: 'var(--text-main)' }">
            {{ editingId ? 'Editar plantilla' : 'Nueva plantilla' }}
          </h3>

          <button
            class="transition"
            type="button"
            :style="{ color: 'var(--text-soft)' }"
            @click="closeModal"
          >
            ✕
          </button>
        </div>

        <div class="mt-3 space-y-3">
          <div>
            <label class="block text-xs mb-1" :style="{ color: 'var(--text-main)' }">Título</label>
            <input
              v-model="form.title"
              type="text"
              class="w-full px-3 py-2 rounded border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              :style="{
                background: 'var(--input-bg)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-main)',
              }"
            />
          </div>

          <div>
            <label class="block text-xs mb-1" :style="{ color: 'var(--text-main)' }">
              Contenido
            </label>
            <textarea
              v-model="form.content"
              rows="5"
              class="w-full px-3 py-2 rounded border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              :style="{
                background: 'var(--input-bg)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-main)',
              }"
            />
          </div>

          <label class="flex items-center gap-2 text-xs" :style="{ color: 'var(--text-main)' }">
            <input type="checkbox" v-model="form.isActive" style="accent-color: #10b981" />
            Activa
          </label>

          <div v-if="modalError" class="text-xs" style="color: #f43f5e">
            {{ modalError }}
          </div>

          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="text-xs px-3 py-2 rounded border transition"
              :style="{
                background: 'var(--bg-soft)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-main)',
              }"
              @click="closeModal"
            >
              Cancelar
            </button>

            <button
              type="button"
              class="text-xs px-3 py-2 rounded font-semibold text-white transition disabled:opacity-50"
              style="background: #10b981"
              @click="save"
              :disabled="saving"
            >
              {{ saving ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

type Template = { id: number; title: string; content: string; isActive: boolean };

const API_BASE = import.meta.env.VITE_API_URL ?? '';

const loading = ref(false);
const error = ref('');
const q = ref('');
const templates = ref<Template[]>([]);

const modalOpen = ref(false);
const modalError = ref('');
const saving = ref(false);
const editingId = ref<number | null>(null);
const form = ref({ title: '', content: '', isActive: true });

function getToken() {
  return localStorage.getItem('token') || localStorage.getItem('access_token') || '';
}

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase();
  if (!term) return templates.value;
  return templates.value.filter(
    t => t.title.toLowerCase().includes(term) || t.content.toLowerCase().includes(term)
  );
});

async function fetchTemplates() {
  error.value = '';
  loading.value = true;
  try {
    const jwt = getToken();
    const res = await fetch(`${API_BASE}/quick-replies`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    templates.value = await res.json();
  } catch (e: any) {
    error.value = e?.message || 'No se pudo cargar plantillas.';
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  form.value = { title: '', content: '', isActive: true };
  modalError.value = '';
  modalOpen.value = true;
}

function openEdit(t: Template) {
  editingId.value = t.id;
  form.value = { title: t.title, content: t.content, isActive: t.isActive };
  modalError.value = '';
  modalOpen.value = true;
}

function closeModal() {
  modalOpen.value = false;
}

async function save() {
  modalError.value = '';
  const title = form.value.title.trim();
  const content = form.value.content.trim();
  if (!title) return (modalError.value = 'El título es obligatorio.');
  if (!content) return (modalError.value = 'El contenido es obligatorio.');

  saving.value = true;
  try {
    const jwt = getToken();

    const url = editingId.value
      ? `${API_BASE}/quick-replies/${editingId.value}`
      : `${API_BASE}/quick-replies`;

    const method = editingId.value ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, content, isActive: form.value.isActive }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

    await fetchTemplates();
    modalOpen.value = false;
  } catch (e: any) {
    modalError.value = e?.message || 'No se pudo guardar.';
  } finally {
    saving.value = false;
  }
}

async function remove(t: Template) {
  if (!confirm(`¿Eliminar la plantilla "${t.title}"?`)) return;

  try {
    const jwt = getToken();
    const res = await fetch(`${API_BASE}/quick-replies/${t.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt}` },
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

    await fetchTemplates();
  } catch (e: any) {
    alert(e?.message || 'No se pudo eliminar.');
  }
}

onMounted(fetchTemplates);
</script>
