<!-- src/views/ClientNewTicketView.vue -->
<script setup lang="ts">
import { reactive, ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../composables/useAuth";

interface SupportArea {
  id: number;
  name: string;
  isActive: boolean;
}

const router = useRouter();
const { token, user, initAuth } = useAuth();

const form = reactive({
  subject: "",
  description: "",
  area: "", // aquí guardamos el nombre del área seleccionada
});

const isSubmitting = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

// áreas de soporte (desde backend)
const supportAreas = ref<SupportArea[]>([]);
const isLoadingAreas = ref(false);

const activeSupportAreas = computed(() =>
  supportAreas.value.filter((a) => a.isActive)
);

async function loadSupportAreas() {
  if (!token.value) return;
  isLoadingAreas.value = true;
  try {
    const res = await fetch("http://localhost:3000/support-areas", {
      headers: {
        Authorization: `Bearer ${token.value}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Error ${res.status} al cargar las áreas de soporte`);
    }

    const data = (await res.json()) as SupportArea[];
    supportAreas.value = data;
  } catch (e: any) {
    console.error(e);
    // no bloqueamos el formulario, pero mostramos algo si quieres:
    // error.value = e.message || "No se pudieron cargar las áreas";
  } finally {
    isLoadingAreas.value = false;
  }
}

const canSubmit = computed(() => {
  return (
    form.subject.trim().length > 0 &&
    form.description.trim().length > 0 &&
    form.area.trim().length > 0
  );
});

async function handleSubmit() {
  if (!token.value || !canSubmit.value) return;

  isSubmitting.value = true;
  error.value = null;
  success.value = null;

  try {
    const payload = {
      subject: form.subject.trim(),
      description: form.description.trim(),
      area: form.area.trim(), // nombre del área seleccionada
    };

    const res = await fetch("http://localhost:3000/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.value}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `Error ${res.status} al crear el ticket`);
    }

    const created = await res.json();
    success.value = `Ticket #${created.id} creado correctamente.`;
    // limpiar formulario
    form.subject = "";
    form.description = "";
    form.area = "";

    // opcional: redirigir a la lista
    // router.push({ name: "cliente" });
  } catch (e: any) {
    console.error(e);
    error.value = e.message || "No se pudo crear el ticket";
  } finally {
    isSubmitting.value = false;
  }
}

function goBackToMyTickets() {
  router.push({ name: "cliente" });
}

onMounted(async () => {
  initAuth();
  if (!token.value) {
    router.push({ name: "login" });
    return;
  }
  await loadSupportAreas();
});
</script>

<template>
  <main
    class="min-h-screen bg-[#050b1a] text-white flex flex-col items-center px-4 py-6"
  >
    <div class="w-full max-w-3xl">
      <header class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold">Nuevo ticket</h1>
          <p class="text-xs text-slate-400">
            Describe tu solicitud y selecciona el área correspondiente.
          </p>
        </div>

        <button
          type="button"
          class="px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-xs font-semibold"
          @click="goBackToMyTickets"
        >
          ← Volver a mis tickets
        </button>
      </header>

      <section
        class="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-xl"
      >
        <form class="space-y-4 text-sm" @submit.prevent="handleSubmit">
          <div class="space-y-1">
            <label class="block text-xs text-slate-300">Asunto</label>
            <input
              v-model="form.subject"
              type="text"
              class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: No tengo internet en mi puesto de trabajo"
            />
          </div>

          <div class="space-y-1">
            <label class="block text-xs text-slate-300">Área</label>
            <select
              v-model="form.area"
              class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              :disabled="isLoadingAreas"
            >
              <option value="">
                {{
                  isLoadingAreas ? "Cargando áreas..." : "Selecciona un área"
                }}
              </option>
              <option
                v-for="area in activeSupportAreas"
                :key="area.id"
                :value="area.name"
              >
                {{ area.name }}
              </option>
            </select>
            <p class="text-[11px] text-slate-500">
              Esta área se usará para dirigir tu ticket al equipo correcto.
            </p>
          </div>

          <div class="space-y-1">
            <label class="block text-xs text-slate-300">Descripción</label>
            <textarea
              v-model="form.description"
              rows="5"
              class="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
              placeholder="Describe con el mayor detalle posible qué problema tienes o qué necesitas."
            ></textarea>
          </div>

          <div class="space-y-2">
            <p v-if="error" class="text-xs text-rose-400">
              {{ error }}
            </p>
            <p v-if="success" class="text-xs text-emerald-400">
              {{ success }}
            </p>
          </div>

          <div class="flex justify-end">
            <button
              type="submit"
              class="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isSubmitting || !canSubmit"
            >
              {{ isSubmitting ? "Creando ticket..." : "Crear ticket" }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </main>
</template>
