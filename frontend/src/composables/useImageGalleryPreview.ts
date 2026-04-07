// src/composables/useImageGalleryPreview.ts
import type { Ref } from 'vue';
import { ref } from 'vue';

type GalleryItem = { id: number; url: string; name: string };

export function useImageGalleryPreview(opts: {
  messages: Ref<any[]>;
  isImage: (att: any) => boolean;
  fileUrl: (att: any) => string;
  download: (url: string, name: string) => Promise<void>;
}) {
  const { messages, isImage, fileUrl, download } = opts;

  const imagePreviewOpen = ref(false);
  const imagePreviewUrl = ref('');
  const imagePreviewName = ref('');

  const imageGallery = ref<GalleryItem[]>([]);
  const imageIndex = ref(0);
  const previewScale = ref(1);

  function buildGallery(): GalleryItem[] {
    const items: GalleryItem[] = [];
    const seen = new Set<number>();

    for (const msg of messages.value) {
      for (const att of msg.attachments || []) {
        if (!isImage(att) || seen.has(att.id)) continue;
        seen.add(att.id);
        items.push({ id: att.id, url: fileUrl(att), name: att.filename });
      }
    }
    return items;
  }

  function setPreviewByIndex(idx: number) {
    const item = imageGallery.value[idx];
    if (!item) return;
    imageIndex.value = idx;
    imagePreviewUrl.value = item.url;
    imagePreviewName.value = item.name;
  }

  function openImagePreview(att: any) {
    imageGallery.value = buildGallery();
    const idx = imageGallery.value.findIndex(i => i.id === att.id);

    previewScale.value = 1;
    imagePreviewOpen.value = true;
    setPreviewByIndex(idx >= 0 ? idx : 0);
  }

  function closeImagePreview() {
    imagePreviewOpen.value = false;
    imagePreviewUrl.value = '';
    imagePreviewName.value = '';
    imageGallery.value = [];
    imageIndex.value = 0;
    previewScale.value = 1;
  }

  function prevImage() {
    if (imageGallery.value.length <= 1) return;
    previewScale.value = 1;
    setPreviewByIndex(
      (imageIndex.value - 1 + imageGallery.value.length) % imageGallery.value.length
    );
  }

  function nextImage() {
    if (imageGallery.value.length <= 1) return;
    previewScale.value = 1;
    setPreviewByIndex((imageIndex.value + 1) % imageGallery.value.length);
  }

  function resetPreviewZoom() {
    previewScale.value = 1;
  }

  function onPreviewWheel(e: WheelEvent) {
    if (!imagePreviewOpen.value) return;
    e.preventDefault();
    const step = e.deltaY > 0 ? -0.1 : 0.1;
    const next = Math.min(5, Math.max(0.5, Number((previewScale.value + step).toFixed(2))));
    previewScale.value = next;
  }

  async function downloadImageFromPreview() {
    if (!imagePreviewUrl.value) return;
    await download(imagePreviewUrl.value, imagePreviewName.value || 'imagen');
  }

  return {
    imagePreviewOpen,
    imagePreviewUrl,
    imagePreviewName,
    imageGallery,
    imageIndex,
    previewScale,
    openImagePreview,
    closeImagePreview,
    prevImage,
    nextImage,
    resetPreviewZoom,
    onPreviewWheel,
    downloadImageFromPreview,
  };
}
