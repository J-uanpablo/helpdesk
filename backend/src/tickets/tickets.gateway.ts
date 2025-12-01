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

// 👇 extendemos el tipo de Socket para que tenga data.userId
interface WsClient extends Socket {
  data: {
    userId: number;
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

  // 🔥 AL CONECTAR
  async handleConnection(client: WsClient) {
    try {
      const token = client.handshake.auth.token;
      const ticketId = Number(client.handshake.auth.ticketId);

      if (!token || !ticketId) throw new Error('Missing token or ticketId');

      const payload = await this.jwtService.verifyAsync(token);

      client.data.userId = payload.sub ?? payload.id;

      const room = `ticket_${ticketId}`;
      client.join(room);

      // 📤 ENVIAR HISTORIAL AL CONECTAR
      const history = await this.ticketsService.getMessages(ticketId);
      client.emit('ticket_history', history);

      console.log(
        `🟢 Usuario ${client.data.userId} conectado al ticket ${ticketId}`,
      );
    } catch (error: any) {
      console.log('❌ Conexión rechazada:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: WsClient) {
    console.log('🔴 Cliente desconectado', client.id);
  }

  // 📩 CUANDO CLIENTE ENVÍA MENSAJE
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: WsClient,
    @MessageBody() data: { ticketId: number; content: string },
  ) {
    const ticketId = data.ticketId;
    const room = `ticket_${ticketId}`;

    // Guardar en BD
    const msg = await this.ticketsService.addMessage({
      ticketId,
      content: data.content,
      senderId: client.data.userId,
    });

    // 📤 Emitir a TODOS los conectados al ticket
    this.server.to(room).emit('ticket_message', msg);

    return msg;
  }
}
