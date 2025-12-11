// src/users/dto/update-agent.dto.ts
export class UpdateAgentDto {
  name?: string;
  email?: string;
  password?: string; // opcional, para resetear si quieres más adelante
  role?: 'support' | 'admin';
  supportArea?: string | null;
  isActive?: boolean;
}
