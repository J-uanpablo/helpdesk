<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const API_BASE = 'http://localhost:3000';

const router = useRouter();
const { token, initAuth } = useAuth();

/* ===========================
   FORM
=========================== */
const form = reactive({
  subject: '',
  area: '', // 👈 nombre EXACTO del área desde BD
  description: '',
});

const isSubmitting = ref(false);
const error = ref<string | null>(null);

/* ===========================
   ÁREAS DESDE BD
=========================== */
interface SupportArea {
  id: number;
  name: string;
  isActive: boolean;
}

const areas = ref<SupportArea[]>([]);
const isLoadingAreas = ref(false);

/* ===========================
   FILES
=========================== */
const files = ref<File[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

function openPicker() {
  fileInput.value?.click();
}

function onPickFiles(e: Event) {
  const input = e.target as HTMLInputElement;
  const list = Array.from(input.files || []);
  if (!list.length) return;
  files.value.push(...list);
  input.value = '';
}

function removeFile(idx: number) {
  files.value.splice(idx, 1);
}

function preventDefaults(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
}

function onDrop(e: DragEvent) {
  preventDefaults(e);
  isDragging.value = false;
  const dropped = Array.from(e.dataTransfer?.files || []);
  if (!dropped.length) return;
  files.value.push(...dropped);
}

/* ===========================
   LOAD SUPPORT AREAS
=========================== */
async function loadSupportAreas() {
  const jwt = (token.value ?? '').trim();
  if (!jwt) return;

  isLoadingAreas.value = true;
  try {
    const res = await fetch(`${API_BASE}/support-areas`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    if (!res.ok) throw new Error(`Error ${res.status} cargando áreas`);

    const data: SupportArea[] = await res.json();

    // 👇 SOLO ACTIVAS
    areas.value = data.filter(a => a.isActive);
  } catch (e: any) {
    console.error(e);
    error.value = 'No se pudieron cargar las áreas.';
  } finally {
    isLoadingAreas.value = false;
  }
}

/* ===========================
   SUBMIT
=========================== */
async function submit() {
  error.value = null;

  const jwt = (token.value ?? '').trim();
  if (!jwt) {
    error.value = 'No hay token JWT.';
    return;
  }

  if (!form.subject.trim() || !form.description.trim() || !form.area) {
    error.value = 'Asunto, área y descripción son obligatorios.';
    return;
  }

  isSubmitting.value = true;
  try {
    const fd = new FormData();
    fd.append('subject', form.subject.trim());
    fd.append('description', form.description.trim());
    fd.append('area', form.area); // 👈 nombre REAL desde BD
    files.value.forEach(f => fd.append('files', f));

    const res = await fetch(`${API_BASE}/tickets`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: fd,
    });

    if (!res.ok) throw new Error(`Error ${res.status} creando ticket`);

    router.push('/cliente');
  } catch (e: any) {
    console.error(e);
    error.value = e.message || 'No se pudo crear el ticket';
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(async () => {
  initAuth();
  await loadSupportAreas();
});
</script>

<template>
  <main class="min-h-screen bg-[#050b1a] text-white flex flex-col">
    <header class="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Nuevo ticket</h1>
        <p class="text-xs text-slate-400">
          Describe tu solicitud y adjunta archivos si hace falta.
        </p>
      </div>
      <button
        class="text-xs px-3 py-1 border border-slate-600 rounded hover:bg-slate-800"
        @click="router.push('/cliente')"
      >
        ← Volver a mis tickets
      </button>
    </header>

    <section class="flex-1 px-6 py-8">
      <div class="max-w-3xl mx-auto border border-slate-800 rounded-xl bg-slate-950/60 p-6">
        <div class="space-y-4">
          <div>
            <label class="text-xs text-slate-300 font-semibold">Asunto</label>
            <input
              v-model="form.subject"
              class="mt-1 w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: No tengo internet en mi puesto de trabajo"
            />
          </div>

          <div>
            <label class="text-xs text-slate-300 font-semibold">Área</label>
            <select
              v-model="form.area"
              class="mt-1 w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Selecciona un área</option>

              <option v-for="a in areas" :key="a.id" :value="a.name">
                {{ a.name }}
              </option>
            </select>

            <p class="text-[11px] text-slate-500 mt-1">
              Esta área se usa para dirigir tu ticket al equipo correcto.
            </p>
          </div>

          <div>
            <label class="text-xs text-slate-300 font-semibold">Descripción</label>
            <textarea
              v-model="form.description"
              rows="6"
              class="mt-1 w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Describe con el mayor detalle posible qué problema tienes o qué necesitas."
            />
          </div>

          <!-- ✅ Adjuntos -->
          <div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-slate-300 font-semibold">Adjuntos</label>
              <button
                type="button"
                class="text-xs px-3 py-1 rounded-md border border-slate-700 hover:bg-slate-800"
                @click="openPicker"
              >
                📎 Adjuntar
              </button>
            </div>

            <input ref="fileInput" type="file" multiple class="hidden" @change="onPickFiles" />

            <div
              class="mt-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm"
              :class="isDragging ? 'ring-2 ring-emerald-500/60' : ''"
              @dragenter="
                preventDefaults($event);
                isDragging = true;
              "
              @dragover="
                preventDefaults($event);
                isDragging = true;
              "
              @dragleave="
                preventDefaults($event);
                isDragging = false;
              "
              @drop="onDrop"
            >
              <p class="text-xs text-slate-400">
                Arrastra y suelta archivos aquí, o usa “Adjuntar”.
              </p>

              <ul v-if="files.length" class="mt-3 space-y-2">
                <li
                  v-for="(f, idx) in files"
                  :key="idx"
                  class="flex items-center justify-between gap-2 border border-slate-800 rounded-md px-3 py-2 bg-slate-950/40"
                >
                  <div class="truncate">
                    <p class="text-xs font-semibold truncate">{{ f.name }}</p>
                    <p class="text-[11px] text-slate-500">{{ Math.round(f.size / 1024) }} KB</p>
                  </div>
                  <button
                    type="button"
                    class="text-xs px-2 py-1 rounded bg-red-500 hover:bg-red-600"
                    @click="removeFile(idx)"
                  >
                    Quitar
                  </button>
                </li>
              </ul>

              <p v-else class="mt-2 text-[11px] text-slate-500">No hay archivos adjuntos.</p>
            </div>
          </div>

          <p v-if="error" class="text-sm text-rose-400">{{ error }}</p>

          <div class="flex justify-end">
            <button
              type="button"
              class="h-9 px-4 rounded-md bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold disabled:opacity-60"
              :disabled="isSubmitting"
              @click="submit"
            >
              {{ isSubmitting ? 'Creando...' : 'Crear ticket' }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
