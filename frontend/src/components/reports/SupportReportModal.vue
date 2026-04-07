<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    @click.self="$emit('close')"
  >
    <div
      class="w-full max-w-md rounded-xl border p-6 shadow-xl"
      :style="{
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-main)',
        color: 'var(--text-main)',
      }"
    >
      <h2 class="mb-2 text-lg font-semibold" :style="{ color: 'var(--text-main)' }">
        Reporte de soporte
      </h2>

      <p class="mb-4 text-sm" :style="{ color: 'var(--text-soft)' }">
        Selecciona un rango de fechas para descargar el reporte en Excel.
      </p>

      <div class="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label class="text-[11px]" :style="{ color: 'var(--text-soft)' }">Desde</label>
          <input
            :value="from"
            @input="$emit('update:from', ($event.target as HTMLInputElement).value)"
            type="date"
            class="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            :style="{
              background: 'var(--input-bg)',
              borderColor: 'var(--border-main)',
              color: 'var(--text-main)',
            }"
          />
        </div>

        <div>
          <label class="text-[11px]" :style="{ color: 'var(--text-soft)' }">Hasta</label>
          <input
            :value="to"
            @input="$emit('update:to', ($event.target as HTMLInputElement).value)"
            type="date"
            class="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            :style="{
              background: 'var(--input-bg)',
              borderColor: 'var(--border-main)',
              color: 'var(--text-main)',
            }"
          />
        </div>
      </div>

      <div v-if="isSuperAdmin" class="mb-4">
        <label class="text-[11px]" :style="{ color: 'var(--text-soft)' }">Área (opcional)</label>
        <select
          :value="area"
          @change="$emit('update:area', ($event.target as HTMLSelectElement).value)"
          class="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          :style="{
            background: 'var(--input-bg)',
            borderColor: 'var(--border-main)',
            color: 'var(--text-main)',
          }"
        >
          <option value="ALL">Todas</option>
          <option v-for="a in areas" :key="a" :value="a">{{ a }}</option>
        </select>
      </div>

      <div class="flex justify-end gap-3">
        <button
          @click="$emit('close')"
          class="rounded-md border px-3 py-1.5 text-sm transition"
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
          class="rounded-md px-3 py-1.5 text-sm font-semibold text-white transition"
          style="background: #059669"
        >
          Descargar Excel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
</script>
