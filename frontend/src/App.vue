<template>
  <div
    class="flex h-screen min-h-0 flex-col overflow-hidden"
    :style="{ background: 'var(--bg-main)', color: 'var(--text-main)' }"
  >
    <AppHeader v-if="showHeader" class="shrink-0" />

    <main class="min-h-0 flex-1 overflow-hidden">
      <RouterView class="h-full min-h-0 overflow-hidden" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppHeader from './layouts/AppHeader.vue';
import { useAuth } from './composables/useAuth';

const route = useRoute();
const { token } = useAuth();

const isAuthenticated = computed(() => !!(token.value || '').trim());

const showHeader = computed(() => {
  return route.meta?.hideHeader !== true && isAuthenticated.value;
});
</script>
