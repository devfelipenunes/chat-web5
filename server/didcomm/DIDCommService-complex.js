/**
 * Seconst { createAgent } = require('@      // Cria agente Veramo com configuração simplificada
      this.agent = createAgent({
        plugins: [
          new KeyManager({
            store: { 
              // Store simples em memória
              get: async (key) => this.keyStore.get(key),
              set: async (key, value) => this.keyStore.set(key, value),
              delete: async (key) => this.keyStore.delete(key),
              list: async () => Array.from(this.keyStore.keys())
            },
            kms: {
              local: new KeyManagementSystem({ 
                // Private key store simples
                get: async (key) => this.privateKeyStore.get(key),
                set: async (key, value) => this.privateKeyStore.set(key, value),
                delete: async (key) => this.privateKeyStore.delete(key),
                list: async () => Array.from(this.privateKeyStore.keys())
              }),
            },
          }),
          new DIDManager({
            store: {
              // DID store simples em memória
              get: async (did) => this.didStore.get(did),
              set: async (did, value) => this.didStore.set(did, value),
              delete: async (did) => this.didStore.delete(did),
              list: async () => Array.from(this.didStore.keys())
            },
            defaultProvider: 'did:key',
            providers: {
              'did:key': new (require('@veramo/did-provider-key')).KeyDIDProvider({
                defaultKms: 'local',
              }),
            },
          }),st { DIDManager } = require('@veramo/did-manager');
const { KeyManager } = require('@veramo/key-manager');
const { KeyManagementSystem } = require('@veramo/kms-local');
const { DIDResolverPlugin } = require('@veramo/did-resolver');
const { DIDCommMessageHandler } = require('@veramo/did-comm');
const { MessageHandler } = require('@veramo/message-handler');
const { Resolver } = require('did-resolver');
const { getResolver } = require('key-did-resolver');Comm para comunicação criptografada no WebSocket
 * 
 * Este serviço integra o DIDComm do Veramo para:
 * - Criptografar mensagens entre clientes
 * - Garantir autenticidade e integridade
 * - Suportar comunicação peer-to-peer segura
 */

const { createAgent } = require('@veramo/core');
const { DIDManager, MemoryDIDStore } = require('@veramo/did-manager');
const { KeyManager, MemoryKeyStore, MemoryPrivateKeyStore } = require('@veramo/kms-local');
const { KeyManagementSystem } = require('@veramo/kms-local');
const { DIDResolverPlugin } = require('@veramo/did-resolver');
const { DIDCommMessageHandler, DIDCommMessageMediator, IDIDComm } = require('@veramo/did-comm');
const { MessageHandler } = require('@veramo/message-handler');
const { Resolver } = require('did-resolver');
const { getResolver } = require('key-did-resolver');

class DIDCommService {
  constructor() {
    this.agent = null;
    this.serverDid = null;
    this.connectedClients = new Map();
    this.messageQueue = new Map();
    
    // Stores simples em memória
    this.keyStore = new Map();
    this.privateKeyStore = new Map();
    this.didStore = new Map();
  }

  /**
   * Inicializa o serviço DIDComm
   */
  async initialize() {
    try {
      console.log('🔐 Inicializando serviço DIDComm...');

      // Cria o agente Veramo com DIDComm
      this.agent = createAgent({
        plugins: [
          new KeyManager({
            store: new MemoryKeyStore(),
            kms: {
              local: new KeyManagementSystem(new MemoryPrivateKeyStore()),
            },
          }),
          new DIDManager({
            store: new MemoryDIDStore(),
            defaultProvider: 'did:key',
            providers: {
              'did:key': new (require('@veramo/did-provider-key')).KeyDIDProvider({
                defaultKms: 'local',
              }),
            },
          }),
          new DIDResolverPlugin({
            resolver: new Resolver({
              ...getResolver(),
            }),
          }),
          new MessageHandler({
            messageHandlers: [
              new DIDCommMessageHandler(),
            ],
          }),
        ],
      });

      // Cria ou recupera a identidade do servidor
      this.serverDid = await this.agent.didManagerGetOrCreate({
        alias: 'websocket-server',
        provider: 'did:key',
      });

      console.log(`✅ Servidor DIDComm inicializado com DID: ${this.serverDid.did}`);
      this.initialized = true;

    } catch (error) {
      console.error('❌ Erro ao inicializar DIDComm:', error);
      throw error;
    }
  }

  /**
   * Registra conexão de cliente com DID
   */
  async registerClient(clientDid, websocket) {
    if (!this.initialized) {
      throw new Error('Serviço DIDComm não inicializado');
    }

    try {
      // Resolve o DID do cliente para obter chaves públicas
      const didDocument = await this.agent.resolveDid({ didUrl: clientDid });
      
      this.activeConnections.set(clientDid, {
        websocket,
        didDocument: didDocument.didDocument,
        registeredAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      });

      console.log(`🔗 Cliente DIDComm registrado: ${clientDid}`);
      
      // Processa mensagens em fila se houver
      await this.processQueuedMessages(clientDid);

    } catch (error) {
      console.error(`❌ Erro ao registrar cliente ${clientDid}:`, error);
      throw error;
    }
  }

  /**
   * Remove registro de cliente
   */
  unregisterClient(clientDid) {
    this.activeConnections.delete(clientDid);
    console.log(`📤 Cliente DIDComm desregistrado: ${clientDid}`);
  }

  /**
   * Envia mensagem criptografada via DIDComm
   */
  async sendEncryptedMessage(fromDid, toDid, messageContent, messageType = 'chat') {
    if (!this.initialized) {
      throw new Error('Serviço DIDComm não inicializado');
    }

    try {
      // Cria mensagem DIDComm
      const message = {
        type: `https://chat-web5.com/${messageType}`,
        id: this.generateMessageId(),
        from: fromDid,
        to: [toDid],
        created_time: Date.now(),
        body: messageContent,
      };

      // Criptografa a mensagem
      const encryptedMessage = await this.agent.packDIDCommMessage({
        packing: 'authcrypt',
        message,
      });

      // Envia via WebSocket se o destinatário estiver online
      const targetConnection = this.activeConnections.get(toDid);
      if (targetConnection && targetConnection.websocket.readyState === 1) {
        targetConnection.websocket.send(JSON.stringify({
          type: 'didcomm_message',
          encrypted: true,
          message: encryptedMessage,
          timestamp: new Date().toISOString()
        }));

        // Atualiza última atividade
        targetConnection.lastActivity = new Date().toISOString();
        
        console.log(`📨 Mensagem DIDComm enviada: ${fromDid} -> ${toDid}`);
        return true;
      } else {
        // Adiciona à fila para quando o usuário ficar online
        await this.queueMessage(toDid, encryptedMessage);
        console.log(`📬 Mensagem DIDComm enfileirada para ${toDid}`);
        return false;
      }

    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem DIDComm:`, error);
      throw error;
    }
  }

  /**
   * Processa mensagem DIDComm recebida
   */
  async processReceivedMessage(encryptedMessage, receiverDid) {
    if (!this.initialized) {
      throw new Error('Serviço DIDComm não inicializado');
    }

    try {
      // Descriptografa a mensagem
      const unpackedMessage = await this.agent.unpackDIDCommMessage({
        message: encryptedMessage,
      });

      // Processa baseado no tipo
      const messageType = unpackedMessage.message.type;
      
      if (messageType.includes('chat')) {
        return {
          type: 'chat_message',
          from: unpackedMessage.message.from,
          to: unpackedMessage.message.to[0],
          content: unpackedMessage.message.body,
          timestamp: new Date(unpackedMessage.message.created_time).toISOString(),
          encrypted: true
        };
      }

      return unpackedMessage.message;

    } catch (error) {
      console.error('❌ Erro ao processar mensagem DIDComm:', error);
      throw error;
    }
  }

  /**
   * Enfileira mensagem para usuário offline
   */
  async queueMessage(toDid, encryptedMessage) {
    if (!this.messageQueue.has(toDid)) {
      this.messageQueue.set(toDid, []);
    }

    this.messageQueue.get(toDid).push({
      message: encryptedMessage,
      timestamp: new Date().toISOString()
    });

    // Limita o tamanho da fila (máximo 100 mensagens)
    const queue = this.messageQueue.get(toDid);
    if (queue.length > 100) {
      queue.splice(0, queue.length - 100);
    }
  }

  /**
   * Processa mensagens enfileiradas quando usuário fica online
   */
  async processQueuedMessages(clientDid) {
    const queue = this.messageQueue.get(clientDid);
    if (!queue || queue.length === 0) {
      return;
    }

    const connection = this.activeConnections.get(clientDid);
    if (!connection) {
      return;
    }

    console.log(`📬 Processando ${queue.length} mensagens enfileiradas para ${clientDid}`);

    for (const queuedMessage of queue) {
      try {
        connection.websocket.send(JSON.stringify({
          type: 'didcomm_message',
          encrypted: true,
          message: queuedMessage.message,
          timestamp: queuedMessage.timestamp,
          queued: true
        }));
      } catch (error) {
        console.error('❌ Erro ao enviar mensagem da fila:', error);
      }
    }

    // Limpa a fila
    this.messageQueue.delete(clientDid);
  }

  /**
   * Broadcast de mensagem criptografada para múltiplos destinatários
   */
  async broadcastEncryptedMessage(fromDid, toDids, messageContent, messageType = 'broadcast') {
    const results = [];

    for (const toDid of toDids) {
      try {
        const sent = await this.sendEncryptedMessage(fromDid, toDid, messageContent, messageType);
        results.push({ toDid, sent, error: null });
      } catch (error) {
        results.push({ toDid, sent: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Obtém informações de conexão de um cliente
   */
  getClientConnection(clientDid) {
    return this.activeConnections.get(clientDid);
  }

  /**
   * Lista todos os clientes conectados
   */
  getConnectedClients() {
    return Array.from(this.activeConnections.keys());
  }

  /**
   * Verifica se um cliente está online
   */
  isClientOnline(clientDid) {
    const connection = this.activeConnections.get(clientDid);
    return connection && connection.websocket.readyState === 1;
  }

  /**
   * Gera ID único para mensagem
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Limpa conexões órfãs
   */
  cleanup() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutos

    for (const [clientDid, connection] of this.activeConnections) {
      const lastActivity = new Date(connection.lastActivity).getTime();
      
      if (now - lastActivity > timeout || connection.websocket.readyState !== 1) {
        console.log(`🧹 Removendo conexão órfã: ${clientDid}`);
        this.unregisterClient(clientDid);
      }
    }
  }

  /**
   * Obtém estatísticas do serviço
   */
  getStats() {
    return {
      initialized: this.initialized,
      serverDid: this.serverDid?.did,
      activeConnections: this.activeConnections.size,
      queuedMessages: Array.from(this.messageQueue.values()).reduce((total, queue) => total + queue.length, 0),
      connectedClients: this.getConnectedClients()
    };
  }
}

module.exports = DIDCommService;