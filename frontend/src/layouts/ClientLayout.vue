<!-- src/layouts/ClientLayout.vue -->
<template>
  <div class="h-full min-h-0 flex flex-col overflow-hidden">
    <AppHeader class="shrink-0" />
    <div class="flex-1 min-h-0 overflow-hidden">
      <router-view v-slot="{ Component }">
        <component :is="Component" class="h-full min-h-0 overflow-hidden" />
      </router-view>
    </div>
  </div>
</template>

<script setup lang="ts">
// import AppHeader from './AppHeader.vue';
</script>
