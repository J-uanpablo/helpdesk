<template>
  <button
    type="button"
    class="h-9 w-9 flex items-center justify-center rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700"
    title="Configuración"
    @click="go"
  >
    ⚙️
  </button>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
const router = useRouter();
function go() {
  router.push('/settings');
}
</script>
