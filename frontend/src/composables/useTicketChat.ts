// src/composables/useTicketChat.ts
import { ref, onBeforeUnmount } from 'vue';
import { io, Socket } from 'socket.io-client';

interface ConnectPayload {
  ticketId: number;
  token: string;
}

interface SendMessagePayload {
  ticketId: number;
  content: string;
}

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export function useTicketChat() {
  const socket = ref<Socket | null>(null);

  const messages = ref<any[]>([]);
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const lastError = ref<string | null>(null);

  function cleanupSocket() {
    if (socket.value) {
      socket.value.off();
      socket.value.disconnect();
      socket.value = null;
    }
    isConnected.value = false;
  }

  function connect(ticketId: number, token: string) {
    cleanupSocket();

    isConnecting.value = true;
    lastError.value = null;
    messages.value = [];

    const s = io(API_BASE, {
      transports: ['websocket'],
      auth: {
        token,
        ticketId,
      } as ConnectPayload,
    });

    s.on('connect', () => {
      isConnected.value = true;
      isConnecting.value = false;
      lastError.value = null;
      console.log('✅ WS conectado', s.id);
    });

    s.on('disconnect', reason => {
      console.log('❌ WS desconectado:', reason);
      isConnected.value = false;
    });

    s.on('connect_error', (err: any) => {
      console.error('⚠️ Error de conexión WS:', err);
      lastError.value = err?.message || 'Error de conexión';
      isConnecting.value = false;
      isConnected.value = false;
    });

    s.on('ticket_history', (data: any[]) => {
      messages.value = data;
    });

    s.on('ticket_message', (msg: any) => {
      messages.value.push(msg);
    });

    socket.value = s;
  }

  function sendMessage(ticketId: number, content: string) {
    if (!socket.value || !isConnected.value) {
      console.warn('No hay conexión activa al WS');
      return;
    }

    const payload: SendMessagePayload = { ticketId, content };
    socket.value.emit('send_message', payload);
  }

  onBeforeUnmount(() => {
    cleanupSocket();
  });

  return {
    messages,
    isConnected,
    isConnecting,
    lastError,
    connect,
    sendMessage,
  };
}
