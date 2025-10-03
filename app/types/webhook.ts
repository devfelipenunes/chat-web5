// Interfaces e tipos para webhooks
export interface WebhookFormData {
  url: string;
  secret: string;
  retries: number;
  timeout: number;
  headers?: Record<string, string>;
}

// Interface para configuração completa de webhook
export interface WebhookConfig {
  id?: number;
  chatId: string;
  ownerDid: string;
  url: string;
  secret: string;
  active: boolean;
  retryAttempts?: number;
  headers?: Record<string, string>;
  createdAt: string;
  lastUsed?: string;
}

// Interface para dados da credencial de convite (incluindo WebSocket)
export interface InviteCredentialSubject {
  chatId: string;
  chatName: string;
  ownerDid: string;
  websocketUrl: string; // URL do WebSocket para conexão
  webhookConfig?: {
    url: string;
    secret: string;
    active: boolean;
  };
  permissions: string[];
  maxUses?: number;
  expiresAt?: string;
  chatStatus: 'active' | 'inactive'; // Status do chat (ligado/desligado)
}

// Interface para dados enviados via webhook
export interface WebhookPayload {
  chatId: string;
  message: {
    content: string;
    sender: string;
    timestamp: string;
  };
  metadata?: {
    messageId: string;
    chatName: string;
  };
}

// Tipos para status do webhook
export type WebhookStatus = 'pending' | 'success' | 'failed' | 'retrying';

// Interface para resposta do webhook
export interface WebhookResponse {
  status: WebhookStatus;
  attempts: number;
  lastAttempt: string;
  error?: string;
}

// Interface para log de webhook
export interface WebhookLog {
  id?: number;
  chatId: string;
  url: string;
  payload: WebhookPayload;
  response: WebhookResponse;
  timestamp: string;
}