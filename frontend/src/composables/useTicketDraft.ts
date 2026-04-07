// src/composables/useTicketDraft.ts
import type { Ref } from 'vue';

export function useTicketDraft(opts: {
  ticketId: number;
  messageRef: Ref<string>;
  filesRef: Ref<File[]>;
  storagePrefix: string;
}) {
  const { ticketId, messageRef, filesRef, storagePrefix } = opts;

  const memory = (globalThis as any).__ticketDraftMemoryHelpdeskClient ?? new Map<number, File[]>();
  (globalThis as any).__ticketDraftMemoryHelpdeskClient = memory;

  const key = `${storagePrefix}_draft_text_${ticketId}`;

  function loadDraft() {
    const savedText = localStorage.getItem(key);
    if (savedText != null && !messageRef.value.trim()) {
      messageRef.value = savedText;
    }

    const memFiles = memory.get(ticketId);
    if (memFiles?.length) filesRef.value = [...memFiles];
  }

  function saveDraft() {
    localStorage.setItem(key, messageRef.value ?? '');
    memory.set(ticketId, [...filesRef.value]);
  }

  function clearDraft() {
    localStorage.removeItem(key);
    memory.delete(ticketId);
  }

  return { loadDraft, saveDraft, clearDraft };
}
