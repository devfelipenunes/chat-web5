// Tipos e interfaces principais do sistema de chat

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

export interface WebhookFormData {
  url: string;
  secret: string;
  retries: number;
  timeout: number;
  headers?: Record<string, string>;
}

export interface OnlineStatus {
  isOnline: boolean;
  lastSeen: string;
}

export interface ChatCredentialData {
  chatId: string;
  issuerDid: string;
  jwt: string;
  receivedAt: string;
}

export interface UserStatus {
  did: string;
  isOnline: boolean;
  lastSeen: string;
}

// Estados da aplicação
export type AppView = "loading" | "ready" | "error";

// Props dos componentes
export interface ChatListProps {
  chats: Chat[];
  activeChatId: string | null;
  onChatSelect: (chatId: string) => void;
  isUserOnline: (userDid: string) => boolean;
  currentUserDid: string | null;
}

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export interface ChatHeaderProps {
  chatName: string;
  isOwner: boolean;
  isConnected: boolean;
  connectionError: string | null;
}

export interface WebhookConfigProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: (data: WebhookFormData) => void;
  isLoading?: boolean;
}

export interface ChatManagementProps {
  isOwner: boolean;
  isConnected: boolean;
  connectionError: string | null;
  webhookConfig: any;
  websocketServerUrl: string;
  setWebsocketServerUrl: (url: string) => void;
  onWebhookConfig: () => void;
  onWebhookRemove: () => void;
  onIssueCredential: (recipientDid: string) => void;
  issuedVcJwt: string | null;
}