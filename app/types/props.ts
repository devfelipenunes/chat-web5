// Tipos e interfaces para props de componentes React
import { ReactNode } from 'react';
import { Chat } from './chat';
import { Message } from './message';
import { WebhookFormData } from './webhook';
import { User } from './user';

// Props para componentes de UI
export interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'url' | 'number';
  disabled?: boolean;
  className?: string;
  min?: number;
  max?: number;
  onKeyPress?: (e: React.KeyboardEvent) => void;
}

// Props para componentes de chat
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
  isConnected?: boolean;
  isSending?: boolean;
}

export interface ChatHeaderProps {
  chatName: string;
  isOwner: boolean;
  isConnected: boolean;
  isOnline?: boolean;
  onBack?: () => void;
  onSettings?: () => void;
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

// Props para componentes de sidebar
export interface SidebarProps {
  chats: Chat[];
  selectedChatId: string | null;
  onChatSelect: (chatId: string) => void;
  onlineUsers: Set<string>;
  onCreateChat: () => void;
  isCreatingChat: boolean;
  inviteCode: string;
  onInviteCodeChange: (code: string) => void;
  onProcessInvite: () => void;
  isProcessingInvite: boolean;
  webhookData: WebhookFormData;
  onWebhookDataChange: (data: WebhookFormData) => void;
  onSaveWebhook: () => void;
  isSavingWebhook: boolean;
}

// Props para componentes de mensagens
export interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export interface MessageBubbleProps {
  message: Message;
  showSender?: boolean;
}

// Props para componentes de área de chat
export interface ChatAreaProps {
  chatName: string;
  isOwner: boolean;
  isConnected: boolean;
  isOnline?: boolean;
  messages: Message[];
  messageValue: string;
  onMessageChange: (value: string) => void;
  onSendMessage: () => void;
  isSending?: boolean;
  isLoadingMessages?: boolean;
  onLoadMore?: () => void;
  hasMoreMessages?: boolean;
  error?: string | null;
  onReconnect?: () => void;
  onBack?: () => void;
  onSettings?: () => void;
}