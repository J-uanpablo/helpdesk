import { ref } from 'vue';

type UiModal = 'reports' | 'settings';

const activeModal = ref<UiModal | null>(null);

export function useUiBus() {
  function open(modal: UiModal) {
    activeModal.value = modal;
  }
  function close() {
    activeModal.value = null;
  }
  return { activeModal, open, close };
}
