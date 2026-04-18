<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div class="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-md p-5">
      <h2 class="text-sm font-semibold text-white mb-3">
        {{ item ? 'Editar plantilla' : 'Nueva plantilla' }}
      </h2>

      <label class="text-xs text-slate-300">Título</label>
      <input
        v-model="title"
        class="w-full mt-1 mb-3 px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
      />

      <label class="text-xs text-slate-300">Contenido</label>
      <textarea
        v-model="content"
        rows="5"
        class="w-full mt-1 px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
      />

      <div v-if="error" class="mt-2 text-xs text-rose-400">
        {{ error }}
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <button
          class="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600"
          @click="$emit('close')"
        >
          Cancelar
        </button>

        <button
          class="px-3 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-700 font-semibold"
          @click="save"
        >
          Guardar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

const props = defineProps<{
  item?: any | null;
}>();

const emit = defineEmits(['close', 'saved']);

const title = ref('');
const content = ref('');
const error = ref('');

watch(
  () => props.item,
  v => {
    title.value = v?.title || '';
    content.value = v?.content || '';
  },
  { immediate: true }
);

function getToken() {
  return localStorage.getItem('token') || '';
}

async function save() {
  error.value = '';
  if (!title.value.trim() || !content.value.trim()) {
    error.value = 'Título y contenido son obligatorios';
    return;
  }

  try {
    if (props.item) {
      await axios.put(
        `${API_BASE}/quick-replies/${props.item.id}`,
        { title: title.value, content: content.value },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
    } else {
      await axios.post(
        `${API_BASE}/quick-replies`,
        { title: title.value, content: content.value },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
    }

    emit('saved');
    emit('close');
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Error guardando plantilla';
  }
}
</script>
