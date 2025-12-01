// src/composables/useTicketChat.ts
import { ref, onBeforeUnmount } from "vue";
import { io, Socket } from "socket.io-client";

interface ConnectPayload {
  ticketId: number;
  token: string;
}

interface SendMessagePayload {
  ticketId: number;
  content: string;
}

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
    // Cerrar conexión anterior si existía
    cleanupSocket();

    isConnecting.value = true;
    lastError.value = null;
    messages.value = [];

    // 👇 Ajusta la URL si tu backend no está en localhost:3000
    const s = io("http://localhost:3000", {
      transports: ["websocket"],
      // Lo importante: aquí mandamos el token y el ticketId
      auth: {
        token,
        ticketId,
      } as ConnectPayload,
    });

    s.on("connect", () => {
      isConnected.value = true;
      isConnecting.value = false;
      lastError.value = null;
      console.log("✅ WS conectado", s.id);

      // Si tu gateway tiene un evento para "unirse" al ticket, emítelo aquí:
      // s.emit("join_ticket", { ticketId });
    });

    s.on("disconnect", (reason) => {
      console.log("❌ WS desconectado:", reason);
      isConnected.value = false;
    });

    s.on("connect_error", (err: any) => {
      console.error("⚠️ Error de conexión WS:", err);
      lastError.value = err?.message || "Error de conexión";
      isConnecting.value = false;
      isConnected.value = false;
    });

    // 📥 Cuando el backend envíe el historial de mensajes del ticket
    s.on("ticket_history", (data: any[]) => {
      messages.value = data;
    });

    // 📥 Cuando llegue un mensaje nuevo
    s.on("ticket_message", (msg: any) => {
      messages.value.push(msg);
    });

    socket.value = s;
  }

  function sendMessage(ticketId: number, content: string) {
    if (!socket.value || !isConnected.value) {
      console.warn("No hay conexión activa al WS");
      return;
    }

    const payload: SendMessagePayload = { ticketId, content };

    // 👇 Ajusta el nombre del evento al que uses en tu gateway
    socket.value.emit("send_message", payload);
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
