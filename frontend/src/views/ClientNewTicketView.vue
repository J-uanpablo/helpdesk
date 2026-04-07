<template>
  <div
    class="min-h-screen overflow-y-auto pb-12"
    :style="{ background: 'var(--bg-main)', color: 'var(--text-main)' }"
  >
    <main class="mx-auto max-w-7xl px-6 py-8">
      <div class="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold tracking-tight">Nuevo ticket</h1>
          <p class="mt-2 text-sm opacity-80" :style="{ color: 'var(--text-soft)' }">
            Selecciona un área y luego el tipo de soporte que necesitas.
          </p>
        </div>

        <button
          type="button"
          class="rounded-xl border px-5 py-2.5 text-sm font-medium transition-all hover:brightness-110 active:scale-95"
          :style="{
            background: 'var(--bg-panel)',
            borderColor: 'var(--border-main)',
            color: 'var(--text-main)',
          }"
          @click="goBack"
        >
          ← Volver a mis tickets
        </button>
      </div>

      <form @submit.prevent="submitTicket" class="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div class="space-y-6 pr-2 lg:col-span-12 xl:col-span-8">
          <!-- ÁREAS -->
          <div
            class="rounded-2xl border p-6 shadow-sm"
            :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
          >
            <div class="mb-6 flex items-center justify-between">
              <div>
                <h2 class="text-lg font-bold">1. Selecciona el área</h2>
                <p class="text-xs opacity-70">
                  Elige el área que más se relacione con tu necesidad.
                </p>
              </div>

              <div class="relative hidden sm:block">
                <input
                  v-model="areaSearch"
                  type="text"
                  placeholder="Buscar área..."
                  class="rounded-lg border bg-transparent px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  :style="{ borderColor: 'var(--border-main)' }"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              <button
                v-for="area in filteredSupportAreas"
                :key="`${area.id}-${area.value}`"
                type="button"
                @click="selectArea(area)"
                class="group relative flex min-h-[110px] flex-col items-center justify-center rounded-xl border p-4 transition-all hover:border-emerald-500/50 hover:shadow-md active:scale-95"
                :class="
                  form.area === area.value ? 'ring-2 ring-emerald-500 border-transparent' : ''
                "
                :style="{ background: 'var(--bg-soft)', borderColor: 'var(--border-main)' }"
              >
                <span class="mb-2 text-2xl transition-transform group-hover:scale-110">
                  {{ area.icon }}
                </span>
                <span class="text-center text-xs font-semibold leading-tight">
                  {{ area.label }}
                </span>

                <div
                  v-if="form.area === area.value"
                  class="absolute right-2 top-2 text-xs text-emerald-500"
                >
                  ●
                </div>
              </button>
            </div>
          </div>

          <!-- SOPORTES DEL ÁREA -->
          <div
            v-if="form.area"
            class="rounded-2xl border p-6 shadow-sm"
            :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
          >
            <div class="mb-6 flex items-center justify-between">
              <div>
                <h2 class="text-lg font-bold">2. Selecciona el tipo de soporte</h2>
                <p class="text-xs opacity-70">
                  Estos son los soportes disponibles para <b>{{ selectedAreaLabel }}</b
                  >.
                </p>
              </div>

              <div class="relative hidden sm:block">
                <input
                  v-model="supportSearch"
                  type="text"
                  placeholder="Buscar soporte..."
                  class="rounded-lg border bg-transparent px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  :style="{ borderColor: 'var(--border-main)' }"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <button
                v-for="support in filteredSupportsByArea"
                :key="support.label"
                type="button"
                @click="applySupportOption(support)"
                class="group relative rounded-xl border p-4 text-left transition-all hover:border-emerald-500/50 hover:shadow-md active:scale-95"
                :class="
                  selectedSupportLabel === support.label
                    ? 'ring-2 ring-emerald-500 border-transparent'
                    : ''
                "
                :style="{ background: 'var(--bg-soft)', borderColor: 'var(--border-main)' }"
              >
                <div class="mb-2 flex items-start gap-3">
                  <span class="text-2xl">{{ support.icon }}</span>
                  <div class="min-w-0">
                    <p class="text-sm font-semibold leading-tight">{{ support.label }}</p>
                    <p class="mt-1 text-xs opacity-70">
                      {{ support.help }}
                    </p>
                  </div>
                </div>

                <div
                  v-if="selectedSupportLabel === support.label"
                  class="absolute right-2 top-2 text-xs text-emerald-500"
                >
                  ●
                </div>
              </button>
            </div>

            <p
              v-if="!filteredSupportsByArea.length"
              class="mt-4 text-sm"
              :style="{ color: 'var(--text-soft)' }"
            >
              No se encontraron tipos de soporte para esta búsqueda.
            </p>
          </div>
        </div>

        <!-- PANEL DERECHO -->
        <div class="space-y-6 lg:col-span-12 xl:col-span-4">
          <div
            class="rounded-2xl border p-6 shadow-sm"
            :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
          >
            <h2 class="mb-4 text-lg font-bold">Detalles del ticket</h2>

            <div class="space-y-4">
              <div>
                <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider opacity-70">
                  Asunto
                </label>
                <input
                  v-model="form.subject"
                  type="text"
                  class="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  :style="inputStyle"
                  placeholder="Resumen del problema"
                />
              </div>

              <div
                v-if="form.area"
                class="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3"
              >
                <p class="text-[10px] font-bold uppercase text-emerald-600">Área seleccionada</p>
                <p class="text-sm font-medium">{{ selectedAreaLabel }}</p>
                <p
                  v-if="areaDescriptions[form.area]"
                  class="mt-1 text-xs"
                  :style="{ color: 'var(--text-soft)' }"
                >
                  {{ areaDescriptions[form.area] }}
                </p>
              </div>

              <div
                v-if="selectedSupportLabel"
                class="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3"
              >
                <p class="text-[10px] font-bold uppercase text-sky-600">Soporte seleccionado</p>
                <p class="text-sm font-medium">{{ selectedSupportLabel }}</p>
              </div>

              <div>
                <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider opacity-70">
                  Descripción
                </label>
                <textarea
                  v-model="form.description"
                  rows="6"
                  class="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  :style="inputStyle"
                  placeholder="Describe qué sucede..."
                ></textarea>
              </div>

              <div>
                <div class="mb-2 flex items-center justify-between">
                  <label class="text-xs font-bold uppercase tracking-wider opacity-70">
                    Evidencias
                  </label>
                  <label
                    class="cursor-pointer text-[11px] font-bold text-emerald-600 hover:underline"
                  >
                    + AÑADIR ARCHIVOS
                    <input type="file" multiple class="hidden" @change="handleFileChange" />
                  </label>
                </div>

                <div
                  class="rounded-xl border-2 border-dashed p-4 text-center transition-colors"
                  :style="{ borderColor: 'var(--border-main)', background: 'var(--bg-soft)' }"
                >
                  <div v-if="!files.length" class="text-[11px] opacity-60">
                    Suelte capturas o documentos aquí
                  </div>

                  <div v-else class="space-y-2">
                    <div
                      v-for="(file, i) in files"
                      :key="`${file.name}-${i}`"
                      class="flex items-center justify-between rounded bg-white/5 p-1 text-[11px]"
                    >
                      <span class="max-w-[120px] truncate">{{ file.name }}</span>
                      <button type="button" @click="removeFile(i)" class="font-bold text-red-500">
                        X
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-if="error"
                class="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-600"
              >
                {{ error }}
              </div>

              <div class="pt-4">
                <button
                  type="submit"
                  class="w-full rounded-xl py-4 text-sm font-bold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                  style="background: #10b981"
                  :disabled="isSubmitting || !form.area"
                >
                  {{ isSubmitting ? 'PROCESANDO...' : 'ENVIAR TICKET' }}
                </button>

                <button
                  type="button"
                  @click="goBack"
                  class="mt-3 w-full text-xs font-medium opacity-60 hover:opacity-100"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </main>

    <!-- MODAL TICKET CREADO -->
    <div
      v-if="showSuccessModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        class="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        :style="{ background: 'var(--bg-panel)', borderColor: 'var(--border-main)' }"
      >
        <div class="flex items-start gap-3">
          <div
            class="flex h-12 w-12 items-center justify-center rounded-full"
            style="background: rgba(16, 185, 129, 0.12); color: #10b981"
          >
            <span class="text-2xl">✓</span>
          </div>

          <div class="flex-1">
            <h2 class="text-lg font-bold">Ticket creado correctamente</h2>
            <p class="mt-1 text-sm" :style="{ color: 'var(--text-soft)' }">
              Tu solicitud fue registrada exitosamente.
            </p>
          </div>
        </div>

        <div
          class="mt-5 rounded-xl border p-4"
          :style="{ background: 'var(--bg-soft)', borderColor: 'var(--border-main)' }"
        >
          <p class="text-[11px] font-bold uppercase tracking-wider" style="color: #10b981">
            Número de ticket
          </p>
          <p class="mt-1 text-2xl font-extrabold">#{{ createdTicketId }}</p>
        </div>

        <div class="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            class="rounded-xl border px-4 py-2 text-sm font-medium transition hover:bg-black/5"
            :style="{
              background: 'var(--bg-soft)',
              borderColor: 'var(--border-main)',
              color: 'var(--text-main)',
            }"
            @click="showSuccessModal = false"
          >
            Cerrar
          </button>

          <button
            type="button"
            class="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            style="background: #10b981"
            @click="goToCreatedTicketChat"
          >
            Ir al chat del ticket
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { apiFetch } from '../lib/api';

type AreaValue = string;

interface SupportAreaItem {
  id: number;
  value: string;
  label: string;
  icon: string;
  backendValue: string;
}

interface SupportOption {
  label: string;
  icon: string;
  help: string;
  subject: string;
  description: string;
}

const router = useRouter();

const form = reactive({
  subject: '',
  area: '' as AreaValue,
  backendArea: '' as AreaValue,
  description: '',
  supportAreaId: null as number | null,
});

const files = ref<File[]>([]);
const error = ref('');
const isSubmitting = ref(false);
const areaSearch = ref('');
const supportSearch = ref('');
const selectedSupportLabel = ref('');

const showSuccessModal = ref(false);
const createdTicketId = ref<number | null>(null);

const supportAreas = ref<SupportAreaItem[]>([]);

function getAreaIcon(name: string) {
  const n = String(name || '')
    .trim()
    .toUpperCase();

  if (n.includes('DIALISOFT')) return '🖥️';
  if (n.includes('WEBMASTER')) return '🌍';
  if (n.includes('HARDWARE')) return '💻';
  if (n.includes('SIESA') || n.includes('ERP')) return '📊';
  if (n.includes('REDES') || n.includes('INTERNET')) return '🌐';
  if (n.includes('CIBERSEGURIDAD')) return '🛡️';
  if (n.includes('NETWORKING') || n.includes('SERVIDORES')) return '🖧';
  if (n.includes('COMPRAS')) return '🛒';

  return '🧩';
}

async function loadSupportAreas() {
  try {
    const res = await apiFetch('http://localhost:3000/support-areas');

    if (!res.ok) {
      throw new Error('No se pudieron cargar las áreas de soporte');
    }

    const data = await res.json();
    const activeAreas = (Array.isArray(data) ? data : []).filter((area: any) => area.isActive);

    const mappedAreas: SupportAreaItem[] = [];

    activeAreas.forEach((area: any) => {
      const rawName = String(area.name || '').trim();
      const backendName = rawName.toUpperCase();

      if (backendName === 'CIBERSEGURIDAD, NETWORKING Y SERVIDORES') {
        mappedAreas.push(
          {
            id: area.id,
            value: 'CIBERSEGURIDAD',
            label: 'CIBERSEGURIDAD',
            icon: '🛡️',
            backendValue: backendName,
          },
          {
            id: area.id,
            value: 'NETWORKING Y SERVIDORES',
            label: 'NETWORKING Y SERVIDORES',
            icon: '🖧',
            backendValue: backendName,
          }
        );
      } else {
        mappedAreas.push({
          id: area.id,
          value: backendName,
          label: rawName,
          icon: getAreaIcon(rawName),
          backendValue: backendName,
        });
      }
    });

    supportAreas.value = mappedAreas;
  } catch (err) {
    console.error(err);
    error.value = 'No se pudieron cargar las áreas de soporte.';
  }
}

onMounted(() => {
  loadSupportAreas();
});

const areaDescriptions: Record<string, string> = {
  'APLICATIVO DIALISOFT': 'Soporte funcional y técnico relacionado con el aplicativo Dialisoft.',
  WEBMASTER: 'Correo corporativo, página web, Moodle, e-learning, formularios e integraciones web.',
  HARDWARE: 'Computadores, impresoras, periféricos, lentitud del equipo o fallas físicas.',
  'SOFTWARE ERP (SIESA)':
    'Soporte relacionado con SIESA ERP, errores, bloqueos, acceso o funcionamiento.',
  'REDES E INTERNET': 'Internet, WiFi, VPN, conectividad, carpetas compartidas y recursos de red.',
  CIBERSEGURIDAD:
    'Incidentes de seguridad, antivirus, accesos sospechosos, phishing y protección de la información.',
  'NETWORKING Y SERVIDORES':
    'Conectividad interna, servidores, servicios de red, infraestructura y disponibilidad.',
  COMPRAS: 'Solicitudes asociadas a adquisiciones, requerimientos y gestión del área de compras.',
};

const supportOptionsByArea: Record<string, SupportOption[]> = {
  CIBERSEGURIDAD: [
    {
      label: 'Correo malicioso o phishing',
      icon: '📧',
      help: 'Análisis y mitigación de correos sospechosos o intentos de phishing.',
      subject: 'Reporto correo malicioso o phishing',
      description:
        'He recibido un correo sospechoso, malicioso o posible intento de phishing y requiero análisis y mitigación.',
    },
    {
      label: 'Antivirus y alertas de seguridad',
      icon: '🛡️',
      help: 'Instalación, soporte y revisión de alertas de antivirus o amenazas detectadas.',
      subject: 'Soporte de antivirus o alertas de seguridad',
      description:
        'Requiero soporte sobre antivirus, alertas de seguridad o revisión de amenazas detectadas en el equipo.',
    },
    {
      label: 'Auditoría de logs',
      icon: '📜',
      help: 'Revisión de eventos, registros e incidentes de seguridad.',
      subject: 'Solicitud de auditoría de logs',
      description:
        'Requiero revisión de eventos y registros de seguridad para validar incidentes o comportamiento sospechoso.',
    },
    {
      label: 'Auditoría de aplicaciones y dispositivos',
      icon: '🔍',
      help: 'Evaluación de seguridad en aplicaciones, equipos o dispositivos.',
      subject: 'Solicitud de auditoría de aplicaciones o dispositivos',
      description:
        'Requiero evaluación de seguridad sobre aplicaciones, equipos o dispositivos ante riesgos detectados.',
    },
    {
      label: 'Automatización de procesos',
      icon: '⚙️',
      help: 'Scripts, flujos automáticos e integraciones para optimización operativa.',
      subject: 'Solicitud de automatización de procesos',
      description:
        'Requiero desarrollo o ajuste de automatizaciones, scripts o flujos para optimizar procesos operativos.',
    },
    {
      label: 'Mantenimiento de bases de datos y servidores',
      icon: '🗄️',
      help: 'Parches, optimización, hardening y mantenimiento de infraestructura.',
      subject: 'Mantenimiento de bases de datos y servidores',
      description:
        'Requiero mantenimiento, optimización, hardening o revisión de bases de datos y servidores.',
    },
    {
      label: 'Mantenimiento de redes',
      icon: '🖧',
      help: 'Revisión de seguridad de red y validación de vulnerabilidades.',
      subject: 'Mantenimiento o revisión de seguridad de red',
      description:
        'Requiero revisión, mantenimiento o validación de seguridad sobre la infraestructura de red.',
    },
    {
      label: 'Integraciones con servidores o sistemas externos',
      icon: '🔗',
      help: 'Integración con APIs, monitoreo o sistemas externos.',
      subject: 'Solicitud de integración con servidores o sistemas externos',
      description:
        'Requiero soporte para integración con APIs, sistemas externos, monitoreo o servicios conectados.',
    },
    {
      label: 'Administración de Azure',
      icon: '☁️',
      help: 'Administración de recursos, máquinas virtuales y respaldos en Azure.',
      subject: 'Soporte o administración en Azure',
      description:
        'Requiero soporte para administración de recursos en Azure, incluyendo máquinas virtuales y backups.',
    },
    {
      label: 'Administración de AWS',
      icon: '☁️',
      help: 'Administración de servicios en AWS, EC2 y almacenamiento.',
      subject: 'Soporte o administración en AWS',
      description:
        'Requiero soporte para administración de servicios en AWS, incluyendo EC2 y almacenamiento.',
    },
    {
      label: 'Replicaciones en la nube',
      icon: '🔁',
      help: 'Replicación y respaldo de información en entornos cloud.',
      subject: 'Solicitud de replicación en la nube',
      description: 'Requiero soporte para replicación o respaldo de información en la nube.',
    },
    {
      label: 'Actualización de parches',
      icon: '🧩',
      help: 'Aplicación de parches y actualización de servidores o componentes.',
      subject: 'Solicitud de actualización de parches',
      description:
        'Requiero actualización de parches de seguridad o mantenimiento sobre servidores y componentes.',
    },
    {
      label: 'Otros',
      icon: '📌',
      help: 'Solicitudes no clasificadas.',
      subject: 'Otra solicitud para Webmaster',
      description: 'Tengo una solicitud que no se encuentra en las categorías anteriores.',
    },
  ],

  'NETWORKING Y SERVIDORES': [
    {
      label: 'Sin conexión en sede',
      icon: '🌐',
      help: 'Caída total de internet o enlace caído en una sede.',
      subject: 'Sin conexión en sede',
      description: 'La sede presenta caída total de internet o pérdida general de conectividad.',
    },
    {
      label: 'Sin conexión en mi equipo',
      icon: '🖧',
      help: 'Problemas de red cableada o WiFi en un equipo específico.',
      subject: 'Sin conexión en mi equipo',
      description:
        'Mi equipo no tiene conexión de red, presenta IP inválida o no accede a internet.',
    },
    {
      label: 'Lentitud de red o internet',
      icon: '🐢',
      help: 'Internet lento, alta latencia o saturación de tráfico.',
      subject: 'Lentitud de red o internet',
      description:
        'La conexión presenta lentitud, alta latencia o fallas de tráfico en la sede o equipo.',
    },
    {
      label: 'Acceso VPN',
      icon: '🔒',
      help: 'Creación, cambio o validación de credenciales y acceso VPN.',
      subject: 'Problema o solicitud de acceso VPN',
      description:
        'Requiero creación, validación o soporte sobre acceso VPN y credenciales asociadas.',
    },
    {
      label: 'Acceso a servicios internos',
      icon: '🧩',
      help: 'Acceso a servidores, aplicaciones o servicios internos por VPN o red.',
      subject: 'Problema con acceso a servicios internos',
      description:
        'No puedo acceder a servidores, aplicaciones o servicios internos de la organización.',
    },
    {
      label: 'Páginas o aplicaciones bloqueadas',
      icon: '🚫',
      help: 'Sitios web, apps o contenidos restringidos que no cargan o requieren habilitación.',
      subject: 'Solicitud o problema con páginas o aplicaciones bloqueadas',
      description:
        'No puedo acceder a una página, aplicación o contenido restringido y requiero validación o habilitación.',
    },
    {
      label: 'Credenciales de carpetas compartidas',
      icon: '🔑',
      help: 'Creación, autenticación, cambio o desbloqueo de acceso a carpetas compartidas.',
      subject: 'Gestión de credenciales para carpetas compartidas',
      description:
        'Requiero creación, autenticación, cambio o desbloqueo de credenciales para carpetas compartidas.',
    },
    {
      label: 'Permisos a carpetas compartidas',
      icon: '📁',
      help: 'Acceso, permisos o asignación sobre carpetas de red.',
      subject: 'Problema o solicitud de permisos en carpetas compartidas',
      description:
        'No puedo acceder a carpetas compartidas o requiero ajuste de permisos sobre recursos de red.',
    },
    {
      label: 'Creación de carpetas compartidas',
      icon: '🗂️',
      help: 'Creación de nuevas carpetas con permisos estandarizados.',
      subject: 'Solicitud de creación de carpeta compartida',
      description:
        'Requiero la creación de una nueva carpeta compartida con permisos estandarizados.',
    },
    {
      label: 'Compartir información segura',
      icon: '📨',
      help: 'Intercambio seguro de información con terceros o entidades externas.',
      subject: 'Solicitud para compartir información segura',
      description:
        'Requiero habilitar o gestionar un mecanismo seguro para compartir información con terceros.',
    },
    {
      label: 'Replicación a Google Drive',
      icon: '☁️',
      help: 'Sincronización o replicación de información hacia Google Drive.',
      subject: 'Solicitud de replicación a Google Drive',
      description:
        'Requiero sincronización o replicación de información institucional hacia Google Drive.',
    },
    {
      label: 'Creación de servidor o servicio',
      icon: '🖥️',
      help: 'Aprovisionamiento de servidores físicos, virtuales o publicación de servicios.',
      subject: 'Solicitud de creación de servidor o servicio',
      description:
        'Requiero aprovisionamiento de un servidor nuevo o la creación/publicación de un servicio.',
    },
    {
      label: 'Replicación o alta disponibilidad',
      icon: '🔁',
      help: 'Configuración de réplicas, continuidad operativa o alta disponibilidad.',
      subject: 'Solicitud de replicación o alta disponibilidad',
      description:
        'Requiero configuración de réplicas o mecanismos de alta disponibilidad para continuidad operativa.',
    },
    {
      label: 'Restauración de información',
      icon: '♻️',
      help: 'Recuperación de carpetas, archivos o información eliminada.',
      subject: 'Solicitud de restauración de información',
      description: 'Requiero recuperar carpetas, archivos o información eliminada accidentalmente.',
    },
    {
      label: 'Restauración de servidor o máquina',
      icon: '🛠️',
      help: 'Recuperación de servidores o máquinas completas por fallas críticas.',
      subject: 'Solicitud de restauración de servidor o máquina',
      description:
        'Se requiere recuperación de un servidor o máquina completa por falla crítica o incidente mayor.',
    },
    {
      label: 'Otros',
      icon: '📌',
      help: 'Solicitudes no clasificadas.',
      subject: 'Otra solicitud para Webmaster',
      description: 'Tengo una solicitud que no se encuentra en las categorías anteriores.',
    },
  ],

  'APLICATIVO DIALISOFT': [
    {
      label: 'Creación de empresas',
      icon: '🏢',
      help: 'Configuración y habilitación de nueva empresa en el sistema.',
      subject: 'Solicito creación de empresa en Dialisoft',
      description: 'Requiero la configuración y habilitación de una nueva empresa en Dialisoft.',
    },
    {
      label: 'Creación de sedes',
      icon: '📍',
      help: 'Parametrización de sedes y estructura organizacional.',
      subject: 'Solicito creación de sede en Dialisoft',
      description:
        'Requiero la parametrización de una nueva sede y su estructura organizacional en Dialisoft.',
    },
    {
      label: 'Creación de usuarios',
      icon: '👤',
      help: 'Registro y activación de usuarios nuevos en el sistema.',
      subject: 'Solicito creación de usuario en Dialisoft',
      description: 'Requiero el registro y activación de un nuevo usuario en Dialisoft.',
    },
    {
      label: 'Perfiles y usuarios',
      icon: '🔐',
      help: 'Configuración de perfiles y acceso según rol.',
      subject: 'Solicito parametrización de perfiles y usuarios en Dialisoft',
      description:
        'Requiero la configuración de perfiles, permisos y accesos según el rol del usuario en Dialisoft.',
    },
    {
      label: 'Parametrización de permisos',
      icon: '🛡️',
      help: 'Asignación y ajuste de permisos de acceso.',
      subject: 'Solicito parametrización de permisos en Dialisoft',
      description:
        'Requiero la parametrización o ajuste de permisos de acceso dentro de Dialisoft.',
    },
    {
      label: 'Asignación de roles y accesos',
      icon: '🧩',
      help: 'Asignación de roles y accesos a funcionalidades del sistema.',
      subject: 'Solicito asignación de roles y accesos en Dialisoft',
      description: 'Requiero asignar o modificar roles y accesos de usuario dentro de Dialisoft.',
    },
    {
      label: 'Cambios de cargo',
      icon: '🔄',
      help: 'Actualización de cargo del usuario en el sistema.',
      subject: 'Solicito cambio de cargo en Dialisoft',
      description: 'Requiero actualizar el cargo de un usuario dentro de Dialisoft.',
    },
    {
      label: 'Parametrización contable',
      icon: '💰',
      help: 'Ajuste de estructura contable y contabilización.',
      subject: 'Solicito parametrización contable en Dialisoft',
      description:
        'Requiero soporte para parametrización contable, ajustes de cuentas o contabilización en Dialisoft.',
    },
    {
      label: 'Soporte funcional',
      icon: '🧠',
      help: 'Acompañamiento en módulos y asistencia funcional del aplicativo.',
      subject: 'Solicito soporte funcional en Dialisoft',
      description:
        'Requiero acompañamiento o soporte funcional sobre módulos, uso o procesos dentro de Dialisoft.',
    },
    {
      label: 'Gestión de incidencias',
      icon: '🚨',
      help: 'Atención de errores, incidencias y validación de reportes.',
      subject: 'Reporto incidencia en Dialisoft',
      description:
        'Dialisoft presenta una incidencia, error o falla que requiere revisión y validación.',
    },
    {
      label: 'Capacitación al personal',
      icon: '🎓',
      help: 'Formación inicial y refuerzo en módulos del sistema.',
      subject: 'Solicito capacitación en Dialisoft',
      description: 'Requiero capacitación inicial o refuerzo sobre el uso de módulos en Dialisoft.',
    },
    {
      label: 'Otros',
      icon: '📌',
      help: 'Solicitudes no clasificadas.',
      subject: 'Otra solicitud para Webmaster',
      description: 'Tengo una solicitud que no se encuentra en las categorías anteriores.',
    },
  ],

  WEBMASTER: [
    {
      label: 'Problemas con correo',
      icon: '✉️',
      help: 'No envía, no recibe o no permite acceder al correo.',
      subject: 'Tengo problemas con mi correo electrónico',
      description: 'No puedo enviar, recibir o acceder a mi correo electrónico.',
    },
    {
      label: 'Crear un nuevo correo',
      icon: '📨',
      help: 'Solicitud de creación de cuenta de correo corporativo.',
      subject: 'Solicito la creación de un nuevo correo corporativo',
      description: 'Requiero la creación de una nueva cuenta de correo corporativo.',
    },
    {
      label: 'Credenciales de correo',
      icon: '🔐',
      help: 'Recuperación o cambio de contraseña.',
      subject: 'Solicito credenciales de mi correo',
      description: 'Necesito recuperar o cambiar la contraseña de mi correo.',
    },
    {
      label: 'Eliminar o desactivar correo',
      icon: '❌',
      help: 'Desactivación o eliminación de cuentas.',
      subject: 'Solicito eliminar o desactivar un correo',
      description: 'Requiero eliminar o desactivar una cuenta de correo.',
    },
    {
      label: 'Cambiar o agregar firma de correo',
      icon: '🖋️',
      help: 'Actualizar o crear firma institucional en el correo.',
      subject: 'Solicito cambio o creación de firma de correo',
      description: 'Necesito actualizar o agregar la firma institucional en mi correo.',
    },
    {
      label: 'Solicitud base de datos de correos',
      icon: '📊',
      help: 'Listado o exportación de correos corporativos.',
      subject: 'Solicito base de datos de correos',
      description: 'Requiero la base de datos o listado de correos electrónicos.',
    },
    {
      label: 'Plataforma de e-learning',
      icon: '📚',
      help: 'Fallos en la plataforma de formación.',
      subject: 'Tengo problemas con la plataforma de e-learning',
      description: 'No puedo acceder o usar correctamente la plataforma de e-learning.',
    },
    {
      label: 'Crear usuario e-learning',
      icon: '👤',
      help: 'Registro de nuevos usuarios en la plataforma.',
      subject: 'Solicito creación de usuario en e-learning',
      description: 'Requiero la creación de un usuario en la plataforma de e-learning.',
    },
    {
      label: 'Capacitación e-learning',
      icon: '🎓',
      help: 'Solicitudes de formación o inducción.',
      subject: 'Solicito capacitación en la plataforma de e-learning',
      description: 'Necesito capacitación para el uso de la plataforma.',
    },
    {
      label: 'Problemas con página web',
      icon: '🌍',
      help: 'Sitio web caído, lento o con errores.',
      subject: 'Tengo problemas con la página web',
      description: 'La página web presenta errores, lentitud o no carga correctamente.',
    },
    {
      label: 'Actualización de página web',
      icon: '🛠️',
      help: 'Cambios de contenido, imágenes o secciones.',
      subject: 'Solicito actualización de la página web',
      description: 'Necesito realizar cambios o actualizaciones en la página web.',
    },
    {
      label: 'Facturación TIC',
      icon: '💳',
      help: 'Pagos, facturas o plataformas tecnológicas.',
      subject: 'Consulta sobre facturación de plataformas TIC',
      description: 'Tengo dudas o solicitudes relacionadas con facturación de servicios TIC.',
    },
    {
      label: 'Otros',
      icon: '📌',
      help: 'Solicitudes no clasificadas.',
      subject: 'Otra solicitud para Webmaster',
      description: 'Tengo una solicitud que no se encuentra en las categorías anteriores.',
    },
  ],

  HARDWARE: [
    {
      label: 'Problemas con impresoras',
      icon: '🖨️',
      help: 'Fallas al imprimir, escanear o atascos de papel.',
      subject: 'Problema con impresora',
      description:
        'La impresora no imprime, presenta atascos, problemas de conexión o fallas en escaneo.',
    },
    {
      label: 'Instalación o configuración de impresoras',
      icon: '📠',
      help: 'Instalación de impresoras o configuración en red.',
      subject: 'Instalación o configuración de impresora',
      description: 'Se requiere instalar o configurar una impresora láser o de inyección.',
    },
    {
      label: 'Mantenimiento de impresoras',
      icon: '🧰',
      help: 'Cambio o recarga de tóner y revisión.',
      subject: 'Mantenimiento de impresora',
      description: 'Se requiere mantenimiento preventivo o correctivo de la impresora.',
    },
    {
      label: 'Problemas con periféricos',
      icon: '⌨️',
      help: 'Fallas con teclado, mouse, diademas o monitores.',
      subject: 'Falla en periféricos',
      description: 'Uno o varios periféricos presentan fallas y afectan el trabajo.',
    },
    {
      label: 'Equipo lento o bloqueado',
      icon: '💻',
      help: 'El equipo está lento o no responde.',
      subject: 'Equipo lento o bloqueado',
      description: 'El equipo presenta lentitud o se bloquea constantemente.',
    },
    {
      label: 'Problemas de audio, cámara o micrófono',
      icon: '🎧',
      help: 'No funcionan dispositivos multimedia.',
      subject: 'Falla en audio o cámara',
      description: 'El micrófono, cámara o sonido no funcionan correctamente.',
    },
    {
      label: 'Instalación de software',
      icon: '📦',
      help: 'Instalación de programas como Office, PDF o diseño.',
      subject: 'Instalación de software',
      description: 'Se requiere instalar o configurar software en el equipo.',
    },
    {
      label: 'Activación de licencias',
      icon: '🔑',
      help: 'Activación de Windows, Office u otros programas.',
      subject: 'Activación de licencia',
      description: 'Se requiere activar licencias de software.',
    },
    {
      label: 'Problemas de red o internet',
      icon: '🌐',
      help: 'Fallas de conexión o acceso a internet.',
      subject: 'Problema de red o internet',
      description: 'El equipo no se conecta a la red o presenta fallas de navegación.',
    },
    {
      label: 'Carpetas compartidas',
      icon: '📁',
      help: 'Acceso o creación de carpetas en red.',
      subject: 'Gestión de carpetas compartidas',
      description: 'Se requiere crear, configurar o acceder a carpetas compartidas.',
    },
    {
      label: 'Copias de seguridad',
      icon: '💾',
      help: 'Respaldo de información.',
      subject: 'Solicitud de copia de seguridad',
      description: 'Se requiere realizar copia de seguridad de la información.',
    },
    {
      label: 'Cámaras o vigilancia',
      icon: '📷',
      help: 'Problemas con cámaras o grabaciones.',
      subject: 'Problema con cámaras de seguridad',
      description: 'Las cámaras no funcionan, no graban o presentan fallas de conexión.',
    },
    {
      label: 'Dispositivos biométricos',
      icon: '🧬',
      help: 'Configuración o fallas en relojes biométricos.',
      subject: 'Soporte dispositivo biométrico',
      description: 'Se requiere configuración, registro o revisión del biométrico.',
    },
    {
      label: 'Préstamo de equipos',
      icon: '📋',
      help: 'Solicitud de portátiles, periféricos o videobeam.',
      subject: 'Solicitud de préstamo de equipo',
      description: 'Se requiere préstamo de equipos tecnológicos.',
    },
    {
      label: 'Reubicación de equipos',
      icon: '🚚',
      help: 'Traslado de equipos de un lugar a otro.',
      subject: 'Reubicación de equipos',
      description: 'Se requiere trasladar equipos de cómputo o periféricos.',
    },
    {
      label: 'Infraestructura',
      icon: '🏢',
      help: 'UPS, iluminación u otros elementos físicos.',
      subject: 'Solicitud de infraestructura',
      description: 'Se requiere revisión o instalación de elementos de infraestructura.',
    },
    {
      label: 'Otros',
      icon: '📌',
      help: 'Solicitudes no clasificadas.',
      subject: 'Otra solicitud de soporte',
      description: 'Tengo una solicitud que no se encuentra en las categorías anteriores.',
    },
  ],

  'SOFTWARE ERP (SIESA)': [
    {
      label: 'Conciliación de módulos',
      icon: '📊',
      help: 'Validación de inconsistencias contables y movimientos.',
      subject: 'Conciliación de módulos en SIESA',
      description:
        'Se presentan diferencias en conciliación de módulos o inconsistencias contables que afectan el cierre.',
    },
    {
      label: 'Asociación de servicios en facturación',
      icon: '🧾',
      help: 'Revisión de cuentas y configuración del servicio.',
      subject: 'Problema en facturación electrónica SIESA',
      description: 'Se presentan errores en facturación electrónica o asociación de servicios.',
    },
    {
      label: 'Errores en documentos electrónicos',
      icon: '⚠️',
      help: 'Validación de resoluciones y DIAN.',
      subject: 'Errores en documentos electrónicos SIESA',
      description: 'Se presentan errores en documentos electrónicos o validación ante la DIAN.',
    },
    {
      label: 'Elaboración de documentos',
      icon: '📄',
      help: 'Entradas, salidas, traslados y requisiciones.',
      subject: 'Problemas en elaboración de documentos SIESA',
      description: 'Se presentan dificultades operativas al generar documentos en inventarios.',
    },
    {
      label: 'Diferencias en costo promedio',
      icon: '💰',
      help: 'Validación de costos y malas prácticas operativas.',
      subject: 'Diferencias en costo promedio SIESA',
      description: 'Se evidencian diferencias en el costo promedio de inventarios.',
    },
    {
      label: 'Carga de archivos planos',
      icon: '📂',
      help: 'Errores en estructura o generación de archivos.',
      subject: 'Error al cargar archivos planos en SIESA',
      description: 'Se presentan errores en la carga o estructura de archivos planos.',
    },
    {
      label: 'POS no inicia',
      icon: '🖥️',
      help: 'Validación de IP, MAC y conexión a servidor.',
      subject: 'POS no inicia en SIESA',
      description: 'El sistema POS no inicia correctamente o no conecta al servidor.',
    },
    {
      label: 'Error acumulación diaria',
      icon: '📉',
      help: 'Problemas en cierre diario de ventas.',
      subject: 'Error en acumulación diaria SIESA',
      description: 'Se presentan errores en la acumulación diaria de ventas.',
    },
    {
      label: 'Diferencias en caja',
      icon: '💵',
      help: 'Inconsistencias en efectivo y cierres.',
      subject: 'Diferencias en caja SIESA',
      description: 'Se presentan diferencias en caja durante el cierre.',
    },
    {
      label: 'Conceptos no liquidados',
      icon: '📑',
      help: 'Errores en liquidación de nómina.',
      subject: 'Conceptos no liquidados en nómina SIESA',
      description: 'Existen conceptos que no fueron liquidados correctamente en nómina.',
    },
    {
      label: 'Validación DIAN nómina',
      icon: '🏛️',
      help: 'Errores en validación electrónica.',
      subject: 'Error validación DIAN nómina electrónica',
      description: 'La nómina electrónica presenta errores en validación ante la DIAN.',
    },
    {
      label: 'Problemas envío de nómina',
      icon: '📤',
      help: 'Errores en envío o validación.',
      subject: 'Error envío nómina electrónica SIESA',
      description: 'Se presentan problemas en el envío o validación de la nómina electrónica.',
    },
    {
      label: 'Cambios contractuales',
      icon: '🔄',
      help: 'Actualización de contratos y prestaciones.',
      subject: 'Cambios contractuales en SIESA',
      description: 'Se requieren cambios en contratos, empleados o consolidación de prestaciones.',
    },
    {
      label: 'Permisos y usuarios',
      icon: '🔐',
      help: 'Creación, modificación y retiro de usuarios.',
      subject: 'Gestión de usuarios en SIESA',
      description: 'Se requiere crear, modificar o retirar usuarios en el sistema SIESA.',
    },
    {
      label: 'Habilitación de bodegas',
      icon: '🏬',
      help: 'Configuración de bodegas.',
      subject: 'Habilitación de bodegas en SIESA',
      description: 'Se requiere habilitar o configurar bodegas dentro del sistema.',
    },
    {
      label: 'Capacitación funcional',
      icon: '🎓',
      help: 'Formación en módulos ERP.',
      subject: 'Capacitación en SIESA',
      description: 'Se requiere capacitación funcional en módulos del ERP SIESA.',
    },
    {
      label: 'Implementación nueva empresa',
      icon: '🏢',
      help: 'Configuración completa de empresa.',
      subject: 'Implementación nueva empresa en SIESA',
      description: 'Se requiere la configuración completa de una nueva empresa en SIESA.',
    },
    {
      label: 'Otros',
      icon: '📌',
      help: 'Solicitudes no clasificadas.',
      subject: 'Otra solicitud para Webmaster',
      description: 'Tengo una solicitud que no se encuentra en las categorías anteriores.',
    },
  ],
};

const filteredSupportAreas = computed(() => {
  const q = areaSearch.value.trim().toLowerCase();
  if (!q) return supportAreas.value;

  return supportAreas.value.filter(area => `${area.label} ${area.value}`.toLowerCase().includes(q));
});

const supportsBySelectedArea = computed(() => {
  if (!form.area) return [];
  return supportOptionsByArea[form.area] || [];
});

const filteredSupportsByArea = computed(() => {
  const q = supportSearch.value.trim().toLowerCase();
  if (!q) return supportsBySelectedArea.value;

  return supportsBySelectedArea.value.filter(option =>
    `${option.label} ${option.subject} ${option.description} ${option.help}`
      .toLowerCase()
      .includes(q)
  );
});

const inputStyle = computed(() => ({
  background: 'var(--input-bg)',
  borderColor: 'var(--border-main)',
  color: 'var(--text-main)',
}));

const selectedAreaLabel = computed(() => {
  return supportAreas.value.find(area => area.value === form.area)?.label || form.area || '';
});

function selectArea(area: SupportAreaItem) {
  if (form.area !== area.value) {
    selectedSupportLabel.value = '';
    form.subject = '';
    form.description = '';
    supportSearch.value = '';
  }

  form.area = area.value;
  form.backendArea = area.backendValue;
  form.supportAreaId = area.id;
}

function applySupportOption(option: SupportOption) {
  selectedSupportLabel.value = option.label;
  form.subject = option.subject;
  form.description = option.description;
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;

  files.value = [...files.value, ...Array.from(input.files)];
  input.value = '';
}

function removeFile(index: number) {
  files.value.splice(index, 1);
}

function goBack() {
  router.push({ name: 'cliente' });
}

function goToCreatedTicketChat() {
  if (!createdTicketId.value) return;

  showSuccessModal.value = false;
  router.push({
    name: 'cliente-chat',
    params: { id: createdTicketId.value },
  });
}

async function submitTicket() {
  error.value = '';

  if (!form.subject.trim()) {
    error.value = 'Debes ingresar un asunto.';
    return;
  }

  if (!form.description.trim()) {
    error.value = 'Debes escribir una descripción.';
    return;
  }

  if (!form.area) {
    error.value = 'Debes seleccionar un área.';
    return;
  }

  if (!form.supportAreaId) {
    error.value = 'No se pudo identificar el área seleccionada.';
    return;
  }

  isSubmitting.value = true;

  try {
    const formData = new FormData();
    formData.append('subject', form.subject.trim());
    formData.append('description', form.description.trim());
    formData.append('area', form.backendArea || form.area);
    formData.append('supportAreaId', String(form.supportAreaId));
    formData.append('requestedCategory', form.area);

    files.value.forEach(file => {
      formData.append('files', file);
    });

    const res = await apiFetch('http://localhost:3000/tickets', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || 'No se pudo crear el ticket.');
    }

    createdTicketId.value = Number(data?.id || 0) || null;
    showSuccessModal.value = true;

    form.subject = '';
    form.area = '';
    form.backendArea = '';
    form.description = '';
    form.supportAreaId = null;
    selectedSupportLabel.value = '';
    supportSearch.value = '';
    files.value = [];
  } catch (err: any) {
    error.value = err?.message || 'Ocurrió un error al crear el ticket.';
  } finally {
    isSubmitting.value = false;
  }
}
</script>
