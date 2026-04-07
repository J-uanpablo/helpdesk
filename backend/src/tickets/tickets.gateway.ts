// src/tickets/tickets.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { TicketsService } from './tickets.service';

type JwtPayload = {
  sub?: number;
  id?: number;
  roles?: string[] | string;
};

interface WsClient extends Socket {
  data: {
    userId: number;
    roles: string[];
    isClient: boolean;
  };
}

@WebSocketGateway({
  cors: { origin: '*' },
})
export class TicketsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  constructor(
    private readonly ticketsService: TicketsService,
    private readonly jwtService: JwtService,
  ) {}

  /* ===========================
     Helpers roles
  ============================ */
  private normalizeRoles(raw: any): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((r) => String(r));
    if (typeof raw === 'string') return [raw];
    return [];
  }

  private isClientRole(roles: string[]) {
    return roles.includes('client') || roles.includes('cliente');
  }

  private isAgentRole(roles: string[]) {
    return (
      roles.includes('agent') ||
      roles.includes('agente') ||
      roles.includes('admin') ||
      roles.includes('super-admin') ||
      roles.includes('support')
    );
  }

  /* ===========================
     🔥 CONNECT
  ============================ */
  async handleConnection(client: WsClient) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      const ticketIdRaw = client.handshake.auth?.ticketId;
      const ticketId = Number(ticketIdRaw);

      // áreas opcionales enviadas por el FRONT del panel
      const areasFromClient = client.handshake.auth?.areas as
        | string[]
        | undefined;

      if (!token) throw new Error('Missing token');

      const payload = (await this.jwtService.verifyAsync(token)) as JwtPayload;

      const userId = Number(payload.sub ?? payload.id);
      if (!userId) throw new Error('Invalid user id in token');

      const roles = this.normalizeRoles(payload.roles);
      const isClient = this.isClientRole(roles);
      const isAgent = this.isAgentRole(roles);

      client.data.userId = userId;
      client.data.roles = roles;
      client.data.isClient = isClient;

      // ✅ 1) Si viene ticketId válido => entrar al room del ticket
      if (ticketId && !Number.isNaN(ticketId)) {
        const room = `ticket_${ticketId}`;
        client.join(room);

        // 📤 ENVIAR HISTORIAL AL CONECTAR
        const history = await this.ticketsService.getMessages(ticketId);
        client.emit('ticket_history', history);

        console.log(`🟢 User ${userId} conectado a ${room}`);
        return;
      }

      // ✅ 2) Si NO viene ticketId => SOLO agentes pueden quedarse conectados
      if (isClient) {
        throw new Error('Client cannot connect without ticketId');
      }
      if (!isAgent) {
        throw new Error('User is not agent/admin');
      }

      // Room general de agentes
      client.join('agents');

      // Rooms por área (si el panel los manda)
      if (Array.isArray(areasFromClient) && areasFromClient.length > 0) {
        for (const a of areasFromClient) {
          const area = String(a || '').trim();
          if (!area) continue;
          client.join(`area:${area}`);
        }
      }

      console.log(
        `🟢 Agente/Admin ${userId} conectado a "agents"${
          areasFromClient?.length ? ` + areas ${areasFromClient.join(',')}` : ''
        }`,
      );
    } catch (error: any) {
      console.log('❌ Conexión rechazada:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: WsClient) {
    console.log('🔴 Cliente desconectado', client.id);
  }

  /* ===========================
     📩 Mensaje WS: send_message
  ============================ */
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: WsClient,
    @MessageBody() data: { ticketId: number; content: string },
  ) {
    const ticketId = Number(data?.ticketId);
    if (!ticketId) return;

    const room = `ticket_${ticketId}`;

    // Guardar en BD (aquí ya actualizas lastActivityAt en tu service)
    const msg = await this.ticketsService.addMessage({
      ticketId,
      content: data.content,
      senderId: client.data.userId,
    });

    // Emitir a TODOS los conectados al ticket
    this.server.to(room).emit('ticket_message', msg);

    // (Opcional) notificar que hubo actividad (sirve para listas)
    this.server.to('agents').emit('ticket_activity', { ticketId });

    return msg;
  }

  /* ===========================
     🔔 NEW TICKET (CORREGIDO)
     - Si hay área => solo a room area:XXX
     - Si NO hay área => a "agents"
     (evita doble emit)
  ============================ */
  emitNewTicket(ticket: {
    id: number;
    subject?: string | null;
    area?: string | null;
    createdAt?: any;
  }) {
    const payload = {
      id: ticket.id,
      subject: ticket.subject ?? null,
      area: ticket.area ?? null,
      createdAt: ticket.createdAt ?? null,
    };

    const area = (payload.area || '').trim();

    if (area) {
      this.server.to(`area:${area}`).emit('new_ticket', payload);
    } else {
      this.server.to('agents').emit('new_ticket', payload);
    }
  }

  /* ===========================
     ✅ CAMBIO DE ESTADO (manual o auto)
     Esto es CLAVE para el auto-cierre
  ============================ */
  emitTicketStatusChanged(params: {
    ticketId: number;
    status: string;
    reason?: 'MANUAL' | 'AUTO_CLOSE';
    changedAt?: string;
  }) {
    const ticketId = Number(params.ticketId);
    if (!ticketId) return;

    const payload = {
      ticketId,
      status: String(params.status),
      reason: params.reason ?? 'MANUAL',
      changedAt: params.changedAt ?? new Date().toISOString(),
    };

    // ✅ chat del ticket abierto
    this.server.to(`ticket_${ticketId}`).emit('ticket_status_changed', payload);

    // ✅ opcional: panel/listas
    this.server.to('agents').emit('ticket_status_changed', payload);
  }
}
