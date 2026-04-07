// src/composables/useNotificationSound.ts
import { ref } from 'vue';

export function useNotificationSound(src: string) {
  const audio = ref<HTMLAudioElement | null>(null);

  function init() {
    try {
      const a = new Audio(src);
      a.preload = 'auto';
      a.volume = 1;
      a.load();
      audio.value = a;
    } catch (e) {
      console.error('No se pudo inicializar audio:', e);
    }
  }

  function play() {
    const a = audio.value;
    if (!a) return;
    try {
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch {}
  }

  return { init, play };
}
