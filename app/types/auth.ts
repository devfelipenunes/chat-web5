// Interfaces e tipos para credenciais e autenticação
export interface ChatCredentialData {
  chatId: string;
  issuerDid: string;
  jwt: string;
  receivedAt: string;
}

// Interface para dados de convite
export interface InviteData {
  chatId: string;
  chatName: string;
  hostDid: string;
  jwt: string;
  expiresAt?: string;
}

// Interface para processamento de convite
export interface ProcessInviteRequest {
  inviteCode: string;
  recipientDid: string;
}

export interface ProcessInviteResponse {
  success: boolean;
  chatId?: string;
  chatName?: string;
  error?: string;
}

// Tipos para status de autenticação
export type AuthStatus = 'authenticated' | 'unauthenticated' | 'pending';

// Interface para dados de autenticação
export interface AuthData {
  did: string;
  jwt?: string;
  expiresAt?: string;
}