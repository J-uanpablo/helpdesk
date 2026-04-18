<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
    @click.self="$emit('close')"
  >
    <div
      class="w-full max-w-lg overflow-hidden rounded-3xl border shadow-2xl"
      :style="{
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-main)',
        color: 'var(--text-main)',
      }"
    >
      <div class="border-b px-6 py-5" :style="{ borderColor: 'var(--border-main)' }">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.25em]" style="color: #22d3ee">
              Mesa de Ayuda
            </p>
            <h2 class="mt-2 text-xl font-bold" :style="{ color: 'var(--text-main)' }">
              Exportar informe
            </h2>
            <p class="mt-2 text-sm leading-6" :style="{ color: 'var(--text-soft)' }">
              Genera el reporte de soporte en Excel según el rango de fechas y el alcance
              seleccionado.
            </p>
          </div>
        </div>
      </div>

      <div class="px-6 py-5">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label
              class="text-[11px] font-semibold uppercase tracking-wide"
              :style="{ color: 'var(--text-soft)' }"
            >
              Desde
            </label>

            <button
              type="button"
              @click="openDatePicker('from')"
              class="mt-2 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition"
              :style="{
                background: 'var(--input-bg)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-main)',
              }"
            >
              <span>{{ formatDateDisplay(from) || 'Selecciona una fecha' }}</span>

              <span class="text-base opacity-70">📅</span>

              <input
                ref="fromInputRef"
                :value="from"
                @input="$emit('update:from', ($event.target as HTMLInputElement).value)"
                type="date"
                class="pointer-events-none absolute opacity-0"
                tabindex="-1"
              />
            </button>
          </div>

          <div>
            <label
              class="text-[11px] font-semibold uppercase tracking-wide"
              :style="{ color: 'var(--text-soft)' }"
            >
              Hasta
            </label>

            <button
              type="button"
              @click="openDatePicker('to')"
              class="mt-2 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition"
              :style="{
                background: 'var(--input-bg)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-main)',
              }"
            >
              <span>{{ formatDateDisplay(to) || 'Selecciona una fecha' }}</span>

              <span class="text-base opacity-70">📅</span>

              <input
                ref="toInputRef"
                :value="to"
                @input="$emit('update:to', ($event.target as HTMLInputElement).value)"
                type="date"
                class="pointer-events-none absolute opacity-0"
                tabindex="-1"
              />
            </button>
          </div>
        </div>

        <div v-if="isSuperAdmin" class="mt-4">
          <label
            class="text-[11px] font-semibold uppercase tracking-wide"
            :style="{ color: 'var(--text-soft)' }"
          >
            Área
          </label>

          <select
            :value="area"
            @change="$emit('update:area', ($event.target as HTMLSelectElement).value)"
            class="mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none transition"
            :style="{
              background: 'var(--input-bg)',
              borderColor: 'var(--border-main)',
              color: 'var(--text-main)',
            }"
          >
            <option value="ALL">Todas las áreas</option>
            <option v-for="a in areas" :key="a" :value="a">
              {{ a }}
            </option>
          </select>
        </div>

        <div
          class="mt-5 rounded-2xl border px-4 py-3 text-sm"
          :style="{
            background: 'var(--bg-soft)',
            borderColor: 'var(--border-main)',
            color: 'var(--text-soft)',
          }"
        >
          El archivo incluirá resumen por agente, detalle de tickets, estado, cliente, agente y
          satisfacción.
        </div>
      </div>

      <div
        class="flex flex-col-reverse gap-3 border-t px-6 py-4 sm:flex-row sm:justify-end"
        :style="{ borderColor: 'var(--border-main)' }"
      >
        <button
          @click="$emit('close')"
          class="rounded-xl border px-4 py-2.5 text-sm font-medium transition"
          :style="{
            background: 'var(--bg-soft)',
            borderColor: 'var(--border-main)',
            color: 'var(--text-main)',
          }"
        >
          Cancelar
        </button>

        <button
          @click="$emit('download')"
          class="rounded-xl px-4 py-2.5 text-sm font-semibold transition"
          style="background: #059669; color: white"
        >
          Descargar Excel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  open: boolean;
  from: string;
  to: string;
  area: string;
  areas: string[];
  isSuperAdmin: boolean;
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'download'): void;
  (e: 'update:from', v: string): void;
  (e: 'update:to', v: string): void;
  (e: 'update:area', v: string): void;
}>();

const fromInputRef = ref<HTMLInputElement | null>(null);
const toInputRef = ref<HTMLInputElement | null>(null);

function openDatePicker(type: 'from' | 'to') {
  const input = type === 'from' ? fromInputRef.value : toInputRef.value;
  if (!input) return;

  input.focus();

  if (typeof input.showPicker === 'function') {
    input.showPicker();
  } else {
    input.click();
  }
}

function formatDateDisplay(value: string) {
  if (!value) return '';

  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}
</script>
