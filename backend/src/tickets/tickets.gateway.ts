import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TicketsService } from './tickets.service';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class TicketsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  constructor(
    private readonly ticketsService: TicketsService,
    private readonly jwtService: JwtService, // 👈 inyectamos JWT
  ) {}

  // Se ejecuta cuando un cliente conecta
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) {
        client.disconnect(true);
        return;
      }

      // Verificamos el token
      const payload = this.jwtService.verify(token);
      // Guardamos el usuario en client.data
      client.data.user = {
        id: payload.sub,
        email: payload.email,
        roles: payload.roles || [],
      };

      console.log('WS conectado:', client.data.user);
    } catch (err) {
      console.error('Token inválido en WS:', err.message);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    console.log('WS desconectado:', client.data.user?.email);
  }

  /** Un usuario se conecta al chat de un ticket */
  @SubscribeMessage('joinTicket')
  handleJoin(
    @MessageBody() data: { ticketId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    if (!user) return;

    client.join(`ticket_${data.ticketId}`);
    client.emit('system', `Conectado al ticket ${data.ticketId}`);
  }

  /** Nuevo mensaje */
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody()
    data: { ticketId: number; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    if (!user) {
      client.emit('system', 'No autenticado');
      return;
    }

    const msg = await this.ticketsService.addMessage(
      data.ticketId,
      user.id, // 👈 senderId ahora viene del token, no del front
      data.content,
    );

    this.server.to(`ticket_${data.ticketId}`).emit('newMessage', msg);
    return msg;
  }
}
