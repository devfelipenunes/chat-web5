/**
 * Sistema de Webhook para Chat Web5
 * 
 * Este módulo gerencia webhooks para notificar endpoints externos sobre eventos do chat.
 * Funcionalidades:
 * - Registrar/remover webhooks por chat
 * - Autenticação via HMAC SHA-256
 * - Sistema de retry com backoff exponencial
 * - Validação de permissões (apenas donos podem configurar)
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');

class WebhookManager {
  constructor() {
    this.webhooks = new Map(); // chatId -> webhook config
    this.eventQueue = []; // Fila de eventos para retry
  }

  /**
   * Registra um webhook para um chat específico
   * @param {string} chatId - ID do chat
   * @param {string} ownerDid - DID do dono da sala
   * @param {Object} webhookConfig - Configuração do webhook
   */
  registerWebhook(chatId, ownerDid, webhookConfig) {
    const config = {
      ...webhookConfig,
      chatId,
      ownerDid,
      registeredAt: new Date().toISOString(),
      secret: webhookConfig.secret || this.generateSecret(),
      active: true,
      retryAttempts: webhookConfig.retryAttempts || 3,
      timeout: webhookConfig.timeout || 5000
    };

    this.webhooks.set(chatId, config);
    console.log(`🔗 Webhook registrado para chat ${chatId} por ${ownerDid}`);
    return config;
  }

  /**
   * Remove webhook de um chat
   * @param {string} chatId - ID do chat
   * @param {string} requestingDid - DID de quem está solicitando a remoção
   */
  removeWebhook(chatId, requestingDid) {
    const webhook = this.webhooks.get(chatId);
    if (!webhook) {
      throw new Error('Webhook não encontrado');
    }

    if (webhook.ownerDid !== requestingDid) {
      throw new Error('Apenas o dono da sala pode remover o webhook');
    }

    this.webhooks.delete(chatId);
    console.log(`🗑️ Webhook removido do chat ${chatId} por ${requestingDid}`);
    return true;
  }

  /**
   * Dispara webhook para um evento específico
   * @param {string} chatId - ID do chat
   * @param {Object} eventData - Dados do evento
   */
  async triggerWebhook(chatId, eventData) {
    const webhook = this.webhooks.get(chatId);
    if (!webhook || !webhook.active) {
      return;
    }

    const payload = {
      timestamp: new Date().toISOString(),
      chatId,
      event: eventData,
      metadata: {
        source: 'chat-web5',
        version: '1.0.0'
      }
    };

    try {
      await this.sendWebhookRequest(webhook, payload);
      console.log(`✅ Webhook enviado com sucesso para ${webhook.url}`);
    } catch (error) {
      console.error(`❌ Erro ao enviar webhook:`, error.message);
      // Adicionar à fila de retry
      this.addToRetryQueue(webhook, payload, 1);
    }
  }

  /**
   * Envia requisição HTTP/HTTPS para o webhook
   * @param {Object} webhook - Configuração do webhook
   * @param {Object} payload - Dados a enviar
   */
  sendWebhookRequest(webhook, payload) {
    return new Promise((resolve, reject) => {
      const jsonPayload = JSON.stringify(payload);
      const signature = this.generateSignature(jsonPayload, webhook.secret);
      
      const url = new URL(webhook.url);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(jsonPayload),
          'X-Webhook-Signature': signature,
          'User-Agent': 'ChatWeb5-Webhook/1.0',
          ...webhook.headers
        },
        timeout: webhook.timeout || 5000
      };

      const req = httpModule.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              statusCode: res.statusCode,
              data: responseData
            });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(jsonPayload);
      req.end();
    });
  }

  /**
   * Adiciona evento à fila de retry
   * @param {Object} webhook - Configuração do webhook
   * @param {Object} payload - Dados do evento
   * @param {number} attempt - Número da tentativa
   */
  addToRetryQueue(webhook, payload, attempt) {
    if (attempt <= webhook.retryAttempts) {
      const retryDelay = Math.pow(2, attempt) * 1000; // Backoff exponencial
      
      setTimeout(async () => {
        try {
          await this.sendWebhookRequest(webhook, payload);
          console.log(`✅ Webhook retry ${attempt} bem-sucedido para ${webhook.url}`);
        } catch (error) {
          console.error(`❌ Webhook retry ${attempt} falhou:`, error.message);
          if (attempt < webhook.retryAttempts) {
            this.addToRetryQueue(webhook, payload, attempt + 1);
          } else {
            console.error(`🚫 Webhook falhou após ${webhook.retryAttempts} tentativas`);
          }
        }
      }, retryDelay);
    }
  }

  /**
   * Gera assinatura HMAC SHA-256
   * @param {string} data - Dados a assinar
   * @param {string} secret - Chave secreta
   */
  generateSignature(data, secret) {
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  /**
   * Gera uma chave secreta aleatória
   */
  generateSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Lista webhooks (para depuração)
   */
  listWebhooks() {
    const webhooks = [];
    for (const [chatId, config] of this.webhooks) {
      webhooks.push({
        chatId,
        url: config.url,
        ownerDid: config.ownerDid,
        active: config.active,
        registeredAt: config.registeredAt
      });
    }
    return webhooks;
  }

  /**
   * Valida se um DID pode configurar webhook para um chat
   * @param {string} chatId - ID do chat
   * @param {string} did - DID do usuário
   */
  canConfigureWebhook(chatId, did) {
    const webhook = this.webhooks.get(chatId);
    return !webhook || webhook.ownerDid === did;
  }

  /**
   * Testa um webhook enviando uma mensagem de teste
   * @param {string} chatId - ID do chat
   * @param {Object} testData - Dados de teste
   */
  async testWebhook(chatId, testData) {
    const config = this.webhooks.get(chatId);
    
    if (!config) {
      console.log(`⚠️ Nenhum webhook configurado para chat ${chatId}`);
      return false;
    }

    if (!config.active) {
      console.log(`⚠️ Webhook para chat ${chatId} está desativado`);
      return false;
    }

    console.log(`🧪 Testando webhook para chat ${chatId}...`);

    const payload = {
      ...testData,
      test: true,
      timestamp: new Date().toISOString()
    };

    try {
      await this.sendWebhook(config, payload);
      console.log(`✅ Teste de webhook bem-sucedido para ${chatId}`);
      return true;
    } catch (error) {
      console.error(`❌ Teste de webhook falhou para ${chatId}:`, error.message);
      return false;
    }
  }
}

module.exports = WebhookManager;