<!-- src/App.vue -->
<script setup lang="ts">
import { onMounted } from "vue";
import { useAuth } from "./composables/useAuth";

import LoginView from "./views/LoginView.vue";
import HelpdeskPanel from "./views/HelpdeskPanel.vue";

const { token, initAuth } = useAuth();

onMounted(() => {
  initAuth();
});
</script>

<template>
  <!-- Si NO hay token, mostramos la pantalla de login -->
  <LoginView v-if="!token" />

  <!-- Si hay token, mostramos el panel de mesa de ayuda -->
  <HelpdeskPanel v-else />
</template>
