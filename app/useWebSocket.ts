import { useState, useEffect, useCallback, useRef } from 'react';
import { db, WebhookConfig } from './db';

interface UseWebSocketHookProps {
  did: string | null;
  activeChatId: string | null;
  isRoomOwner: boolean;
}

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export const useWebSocket = ({ did, activeChatId, isRoomOwner }: UseWebSocketHookProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Map<string, { isOnline: boolean; lastSeen: string }>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const getWebSocketUrl = () => {
        if (process.env.NEXT_PUBLIC_WS_URL) {
          return process.env.NEXT_PUBLIC_WS_URL;
        }
        if (typeof window !== 'undefined') {
          const hostname = window.location.hostname;
          if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'ws://localhost:8080';
          }
          if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
            return `ws://${hostname}:8080`;
          }
          return `ws://${hostname}:8080`;
        }
        return 'ws://localhost:8080';
      };

      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionError(null);

        if (did) {
          ws.send(JSON.stringify({
            type: 'authenticate',
            did: did
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'auth_success':
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'request_online_status' }));
              }
              break;
            case 'webhook_registered':
              if (message.webhook) {
                setWebhookConfig({
                  chatId: message.chatId,
                  ownerDid: did!,
                  url: message.webhook.url,
                  secret: message.webhook.secret,
                  active: message.webhook.active,
                  createdAt: new Date().toISOString()
                });
              }
              break;
            case 'webhook_removed':
              setWebhookConfig(null);
              break;
            case 'chat_message':
              window.dispatchEvent(new CustomEvent('websocket-message', { 
                detail: message 
              }));
              break;
            case 'encrypted_chat':
              window.dispatchEvent(new CustomEvent('websocket-message', { 
                detail: message 
              }));
              break;
            case 'user_status_update':
              setOnlineUsers(prev => {
                const newMap = new Map(prev);
                newMap.set(message.userDid, {
                  isOnline: message.isOnline,
                  lastSeen: message.timestamp
                });
                return newMap;
              });
              break;
            case 'online_status_response':
              const usersMap = new Map();
              Object.entries(message.onlineUsers || {}).forEach(([did, status]: [string, any]) => {
                usersMap.set(did, status);
              });
              setOnlineUsers(usersMap);
              break;
            case 'error':
              setConnectionError(message.message);
              break;
            default:
              break;
          }
        } catch (error) {
          // erro ao processar mensagem
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        setTimeout(() => {
          if (did) {
            connect();
          }
        }, 3000);
      };

      ws.onerror = (error) => {
        setConnectionError('Erro na conexão com o servidor');
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (error) {
      setConnectionError('Não foi possível conectar ao servidor');
    }
  }, [did]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    } else {
      return false;
    }
  }, []);

  const registerWebhook = useCallback(async (url: string, retryAttempts: number = 3, headers?: Record<string, string>) => {
    if (!isRoomOwner) {
      throw new Error('Apenas o dono da sala pode configurar webhooks');
    }
    if (!activeChatId || !did) {
      throw new Error('Chat ou DID não disponível');
    }
    if (!isConnected) {
      throw new Error('WebSocket não está conectado');
    }

    const webhookData = {
      url,
      retryAttempts,
      headers: headers || {}
    };

    const success = sendMessage({
      type: 'webhook_register',
      chatId: activeChatId,
      webhook: webhookData
    });

    if (!success) {
      throw new Error('Falha ao enviar configuração do webhook');
    }

    const config: WebhookConfig = {
      chatId: activeChatId,
      ownerDid: did,
      url,
      secret: '',
      active: true,
      retryAttempts,
      headers,
      createdAt: new Date().toISOString()
    };

    await db.webhookConfigs.add(config);
  }, [isRoomOwner, activeChatId, did, isConnected, sendMessage]);

  const removeWebhook = useCallback(async () => {
    if (!isRoomOwner) {
      throw new Error('Apenas o dono da sala pode remover webhooks');
    }
    if (!activeChatId) {
      throw new Error('Chat não disponível');
    }
    if (!isConnected) {
      throw new Error('WebSocket não está conectado');
    }

    const success = sendMessage({
      type: 'webhook_remove',
      chatId: activeChatId
    });

    if (!success) {
      throw new Error('Falha ao remover webhook no servidor');
    }

    await db.webhookConfigs.where('chatId').equals(activeChatId).delete();
    setWebhookConfig(null);
  }, [isRoomOwner, activeChatId, isConnected, sendMessage]);

  const loadWebhookConfig = useCallback(async () => {
    if (!activeChatId || !did) return;

    try {
      const config = await db.webhookConfigs
        .where('chatId')
        .equals(activeChatId)
        .and(item => item.ownerDid === did)
        .first();
      setWebhookConfig(config || null);
    } catch (error) {
      // erro ao carregar configuração
    }
  }, [activeChatId, did]);

  useEffect(() => {
    if (did) {
      connect();
    } else {
      disconnect();
    }
    return () => {
      disconnect();
    };
  }, [did, connect, disconnect]);

  useEffect(() => {
    loadWebhookConfig();
  }, [loadWebhookConfig]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    connectionError,
    webhookConfig,
    onlineUsers,
    ws: wsRef.current,
    sendMessage,
    registerWebhook,
    removeWebhook,
    loadWebhookConfig,
    isUserOnline: (userDid: string) => {
      const userStatus = onlineUsers.get(userDid);
      return userStatus?.isOnline || false;
    }
  };
};
