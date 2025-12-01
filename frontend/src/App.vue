<script setup lang="ts">
import HelpdeskPanel from "./views/HelpdeskPanel.vue";
</script>

<template>
  <HelpdeskPanel />
</template>

<style>
html,
body,
#app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}

#app {
  max-width: none !important;
  text-align: left !important;
}

body {
  background-color: #020617;
  color: #e5e7eb;
}

ul {
  list-style: none;
  padding-left: 0;
  margin: 0;
}
</style>
