import { computed, ref } from 'vue';

type ThemeMode = 'dark' | 'light';

const theme = ref<ThemeMode>('dark');

function applyTheme(mode: ThemeMode) {
  theme.value = mode;

  if (typeof window !== 'undefined') {
    localStorage.setItem('hd_theme', mode);

    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light');
    root.classList.add(mode === 'dark' ? 'theme-dark' : 'theme-light');
  }
}

function initTheme() {
  if (typeof window === 'undefined') return;

  const saved = localStorage.getItem('hd_theme') as ThemeMode | null;
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

function toggleTheme() {
  applyTheme(theme.value === 'dark' ? 'light' : 'dark');
}

const isDark = computed(() => theme.value === 'dark');
const isLight = computed(() => theme.value === 'light');

export function useTheme() {
  return {
    theme,
    isDark,
    isLight,
    initTheme,
    applyTheme,
    toggleTheme,
  };
}
