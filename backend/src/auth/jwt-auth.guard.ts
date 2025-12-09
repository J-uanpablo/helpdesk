// src/auth/jwt-auth.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const type = context.getType<'http' | 'ws'>();

    // 👉 Para WebSocket (gateways)
    if (type === 'ws') {
      const client = context.switchToWs().getClient();
      // En sockets usamos client.handshake, donde está auth.token
      return client.handshake;
    }

    // 👉 Para HTTP (REST)
    const request = context.switchToHttp().getRequest();

    // Priorizar siempre el header Authorization que manda el frontend
    if (request.headers?.authorization) {
      return request;
    }

    // Fallback opcional: si algún día usas cookies:
    if (request.cookies?.Authentication && !request.headers.authorization) {
      request.headers.authorization = `Bearer ${request.cookies.Authentication}`;
    }

    return request;
  }
}
