<!-- src/components/chat/ChatMessages.vue -->
<template>
  <div ref="container" class="min-h-0 space-y-3 chat-scroll">
    <div
      v-if="messages.length === 0 && !error"
      class="h-full flex items-center justify-center text-sm"
      :style="{ color: 'var(--text-muted)' }"
    >
      Aún no hay mensajes en este ticket.
    </div>

    <div
      v-for="msg in messages"
      :key="msg.id"
      class="max-w-3xl"
      :class="msg.senderId === currentUserId ? 'ml-auto text-right' : ''"
    >
      <!-- Burbuja -->
      <div
        class="inline-block rounded-lg px-3 py-2 text-sm border shadow-sm"
        :style="
          msg.senderId === currentUserId
            ? {
                background: '#10b981',
                color: '#ffffff',
                borderColor: '#10b981',
              }
            : {
                background: 'var(--message-other-bg)',
                color: 'var(--text-main)',
                borderColor: 'var(--border-main)',
              }
        "
      >
        <p
          class="font-semibold text-xs mb-0.5"
          :style="{
            color: msg.senderId === currentUserId ? '#ffffff' : 'var(--text-main)',
          }"
        >
          {{ msg.senderName || (msg.senderId === currentUserId ? 'Tú' : 'Soporte') }}
        </p>

        <p v-if="msg.content" class="whitespace-pre-line">
          {{ msg.content }}
        </p>

        <p
          class="text-[11px] mt-1"
          :style="{
            color: msg.senderId === currentUserId ? 'rgba(255,255,255,0.9)' : 'var(--text-soft)',
          }"
        >
          {{ formatDate(msg.createdAt) }}
        </p>
      </div>

      <!-- ADJUNTOS -->
      <div
        v-if="msg.attachments?.length"
        class="mt-2 flex"
        :class="msg.senderId === currentUserId ? 'justify-end' : 'justify-start'"
      >
        <div class="space-y-2">
          <div
            v-for="att in msg.attachments"
            :key="att.id"
            class="max-w-xs rounded-lg border p-2 shadow-sm"
            :style="{
              background:
                msg.senderId === currentUserId ? 'rgba(16,185,129,0.10)' : 'var(--bg-panel)',
              borderColor: 'var(--border-main)',
            }"
          >
            <!-- 🖼️ Imagen -->
            <template v-if="isImage(att)">
              <button type="button" class="block" @click="openImagePreview(att)" title="Ver imagen">
                <img
                  :src="fileUrl(att)"
                  alt="Adjunto"
                  class="max-h-60 w-auto rounded-md border transition cursor-zoom-in"
                  :style="{ borderColor: 'var(--border-main)' }"
                />
              </button>

              <div
                class="mt-1 text-[10px] flex justify-between gap-2"
                :style="{ color: 'var(--text-soft)' }"
              >
                <span class="truncate">{{ att.filename }}</span>
                <span class="whitespace-nowrap">
                  {{ formatBytes(att.size) }}
                </span>
              </div>

              <button
                type="button"
                class="mt-2 w-full text-[12px] px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 font-semibold text-white"
                @click="downloadAttachment(att)"
                title="Descargar imagen"
              >
                ⬇ Descargar
              </button>
            </template>

            <!-- 📎 Archivo -->
            <template v-else>
              <button
                type="button"
                class="w-full text-left text-[12px] underline hover:opacity-80"
                :style="{ color: 'var(--text-main)' }"
                @click="downloadAttachment(att)"
                title="Descargar archivo"
              >
                📎 {{ att.filename }}
              </button>
              <div class="text-[10px] mt-0.5" :style="{ color: 'var(--text-soft)' }">
                {{ att.mimeType }} • {{ formatBytes(att.size) }}
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

type Attachment = {
  id: number;
  filename: string;
  path: string;
  mimeType?: string | null;
  size: number;
  createdAt: string;
};

type Message = {
  id: number;
  content: string;
  createdAt: string;
  senderId: number;
  senderName?: string | null;
  ticketId: number;
  attachments?: Attachment[];
};

defineProps<{
  messages: Message[];
  currentUserId: number;
  error?: string | null;
  formatDate: (d: string | Date) => string;

  isImage: (att: any) => boolean;
  fileUrl: (att: any) => string;
  formatBytes: (n: number) => string;
  downloadAttachment: (att: Attachment) => Promise<void> | void;
  openImagePreview: (att: Attachment) => void;
}>();

const container = ref<HTMLElement | null>(null);

function scrollToBottom() {
  if (!container.value) return;
  container.value.scrollTop = container.value.scrollHeight;
}

defineExpose({ scrollToBottom });
</script>

<style scoped>
.chat-scroll::-webkit-scrollbar {
  width: 6px;
}
.chat-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.7);
}
</style>
