<template>
  <div class="space-y-3">
    <!-- HEADER -->
    <div class="flex items-center justify-between gap-3">
      <h3 class="text-sm font-semibold" :style="{ color: 'var(--text-main)' }">
        Plantillas rápidas (mis plantillas)
      </h3>

      <button
        type="button"
        class="px-3 py-2 rounded-md text-xs font-semibold text-white transition"
        style="background: #10b981"
        @click="openCreate"
      >
        ＋ Nueva
      </button>
    </div>

    <!-- BUSCADOR -->
    <div class="flex items-center gap-2">
      <input
        v-model="q"
        type="text"
        class="w-full px-3 py-2 rounded-md border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
        :style="{
          background: 'var(--input-bg)',
          borderColor: 'var(--border-main)',
          color: 'var(--text-main)',
        }"
        placeholder="Buscar por título o contenido..."
      />

      <button
        type="button"
        class="px-3 py-2 rounded-md border text-xs transition"
        :style="{
          background: 'var(--bg-soft)',
          borderColor: 'var(--border-main)',
          color: 'var(--text-main)',
        }"
        @click="fetchTemplates"
        :disabled="loading"
        title="Recargar"
      >
        ↻
      </button>
    </div>

    <!-- ESTADOS -->
    <div v-if="error" class="text-xs text-rose-500">
      {{ error }}
    </div>

    <div v-if="loading" class="text-xs" :style="{ color: 'var(--text-soft)' }">Cargando...</div>

    <!-- LISTADO -->
    <div
      v-else
      class="max-h-[380px] overflow-auto rounded-lg border"
      :style="{
        borderColor: 'var(--border-main)',
        background: 'var(--bg-panel)',
      }"
    >
      <div
        v-for="t in filtered"
        :key="t.id"
        class="p-3 border-b transition"
        :style="{
          borderColor: 'var(--border-main)',
        }"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-xs font-semibold truncate" :style="{ color: 'var(--text-main)' }">
              {{ t.title }}
            </div>

            <div
              class="text-[11px] whitespace-pre-line mt-1 line-clamp-2"
              :style="{ color: 'var(--text-soft)' }"
            >
              {{ t.content }}
            </div>
          </div>

          <div class="flex gap-2 shrink-0">
            <button
              type="button"
              class="px-2 py-1 rounded-md border text-xs transition"
              :style="{
                background: 'var(--bg-soft)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-main)',
              }"
              @click="openEdit(t)"
              title="Editar"
            >
              ✎
            </button>

            <button
              type="button"
              class="px-2 py-1 rounded-md text-xs font-semibold text-white transition"
              style="background: #e11d48"
              @click="confirmDelete(t)"
              title="Eliminar"
            >
              🗑
            </button>
          </div>
        </div>
      </div>

      <div v-if="filtered.length === 0" class="p-3 text-xs" :style="{ color: 'var(--text-soft)' }">
        No tienes plantillas aún.
      </div>
    </div>

    <!-- MODAL CREATE/EDIT -->
    <div
      v-if="editorOpen"
      class="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center p-4"
      @click.self="closeEditor"
    >
      <div
        class="w-full max-w-lg rounded-xl border p-5 shadow-xl"
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
            class="text-sm transition"
            :style="{ color: 'var(--text-soft)' }"
            type="button"
            @click="closeEditor"
          >
            ✕
          </button>
        </div>

        <div class="mt-3 space-y-3">
          <div>
            <label class="block text-xs mb-1" :style="{ color: 'var(--text-soft)' }">Título</label>
            <input
              v-model="formTitle"
              type="text"
              class="w-full px-3 py-2 rounded-md border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              :style="{
                background: 'var(--input-bg)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-main)',
              }"
              placeholder="Ej: Estamos revisando tu caso"
            />
          </div>

          <div>
            <label class="block text-xs mb-1" :style="{ color: 'var(--text-soft)' }">
              Contenido
            </label>
            <textarea
              v-model="formContent"
              rows="5"
              class="w-full px-3 py-2 rounded-md border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              :style="{
                background: 'var(--input-bg)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-main)',
              }"
              placeholder="Texto que se insertará en el chat..."
            />
          </div>

          <div v-if="editorError" class="text-xs text-rose-500">
            {{ editorError }}
          </div>

          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="text-xs px-3 py-2 rounded-md border transition"
              :style="{
                background: 'var(--bg-soft)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-main)',
              }"
              @click="closeEditor"
            >
              Cancelar
            </button>

            <button
              type="button"
              class="text-xs px-3 py-2 rounded-md font-semibold text-white transition"
              style="background: #10b981"
              @click="saveEditor"
              :disabled="saving"
            >
              {{ saving ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- CONFIRM DELETE -->
    <div
      v-if="deleteOpen"
      class="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center p-4"
      @click.self="deleteOpen = false"
    >
      <div
        class="w-full max-w-md rounded-xl border p-5 shadow-xl"
        :style="{
          background: 'var(--bg-panel)',
          borderColor: 'var(--border-main)',
        }"
      >
        <h3 class="text-sm font-semibold" :style="{ color: 'var(--text-main)' }">
          Eliminar plantilla
        </h3>

        <p class="text-xs mt-2" :style="{ color: 'var(--text-soft)' }">
          ¿Seguro que deseas eliminar
          <span class="font-semibold" :style="{ color: 'var(--text-main)' }">
            {{ deleteTarget?.title }}
          </span>
          ?
        </p>

        <div v-if="deleteError" class="text-xs text-rose-500 mt-2">
          {{ deleteError }}
        </div>

        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            class="text-xs px-3 py-2 rounded-md border transition"
            :style="{
              background: 'var(--bg-soft)',
              borderColor: 'var(--border-main)',
              color: 'var(--text-main)',
            }"
            @click="deleteOpen = false"
          >
            Cancelar
          </button>

          <button
            type="button"
            class="text-xs px-3 py-2 rounded-md font-semibold text-white transition"
            style="background: #e11d48"
            @click="doDelete"
            :disabled="deleting"
          >
            {{ deleting ? 'Eliminando...' : 'Eliminar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

type Template = { id: number; title: string; content: string };

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const props = defineProps<{ authToken: string }>();

const templates = ref<Template[]>([]);
const loading = ref(false);
const error = ref('');
const q = ref('');

/** ✅ UNA sola función */
function getToken() {
  return (
    (props.authToken || '').trim() ||
    localStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    ''
  );
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
    if (!jwt) throw new Error('No hay token. Inicia sesión nuevamente.');

    const res = await fetch(`${API_BASE}/quick-replies`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.message || `HTTP ${res.status}`);
    }

    templates.value = await res.json();
  } catch (e: any) {
    error.value = e?.message || 'No se pudo cargar plantillas.';
  } finally {
    loading.value = false;
  }
}

/* ===== Editor ===== */
const editorOpen = ref(false);
const editingId = ref<number | null>(null);
const formTitle = ref('');
const formContent = ref('');
const editorError = ref('');
const saving = ref(false);

function openCreate() {
  editingId.value = null;
  formTitle.value = '';
  formContent.value = '';
  editorError.value = '';
  editorOpen.value = true;
}

function openEdit(t: Template) {
  editingId.value = t.id;
  formTitle.value = t.title;
  formContent.value = t.content;
  editorError.value = '';
  editorOpen.value = true;
}

function closeEditor() {
  editorOpen.value = false;
}

async function saveEditor() {
  editorError.value = '';
  const title = formTitle.value.trim();
  const content = formContent.value.trim();

  if (!title) return (editorError.value = 'El título es obligatorio.');
  if (!content) return (editorError.value = 'El contenido es obligatorio.');

  saving.value = true;
  try {
    const jwt = getToken();
    if (!jwt) throw new Error('No hay token. Inicia sesión nuevamente.');

    const isEdit = !!editingId.value;
    const url = isEdit
      ? `${API_BASE}/quick-replies/${editingId.value}`
      : `${API_BASE}/quick-replies`;

    const res = await fetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, content }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.message || `HTTP ${res.status}`);
    }

    await fetchTemplates();
    editorOpen.value = false;
  } catch (e: any) {
    editorError.value = e?.message || 'No se pudo guardar.';
  } finally {
    saving.value = false;
  }
}

/* ===== Delete ===== */
const deleteOpen = ref(false);
const deleteTarget = ref<Template | null>(null);
const deleteError = ref('');
const deleting = ref(false);

function confirmDelete(t: Template) {
  deleteTarget.value = t;
  deleteError.value = '';
  deleteOpen.value = true;
}

async function doDelete() {
  deleteError.value = '';
  if (!deleteTarget.value) return;

  deleting.value = true;
  try {
    const jwt = getToken();
    if (!jwt) throw new Error('No hay token. Inicia sesión nuevamente.');

    const res = await fetch(`${API_BASE}/quick-replies/${deleteTarget.value.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt}` },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.message || `HTTP ${res.status}`);
    }

    deleteOpen.value = false;
    deleteTarget.value = null;
    await fetchTemplates();
  } catch (e: any) {
    deleteError.value = e?.message || 'No se pudo eliminar.';
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  fetchTemplates();
});
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
