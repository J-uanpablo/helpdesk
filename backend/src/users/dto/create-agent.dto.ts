// src/users/dto/create-agent.dto.ts
export class CreateAgentDto {
  name: string;
  email: string;
  password: string; // contraseña temporal
  // 'support' para agente, 'admin' para administrador de área
  role: 'support' | 'admin';
  // área de soporte (obligatoria para support, opcional para admin)
  supportArea?: string | null;
}
