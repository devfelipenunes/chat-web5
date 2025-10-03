// Hooks customizados para lógicas específicas do chat

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Chat, WebhookFormData } from '../types';
import { db } from '../db';

// Hook para gerenciar estado dos chats
export const useChats = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadChats = useCallback(async () => {
    try {
      setIsLoading(true);
      const rooms = await db.chatRooms.toArray();
      const chatList: Chat[] = rooms.map(room => ({
        id: room.chatId,
        name: room.name,
        host: room.ownerDid,
        isOwner: room.isOwner,
        webhookEnabled: room.webhookEnabled,
        saveLocally: room.saveMessagesLocally,
        isActive: room.isActive !== false // Default para true se não especificado
      }));
      setChats(chatList);
    } catch (error) {
      console.error('Erro ao carregar chats:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectChat = useCallback((chatId: string | null) => {
    setSelectedChatId(chatId);
  }, []);

  const addChat = useCallback((newChat: Chat) => {
    setChats(prev => [...prev, newChat]);
  }, []);

  const updateChat = useCallback((chatId: string, updates: Partial<Chat>) => {
    setChats(prev => prev.map(chat => 
      chat.id === chatId ? { ...chat, ...updates } : chat
    ));
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const selectedChat = useMemo(() => 
    chats.find(chat => chat.id === selectedChatId) || null,
    [chats, selectedChatId]
  );

  return {
    chats,
    selectedChat,
    selectedChatId,
    isLoading,
    selectChat,
    addChat,
    updateChat,
    loadChats
  };
};

// Hook para gerenciar mensagens do chat
export const useChatMessages = (chatId: string | null, currentUserDid?: string | null) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const loadMessages = useCallback(async (limit = 50, offset = 0) => {
    if (!chatId) {
      setMessages([]);
      return;
    }

    try {
      setIsLoading(true);
      const chatMessages = await db.messages
        .where('chatId')
        .equals(chatId)
        .reverse()
        .offset(offset)
        .limit(limit)
        .toArray();

      const formattedMessages = chatMessages.map(msg => ({
        id: msg.id?.toString() || `db_${msg.chatId}_${msg.timestamp}_${Math.random().toString(36).substring(2, 9)}`,
        content: msg.content,
        senderDid: msg.sender,
        timestamp: msg.timestamp,
        isCurrentUser: currentUserDid ? msg.sender === currentUserDid : false
      }));

      if (offset === 0) {
        setMessages(formattedMessages);
      } else {
        setMessages(prev => [...formattedMessages, ...prev]);
      }

      setHasMore(chatMessages.length === limit);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  const addMessage = useCallback((message: any) => {
    const formattedMessage = {
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      content: message.content,
      senderDid: message.senderDid,
      timestamp: message.timestamp,
      isCurrentUser: message.isCurrentUser || false
    };

    setMessages(prev => {
      // Verificar duplicadas por conteúdo, sender e timestamp próximo (para evitar spam)
      const isDuplicate = prev.some(msg => 
        msg.content === formattedMessage.content && 
        msg.senderDid === formattedMessage.senderDid && 
        Math.abs(new Date(msg.timestamp).getTime() - new Date(formattedMessage.timestamp).getTime()) < 2000
      );
      
      if (isDuplicate) {
        console.warn('Mensagem duplicada detectada, ignorando:', formattedMessage.content);
        return prev;
      }
      
      return [...prev, formattedMessage];
    });
  }, []);

  useEffect(() => {
    if (chatId) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [chatId, currentUserDid, loadMessages]);

  return {
    messages,
    isLoading,
    hasMore,
    loadMessages,
    addMessage
  };
};

// Hook para gerenciar formulário de webhook
export const useWebhookForm = (initialData?: Partial<WebhookFormData>) => {
  const [webhookData, setWebhookData] = useState<WebhookFormData>({
    url: '',
    secret: '',
    retries: 3,
    timeout: 5000,
    headers: {},
    ...initialData
  });

  const [isSaving, setIsSaving] = useState(false);

  const updateField = useCallback((field: keyof WebhookFormData, value: string | number) => {
    setWebhookData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const resetForm = useCallback(() => {
    setWebhookData({
      url: '',
      secret: '',
      retries: 3,
      timeout: 5000,
      headers: {}
    });
  }, []);

  const isValid = useMemo(() => {
    return webhookData.url.trim().length > 0;
  }, [webhookData.url]);

  return {
    webhookData,
    isSaving,
    isValid,
    setIsSaving,
    updateField,
    resetForm,
    setWebhookData
  };
};

// Hook para gerenciar entrada de mensagem
export const useMessageInput = () => {
  const [messageValue, setMessageValue] = useState('');
  const [isSending, setIsSending] = useState(false);

  const clearMessage = useCallback(() => {
    setMessageValue('');
  }, []);

  const canSend = useMemo(() => {
    return messageValue.trim().length > 0 && !isSending;
  }, [messageValue, isSending]);

  return {
    messageValue,
    isSending,
    canSend,
    setMessageValue,
    setIsSending,
    clearMessage
  };
};

// Hook para gerenciar processamento de convites
export const useInviteProcessor = () => {
  const [inviteCode, setInviteCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const clearInvite = useCallback(() => {
    setInviteCode('');
  }, []);

  const canProcess = useMemo(() => {
    return inviteCode.trim().length > 0 && !isProcessing;
  }, [inviteCode, isProcessing]);

  return {
    inviteCode,
    isProcessing,
    canProcess,
    setInviteCode,
    setIsProcessing,
    clearInvite
  };
};

// Hook para gerenciar status online dos usuários
export const useOnlineStatus = () => {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const setUserOnline = useCallback((userId: string) => {
    setOnlineUsers(prev => new Set([...prev, userId]));
  }, []);

  const setUserOffline = useCallback((userId: string) => {
    setOnlineUsers(prev => {
      const newSet = new Set(prev);
      newSet.delete(userId);
      return newSet;
    });
  }, []);

  const isUserOnline = useCallback((userId: string) => {
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  const updateOnlineUsers = useCallback((users: string[]) => {
    setOnlineUsers(new Set(users));
  }, []);

  return {
    onlineUsers,
    setUserOnline,
    setUserOffline,
    isUserOnline,
    updateOnlineUsers
  };
};

// Hook para gerenciar estado de criação de chat
export const useChatCreation = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [newChatName, setNewChatName] = useState('');

  const resetCreation = useCallback(() => {
    setNewChatName('');
    setIsCreating(false);
  }, []);

  const canCreate = useMemo(() => {
    return newChatName.trim().length > 0 && !isCreating;
  }, [newChatName, isCreating]);

  return {
    isCreating,
    newChatName,
    canCreate,
    setIsCreating,
    setNewChatName,
    resetCreation
  };
};