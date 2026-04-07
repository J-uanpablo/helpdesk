<!-- frontend/src/components/tickets/TicketSatisfactionModal.vue -->
<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Overlay -->
    <div class="absolute inset-0 bg-black/55 backdrop-blur-[2px]" @click="emitClose()"></div>

    <!-- Modal -->
    <div
      class="relative w-full max-w-2xl overflow-hidden rounded-[22px] border shadow-2xl"
      :style="{
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-main)',
        color: 'var(--text-main)',
        boxShadow: '0 20px 60px rgba(15,23,42,0.18), 0 8px 24px rgba(15,23,42,0.08)',
      }"
    >
      <!-- Header -->
      <div class="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
        <div class="min-w-0">
          <div class="flex items-center gap-3">
            <div
              class="flex h-11 w-11 items-center justify-center rounded-2xl"
              style="background: rgba(16, 185, 129, 0.12)"
            >
              <span class="text-xl">⭐</span>
            </div>

            <div>
              <h2
                class="text-[30px] font-bold leading-none tracking-tight"
                :style="{ color: 'var(--text-main)' }"
              >
                Califica tu atención
              </h2>
              <p class="mt-2 text-[15px] leading-6" :style="{ color: 'var(--text-soft)' }">
                Tu calificación nos ayuda a mejorar el servicio.
              </p>
            </div>
          </div>
        </div>

        <button
          class="inline-flex h-10 w-10 items-center justify-center rounded-xl border transition"
          :style="{
            borderColor: 'var(--border-main)',
            color: 'var(--text-soft)',
            background: 'transparent',
          }"
          @click="emitClose()"
          aria-label="Cerrar"
          type="button"
        >
          ✕
        </button>
      </div>

      <!-- Body -->
      <div class="px-6 pb-6">
        <!-- Rating -->
        <div
          class="rounded-2xl border p-5"
          :style="{
            borderColor: 'var(--border-main)',
            background: 'var(--bg-panel)',
          }"
        >
          <label class="block text-[15px] font-semibold" :style="{ color: 'var(--text-main)' }">
            Satisfacción
          </label>

          <div class="mt-4 flex flex-wrap items-center gap-3">
            <button
              v-for="n in 5"
              :key="n"
              type="button"
              class="group relative transition-transform duration-150 hover:scale-110 disabled:cursor-not-allowed disabled:opacity-60"
              @click="setRating(n)"
              :disabled="loading"
              aria-label="Calificación"
              title="Calificar"
            >
              <span
                class="text-[42px] leading-none"
                :style="{
                  color: n <= rating ? '#f59e0b' : 'rgba(148,163,184,0.75)',
                  textShadow: n <= rating ? '0 4px 10px rgba(245,158,11,0.22)' : 'none',
                }"
              >
                ★
              </span>
            </button>

            <div
              v-if="rating > 0"
              class="ml-1 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold"
              style="background: rgba(16, 185, 129, 0.1); color: #047857"
            >
              {{ rating }}/5
            </div>
          </div>

          <p v-if="rating === 0" class="mt-3 text-sm" :style="{ color: 'var(--text-soft)' }">
            Selecciona de 1 a 5 estrellas según tu experiencia.
          </p>

          <p v-if="ratingError" class="mt-3 text-sm font-medium text-rose-600">
            {{ ratingError }}
          </p>
        </div>

        <!-- Comment -->
        <div class="mt-5">
          <label class="block text-[15px] font-semibold" :style="{ color: 'var(--text-main)' }">
            Comentario
            <span class="font-normal" :style="{ color: 'var(--text-soft)' }">(opcional)</span>
          </label>

          <div class="mt-3">
            <textarea
              v-model="comment"
              class="min-h-[170px] w-full rounded-2xl border px-4 py-4 text-[15px] outline-none transition placeholder:opacity-70 focus:ring-4"
              :style="{
                background: 'var(--bg-soft)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-main)',
                boxShadow: 'none',
              }"
              rows="5"
              :maxlength="1000"
              :disabled="loading"
              placeholder="Cuéntanos cómo fue tu experiencia..."
            ></textarea>

            <div class="mt-2 text-right text-xs font-medium" :style="{ color: 'var(--text-soft)' }">
              {{ comment.length }}/1000
            </div>
          </div>
        </div>

        <!-- Error -->
        <div
          v-if="serverError"
          class="mt-4 rounded-2xl border px-4 py-3 text-sm font-medium"
          style="
            background: rgba(244, 63, 94, 0.06);
            color: #be123c;
            border-color: rgba(244, 63, 94, 0.18);
          "
        >
          {{ serverError }}
        </div>

        <!-- Footer -->
        <div class="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            class="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition disabled:opacity-60"
            :style="{ color: 'var(--text-soft)' }"
            @click="emitClose()"
            :disabled="loading"
          >
            Omitir
          </button>

          <button
            type="button"
            class="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            style="
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              box-shadow: 0 10px 22px rgba(16, 185, 129, 0.22);
            "
            @click="submit()"
            :disabled="loading"
          >
            {{ loading ? 'Enviando...' : 'Enviar calificación' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import axios from 'axios';

const API_BASE = 'http://localhost:3000';

type Props = {
  open: boolean;
  ticketId: number;
  authToken?: string;
};

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submitted'): void;
}>();

const rating = ref(0);
const comment = ref('');
const loading = ref(false);
const ratingError = ref('');
const serverError = ref('');

watch(
  () => props.open,
  v => {
    if (v) {
      rating.value = 0;
      comment.value = '';
      loading.value = false;
      ratingError.value = '';
      serverError.value = '';
    }
  }
);

function setRating(n: number) {
  rating.value = n;
  ratingError.value = '';
}

function emitClose() {
  emit('close');
}

function getToken() {
  if (props.authToken && props.authToken.trim()) return props.authToken.trim();
  return (localStorage.getItem('token') || localStorage.getItem('access_token') || '').trim();
}

async function submit() {
  serverError.value = '';
  ratingError.value = '';

  if (rating.value < 1 || rating.value > 5) {
    ratingError.value = 'Selecciona una calificación de 1 a 5 estrellas.';
    return;
  }

  const token = getToken();
  if (!token) {
    serverError.value = 'No hay token. Cierra sesión e inicia nuevamente.';
    return;
  }

  loading.value = true;
  try {
    await axios.post(
      `${API_BASE}/tickets/${props.ticketId}/satisfaction`,
      {
        rating: rating.value,
        comment: comment.value.trim() ? comment.value.trim() : undefined,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    emit('submitted');
  } catch (e: any) {
    const msg = e?.response?.data?.message ?? e?.message ?? 'No se pudo enviar la calificación.';
    serverError.value = Array.isArray(msg) ? msg.join(' | ') : String(msg);
  } finally {
    loading.value = false;
  }
}
</script>
