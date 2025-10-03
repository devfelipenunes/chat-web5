// Interfaces e tipos para status online e usuários
export interface OnlineStatus {
  isOnline: boolean;
  lastSeen: string;
}

export interface UserStatus {
  did: string;
  isOnline: boolean;
  lastSeen: string;
}

// Interface para dados do usuário
export interface User {
  did: string;
  name?: string;
  avatar?: string;
  isCurrentUser?: boolean;
}

// Interface para presença em tempo real
export interface UserPresence {
  did: string;
  chatId: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: string;
  activity?: 'typing' | 'idle' | 'active';
}

// Tipos para eventos de presença
export type PresenceEvent = 'user_joined' | 'user_left' | 'user_typing' | 'user_idle';

export interface PresenceUpdate {
  event: PresenceEvent;
  user: UserPresence;
  timestamp: string;
}