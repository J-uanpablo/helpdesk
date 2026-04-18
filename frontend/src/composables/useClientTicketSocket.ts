// src/composables/useClientTicketSocket.ts
import { computed, ref, type Ref } from 'vue';
import { io, type Socket } from 'socket.io-client';

interface Ticket {
  id: number;
  title?: string | null;
  subject?: string | null;
  status: string;
  area?: string | null;
  assignedToName?: string | null;
  assignedTo?: { name: string | null } | null;
  satisfaction?: { rating: number; comment?: string | null; createdAt: string } | null;
}

interface TicketAttachment {
  id: number;
  filename: string;
  path: string;
  mimeType?: string | null;
  size: number;
  createdAt: string;
}

interface TicketMessage {
  id: number;
  content: string;
  createdAt: string;
  senderId: number;
  senderName?: string | null;
  ticketId: number;
  attachments?: TicketAttachment[];
}

interface TicketQueueStatus {
  ticketId: number;
  area: string | null;
  status: string;
  queuePosition: number;
  waitingBefore: number;
  totalPendingInArea: number;
  canChat: boolean;
}

export function useClientTicketSocket(opts: {
  apiBase: string;
  ticketId: number;
  token: Ref<string | null | undefined>;
  user: Ref<any>;
}) {
  const { apiBase, ticketId, token, user } = opts;

  const ticket = ref<Ticket | null>(null);
  const messages = ref<TicketMessage[]>([]);
  const error = ref<string | null>(null);
  const isSending = ref(false);
  const showSatisfaction = ref(false);

  const socket = ref<Socket | null>(null);
  const currentUserId = computed(() => user.value?.id ?? 0);

  async function loadTicket() {
    error.value = null;
    const jwt = (token.value ?? '').trim();
    if (!jwt) {
      error.value = 'No hay sesión. Inicia sesión nuevamente.';
      return;
    }

    try {
      const res = await fetch(`${apiBase}/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error(`Error ${res.status} cargando ticket`);

      const data = await res.json();
      ticket.value = data;

      showSatisfaction.value = data?.status === 'CLOSED' && !data?.satisfaction;
    } catch (e: any) {
      console.error(e);
      error.value = e.message || 'No se pudo cargar el ticket.';
    }
  }

  function setupSocket(hooks?: {
    onHistoryLoaded?: () => void;
    onIncomingMessage?: (isFromMe: boolean) => void;
    onQueueUpdated?: (payload: TicketQueueStatus) => void;
  }) {
    const jwt = (token.value ?? '').trim();
    if (!jwt) return;

    const s = io(apiBase, {
      transports: ['websocket'],
      auth: { token: jwt, ticketId },
    });

    socket.value = s;

    s.on('ticket_history', (h: TicketMessage[]) => {
      messages.value = h;
      hooks?.onHistoryLoaded?.();
    });

    s.on('ticket_message', (msg: TicketMessage) => {
      const isFromMe = msg.senderId === currentUserId.value;
      hooks?.onIncomingMessage?.(isFromMe);
      messages.value.push(msg);
    });

    s.on('ticket_status_changed', ({ ticketId: tid, status }: any) => {
      if (ticket.value?.id === tid) {
        ticket.value.status = status;
        if (status === 'CLOSED' && !ticket.value.satisfaction) {
          showSatisfaction.value = true;
        }
      }
    });

    s.on('ticket_queue_updated', (payload: TicketQueueStatus) => {
      if (payload?.ticketId === ticketId) {
        hooks?.onQueueUpdated?.(payload);
      }
    });

    s.on('connect_error', (err: any) => console.error('WS error:', err));
  }

  async function sendTextMessage(text: string) {
    if (!text.trim()) return;
    isSending.value = true;
    try {
      socket.value?.emit('send_message', { ticketId, content: text.trim() });
    } finally {
      isSending.value = false;
    }
  }

  async function onSatisfactionSubmitted() {
    showSatisfaction.value = false;
    await loadTicket();
  }

  return {
    ticket,
    messages,
    error,
    isSending,
    showSatisfaction,
    loadTicket,
    setupSocket,
    sendTextMessage,
    onSatisfactionSubmitted,
  };
}
