/**
 * Hook para gerenciar Webhooks por Chat
 */

import { useState, useCallback, useEffect } from 'react';
import { db, WebhookConfig } from '../db';

export const useWebhook = (chatId: string | null, ownerDid: string | null, ws: WebSocket | null) => {
  const [webhook, setWebhook] = useState<WebhookConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Carrega webhook do chat
  const loadWebhook = useCallback(async () => {
    if (!chatId) return;

    try {
      setIsLoading(true);
      const configs = await db.webhookConfigs.where('chatId').equals(chatId).toArray();
      setWebhook(configs[0] || null);
    } catch (error) {
      console.error('Erro ao carregar webhook:', error);
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  // Gera secret para webhook
  const generateSecret = () => {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  // Salva/atualiza webhook
  const saveWebhook = useCallback(async (config: {
    url: string;
    events: string[];
    isActive: boolean;
  }) => {
    if (!chatId || !ownerDid) throw new Error('Chat ou DID não disponível');
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket não está conectado. Aguarde a conexão e tente novamente.');
    }

    try {
      const webhookConfig: WebhookConfig = {
        chatId,
        ownerDid,
        url: config.url,
        secret: webhook?.secret || generateSecret(),
        active: config.isActive,
        retryAttempts: webhook?.retryAttempts || 3,
        headers: webhook?.headers || {},
        createdAt: webhook?.createdAt || new Date().toISOString(),
        lastUsed: webhook?.lastUsed
      };

      // Salva localmente
      if (webhook?.id) {
        await db.webhookConfigs.delete(webhook.id);
      }
      const newId = await db.webhookConfigs.add(webhookConfig);

      // Envia para servidor
      ws.send(JSON.stringify({
        type: 'configure_webhook',
        chatId,
        webhook: {
          ...webhookConfig,
          events: config.events
        }
      }));

      setWebhook({ ...webhookConfig, id: newId as number });
    } catch (error) {
      console.error('Erro ao salvar webhook:', error);
      throw error;
    }
  }, [chatId, ownerDid, ws, webhook]);

  // Remove webhook
  const deleteWebhook = useCallback(async () => {
    if (!chatId || !ws) throw new Error('Chat ou WebSocket não disponível');

    try {
      await db.webhookConfigs.delete(chatId);

      ws.send(JSON.stringify({
        type: 'remove_webhook',
        chatId
      }));

      setWebhook(null);
    } catch (error) {
      console.error('Erro ao deletar webhook:', error);
      throw error;
    }
  }, [chatId, ws]);

  // Testa webhook
  const testWebhook = useCallback(async (): Promise<boolean> => {
    if (!chatId || !ws || !webhook) return false;

    return new Promise((resolve) => {
      const handleMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'webhook_test_result' && data.chatId === chatId) {
            ws.removeEventListener('message', handleMessage);
            resolve(data.success);
          }
        } catch (error) {
          console.error('Erro ao processar resposta de teste:', error);
        }
      };

      ws.addEventListener('message', handleMessage);

      ws.send(JSON.stringify({
        type: 'test_webhook',
        chatId
      }));

      // Timeout após 10 segundos
      setTimeout(() => {
        ws.removeEventListener('message', handleMessage);
        resolve(false);
      }, 10000);
    });
  }, [chatId, ws, webhook]);

  // Carrega webhook quando chat muda
  useEffect(() => {
    loadWebhook();
  }, [loadWebhook]);

  return {
    webhook,
    isLoading,
    saveWebhook,
    deleteWebhook,
    testWebhook,
    reloadWebhook: loadWebhook
  };
};