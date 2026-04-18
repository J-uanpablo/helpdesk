<!-- src/components/chat/ChatComposer.vue -->
<template>
  <div class="shrink-0">
    <!-- PREVIEW ARCHIVOS -->
    <div
      v-if="pendingFiles.length && !isTicketClosed"
      class="mb-3 px-4 py-3 border rounded-lg"
      :style="{
        background: 'var(--bg-soft)',
        borderColor: 'var(--border-main)',
      }"
    >
      <div class="flex items-center justify-between gap-2 mb-2">
        <p class="text-[12px] font-semibold" :style="{ color: 'var(--text-main)' }">
          Adjuntos para enviar ({{ pendingFiles.length }})
        </p>
        <p class="text-[11px]" :style="{ color: 'var(--text-soft)' }">
          Puedes pegar con <span class="font-semibold">Ctrl+V</span>
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <div
          v-for="(f, idx) in pendingFiles"
          :key="idx"
          class="flex items-center gap-2 px-2 py-1 rounded-md border"
          :style="{
            background: 'var(--bg-panel)',
            borderColor: 'var(--border-main)',
          }"
        >
          <span class="text-[11px] max-w-[240px] truncate" :style="{ color: 'var(--text-main)' }">
            📎 {{ f.name }}
          </span>

          <span class="text-[10px] whitespace-nowrap" :style="{ color: 'var(--text-soft)' }">
            {{ formatBytes(f.size) }}
          </span>

          <button
            type="button"
            class="text-[11px] text-rose-500 hover:text-rose-600"
            @click="$emit('remove-file', idx)"
          >
            ✕
          </button>
        </div>
      </div>

      <p v-if="uploadError" class="text-[11px] text-rose-500 mt-2">
        {{ uploadError }}
      </p>
    </div>

    <!-- INPUT AREA -->
    <form
      class="border-t pt-4 flex items-center gap-3"
      :style="{ borderColor: 'var(--border-main)' }"
      @submit.prevent="handleSubmit"
    >
      <!-- ADJUNTAR -->
      <label
        class="h-10 px-3 rounded-md text-sm font-semibold border cursor-pointer flex items-center justify-center transition"
        :style="{
          background: 'var(--bg-soft)',
          borderColor: 'var(--border-main)',
          color: 'var(--text-main)',
        }"
        :class="isTicketClosed ? 'opacity-50 cursor-not-allowed' : ''"
        title="Adjuntar archivos"
      >
        📎
        <input
          type="file"
          class="hidden"
          multiple
          :disabled="isTicketClosed"
          @change="$emit('files-selected', ($event.target as HTMLInputElement).files)"
        />
      </label>

      <!-- INPUT + DROPDOWN -->
      <div class="relative flex-1 min-w-0">
        <input
          :value="modelValue"
          @input="onInput"
          @paste="$emit('paste', $event)"
          @keydown="onKeydown"
          type="text"
          class="w-full px-3 py-2 rounded border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
          :style="{
            background: 'var(--input-bg)',
            borderColor: 'var(--border-main)',
            color: 'var(--text-main)',
          }"
          :placeholder="computedPlaceholder"
          :disabled="isSending || isTicketClosed"
        />

        <!-- DROPDOWN PLANTILLAS -->
        <div
          v-if="showQuickReplies && filteredQuickReplies.length"
          class="absolute left-0 right-0 bottom-12 z-30 rounded-lg border shadow-xl overflow-hidden"
          :style="{
            background: 'var(--bg-panel)',
            borderColor: 'var(--border-main)',
          }"
        >
          <div
            class="px-3 py-2 text-[11px] border-b"
            :style="{ color: 'var(--text-soft)', borderColor: 'var(--border-main)' }"
          >
            Plantillas (usa ↑ ↓ y Enter)
          </div>

          <button
            v-for="(tpl, i) in filteredQuickReplies"
            :key="tpl.id"
            type="button"
            class="w-full text-left px-3 py-2 text-sm transition"
            :style="
              i === selectedReplyIndex
                ? {
                    background: 'rgba(16,185,129,0.10)',
                    color: 'var(--text-main)',
                  }
                : {
                    background: 'transparent',
                    color: 'var(--text-main)',
                  }
            "
            @mousedown.prevent="applyTemplate(tpl)"
          >
            <div class="font-semibold truncate">{{ tpl.title }}</div>
            <div class="text-[12px] truncate" :style="{ color: 'var(--text-soft)' }">
              {{ tpl.content }}
            </div>
          </button>
        </div>
      </div>

      <!-- BOTÓN -->
      <button
        type="submit"
        class="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        :disabled="isButtonDisabled"
      >
        {{ buttonLabel }}
      </button>
    </form>

    <p v-if="isTicketClosed" class="mt-2 text-xs" :style="{ color: 'var(--text-soft)' }">
      🔒 Este ticket está cerrado. No puedes enviar nuevos mensajes.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';

interface QuickReply {
  id: number;
  title: string;
  content: string;
  isActive?: boolean;
}
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';
const props = defineProps<{
  authToken: string;

  modelValue: string;
  pendingFiles: File[];
  uploadError?: string | null;

  isTicketClosed: boolean;
  isSending: boolean;

  formatBytes: (n: number) => string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void;
  (e: 'send'): void;
  (e: 'paste', ev: ClipboardEvent): void;
  (e: 'files-selected', files: FileList | null): void;
  (e: 'remove-file', idx: number): void;
}>();

/* ===========================
   QUICK REPLIES CON "/"
=========================== */
const quickReplies = ref<QuickReply[]>([]);
const quickRepliesLoaded = ref(false);
const showQuickReplies = ref(false);
const quickReplyQuery = ref('');
const selectedReplyIndex = ref(0);

async function fetchTemplates() {
  const jwt = (props.authToken || '').trim();
  if (!jwt) return;

  try {
    const res = await fetch(`${API_BASE_URL}/quick-replies`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!res.ok) return;

    const data = await res.json();

    quickReplies.value = Array.isArray(data)
      ? data.filter((item: any) => item?.isActive !== false)
      : [];

    quickRepliesLoaded.value = true;
  } catch (e) {
    console.warn('No se pudieron cargar las plantillas rápidas:', e);
  }
}

function extractSlashQuery(text: string): string | null {
  const idx = text.lastIndexOf('/');
  if (idx < 0) return null;

  const prev = idx === 0 ? ' ' : text[idx - 1];
  const validPrev = prev === ' ' || prev === '\n' || prev === '\t';

  if (!validPrev) return null;

  return text.slice(idx + 1);
}

const filteredQuickReplies = computed(() => {
  const term = quickReplyQuery.value.trim().toLowerCase();

  if (!term) return quickReplies.value;

  return quickReplies.value.filter(
    t => t.title.toLowerCase().includes(term) || t.content.toLowerCase().includes(term)
  );
});

function closeQuickReplies() {
  showQuickReplies.value = false;
  quickReplyQuery.value = '';
  selectedReplyIndex.value = 0;
}

function applyTemplate(tpl: QuickReply) {
  const text = props.modelValue || '';
  const idx = text.lastIndexOf('/');

  if (idx >= 0) {
    const before = text.slice(0, idx);
    const newValue = before + tpl.content;
    emit('update:modelValue', newValue);
  } else {
    const newValue = (text ? text + '\n' : '') + tpl.content;
    emit('update:modelValue', newValue);
  }

  closeQuickReplies();
}

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  emit('update:modelValue', value);

  if (props.isTicketClosed) {
    closeQuickReplies();
    return;
  }

  const q = extractSlashQuery(value);

  if (q === null) {
    closeQuickReplies();
    return;
  }

  quickReplyQuery.value = q;
  showQuickReplies.value = true;
  selectedReplyIndex.value = 0;

  if (!quickRepliesLoaded.value) {
    void fetchTemplates();
  }
}

function onKeydown(e: KeyboardEvent) {
  if (!showQuickReplies.value) return;

  const list = filteredQuickReplies.value;

  if (!list.length) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeQuickReplies();
    }
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedReplyIndex.value = (selectedReplyIndex.value + 1) % list.length;
    return;
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedReplyIndex.value = (selectedReplyIndex.value - 1 + list.length) % list.length;
    return;
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    applyTemplate(list[selectedReplyIndex.value]);
    return;
  }

  if (e.key === 'Escape') {
    e.preventDefault();
    closeQuickReplies();
  }
}

function handleSubmit() {
  if (showQuickReplies.value && filteredQuickReplies.value.length) {
    applyTemplate(filteredQuickReplies.value[selectedReplyIndex.value]);
    return;
  }

  emit('send');
}

/* ===========================
   COMPUTED HELPERS
=========================== */
const computedPlaceholder = computed(() => {
  if (props.isTicketClosed) {
    return 'Ticket cerrado. No puedes enviar mensajes.';
  }

  if (props.pendingFiles.length) {
    return 'Opcional: escribe un mensaje para acompañar adjuntos...';
  }

  return 'Escribe tu mensaje...';
});

const isButtonDisabled = computed(() => {
  if (props.isTicketClosed) return true;
  if (props.isSending) return true;

  return !props.modelValue.trim() && props.pendingFiles.length === 0;
});

const buttonLabel = computed(() => {
  if (props.isTicketClosed) return 'Ticket cerrado';
  if (props.isSending) return 'Enviando...';
  if (props.pendingFiles.length) return 'Enviar + adjuntos';
  return 'Enviar';
});

onMounted(() => {
  void fetchTemplates();
});
</script>
