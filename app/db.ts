import Dexie, { Table } from 'dexie';

export interface ChatMessage {
  id?: number; 
  chatId: string;
  sender: string;
  content: string;
  timestamp: string;
  savedByOwner?: boolean;
  webhookSent?: boolean;
}

export interface ChatCredential {
    id?: number;
    chatId: string;
    issuerDid: string;
    jwt: string;
    receivedAt: string;
}

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

export interface ChatRoom {
  id?: number;
  chatId: string;
  name: string;
  ownerDid: string;
  createdAt: string;
  isOwner: boolean;
  saveMessagesLocally: boolean;
  webhookEnabled: boolean;
  websocketUrl?: string;
  isActive: boolean;
}

export interface EventLog {
  id?: number;
  chatId: string;
  eventType: string;
  data: any;
  timestamp: string;
  userDid?: string;
}

export class ChatAppDB extends Dexie {
  messages!: Table<ChatMessage>;
  credentials!: Table<ChatCredential>; 
  webhookConfigs!: Table<WebhookConfig>;
  chatRooms!: Table<ChatRoom>;
  eventLogs!: Table<EventLog>;

  constructor() {
    super('chatAppDatabase');
    this.version(4).stores({ 
      messages: '++id, chatId, sender, timestamp',
      credentials: '++id, chatId, issuerDid', 
      webhookConfigs: '++id, chatId, ownerDid',
      chatRooms: '++id, chatId, ownerDid',
      eventLogs: '++id, chatId, eventType, timestamp'
    });
  }
}

export const db = new ChatAppDB();
