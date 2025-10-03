// Interfaces e tipos para chats e salas
export interface Chat {
  id: string;
  name: string;
  host: string;
  isOwner?: boolean;
  webhookEnabled?: boolean;
  saveLocally?: boolean;
  isOnline?: boolean;
  lastSeen?: string;
  isActive?: boolean;
}

// Interface para criação de novo chat
export interface CreateChatRequest {
  name: string;
  ownerDid: string;
  websocketUrl?: string;
}

// Interface para dados de resposta ao criar chat
export interface CreateChatResponse {
  chatId: string;
  name: string;
  ownerDid: string;
  jwt: string; // Credencial JWT para acesso
}

// Interface para configurações de chat
export interface ChatSettings {
  name: string;
  webhookEnabled: boolean;
  saveMessagesLocally: boolean;
  websocketUrl?: string;
}

// Tipos para status do chat
export type ChatStatus = 'active' | 'inactive' | 'archived';

export interface ChatWithStatus extends Chat {
  status: ChatStatus;
  participantCount?: number;
  lastActivity?: string;
}