// Interfaces e tipos para mensagens de chat
export interface Message {
  id: string;
  content: string;
  senderDid: string;
  timestamp: string;
  isCurrentUser: boolean;
}

// Interface para dados de entrada de mensagem
export interface MessageInput {
  content: string;
  chatId: string;
  timestamp: string;
}

// Tipos para status de mensagem
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'failed';

export interface MessageWithStatus extends Message {
  status: MessageStatus;
}