// src/auth/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export type RoleName = 'admin' | 'support' | 'auditor' | 'end-user';

export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
