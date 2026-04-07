<!-- src/components/chat/QuickReplies.vue -->
<template>
  <div class="relative flex items-center gap-2">
    <button
      type="button"
      class="h-9 px-3 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-semibold border border-slate-700"
      @click="toggle"
      :disabled="loading"
      title="Respuestas rápidas"
    >
      ⚡ Plantillas
    </button>

    <!-- Dropdown (hacia ARRIBA) -->
    <div
      v-if="open"
      class="absolute left-0 bottom-11 z-50 w-[360px] rounded-lg border border-slate-700 bg-slate-900 shadow-xl p-2"
    >
      <div class="flex items-center gap-2 mb-2">
        <input
          v-model="q"
          type="text"
          class="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="Buscar plantilla..."
        />
        <button
          type="button"
          class="px-2 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold"
          @click="openCreate"
          title="Crear plantilla"
        >
          ＋
        </button>
      </div>

      <div v-if="error" class="mb-2 text-xs text-rose-300">
        {{ error }}
      </div>

      <div v-if="loading" class="text-xs text-slate-400 px-2 py-2">Cargando...</div>

      <div v-else class="max-h-64 overflow-auto">
        <button
          v-for="t in filtered"
          :key="t.id"
          type="button"
          class="w-full text-left px-3 py-2 rounded hover:bg-slate-800 border border-transparent hover:border-slate-700"
          @click="select(t.content)"
        >
          <div class="text-xs font-semibold text-white truncate">
            {{ t.title }}
          </div>
          <div class="text-[11px] text-slate-300 whitespace-pre-line line-clamp-2">
            {{ t.content }}
          </div>
        </button>

        <div v-if="filtered.length === 0" class="text-xs text-slate-400 px-2 py-2">
          No hay plantillas.
        </div>
      </div>

      <div class="mt-2 flex justify-end">
        <button
          type="button"
          class="text-xs px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700"
          @click="close"
        >
          Cerrar
        </button>
      </div>
    </div>

    <!-- Modal crear -->
    <div
      v-if="createOpen"
      class="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center"
      @click.self="createOpen = false"
    >
      <div class="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-700 p-5">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-white">Nueva plantilla</h3>
          <button class="text-slate-300 hover:text-white" type="button" @click="createOpen = false">
            ✕
          </button>
        </div>

        <div class="mt-3 space-y-3">
          <div>
            <label class="block text-xs text-slate-300 mb-1">Título</label>
            <input
              v-model="newTitle"
              type="text"
              class="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs text-white"
              placeholder="Ej: Estamos revisando tu caso"
            />
          </div>

          <div>
            <label class="block text-xs text-slate-300 mb-1">Contenido</label>
            <textarea
              v-model="newContent"
              rows="4"
              class="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-xs text-white"
              placeholder="Texto que se insertará en el chat..."
            />
          </div>

          <div v-if="createError" class="text-xs text-rose-300">
            {{ createError }}
          </div>

          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="text-xs px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700"
              @click="createOpen = false"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="text-xs px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700 font-semibold"
              @click="create"
              :disabled="creating"
            >
              {{ creating ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

type Template = { id: number; title: string; content: string };

// ✅ ahora recibe token desde el padre
const props = defineProps<{
  authToken: string;
}>();

const emit = defineEmits<{
  (e: 'select', text: string): void;
}>();

const API_BASE = 'http://localhost:3000';

const open = ref(false);
const loading = ref(false);
const error = ref('');
const q = ref('');

const templates = ref<Template[]>([]);

// crear
const createOpen = ref(false);
const newTitle = ref('');
const newContent = ref('');
const createError = ref('');
const creating = ref(false);

function getToken() {
  // ✅ usa el token que viene del padre
  return (props.authToken || '').trim();
}

function toggle() {
  open.value = !open.value;
  if (open.value && templates.value.length === 0) {
    fetchTemplates();
  }
}
function close() {
  open.value = false;
}

function select(text: string) {
  emit('select', text);
  close();
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

  const jwt = getToken();
  if (!jwt) {
    error.value = 'No hay token. Inicia sesión nuevamente.';
    loading.value = false;
    return;
  }

  try {
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
  createError.value = '';
  newTitle.value = '';
  newContent.value = '';
  createOpen.value = true;
}

async function create() {
  createError.value = '';
  const title = newTitle.value.trim();
  const content = newContent.value.trim();

  if (!title) return (createError.value = 'El título es obligatorio.');
  if (!content) return (createError.value = 'El contenido es obligatorio.');

  const jwt = getToken();
  if (!jwt) return (createError.value = 'No hay token. Inicia sesión nuevamente.');

  creating.value = true;
  try {
    const res = await fetch(`${API_BASE}/quick-replies`, {
      method: 'POST',
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
    createOpen.value = false;
  } catch (e: any) {
    createError.value = e?.message || 'No se pudo crear la plantilla.';
  } finally {
    creating.value = false;
  }
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
