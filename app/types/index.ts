// Arquivo principal de exportação de tipos
export * from './auth';
export * from './chat';
export * from './message';
export * from './props';
export * from './user';
export * from './webhook';

// Re-exportar Message como tipo principal
export type { Message } from './message';

// Estados da aplicação
export type AppView = "loading" | "ready" | "error";

// Tipos para eventos WebSocket
export type WebSocketEventType = 
  | 'chat_message'
  | 'user_joined'
  | 'user_left'
  | 'user_online'
  | 'user_offline'
  | 'typing_start'
  | 'typing_stop'
  | 'webhook_trigger';

// Interface para eventos WebSocket
export interface WebSocketEvent {
  type: WebSocketEventType;
  data: any;
  timestamp: string;
  chatId?: string;
  userId?: string;
}

// Tipos para diferentes modos de operação
export type OperationMode = 'owner' | 'guest' | 'viewer';

// Interface para configurações globais
export interface AppConfig {
  websocketUrl: string;
  apiUrl?: string;
  theme: 'light' | 'dark';
  notifications: boolean;
  autoSave: boolean;
}