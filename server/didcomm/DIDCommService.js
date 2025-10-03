/**
 * Serviço DIDComm Simplificado
 * Versão básica que demonstra os conceitos sem dependências complexas
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

class DIDCommService {
  constructor() {
    this.serverDid = null;
    this.connectedClients = new Map();
    this.messageQueue = new Map();
    this.initialized = false;
  }

  /**
   * Inicializa o serviço DIDComm
   */
  async initialize() {
    try {
      logger.info('🔧 Inicializando serviço DIDComm...');

      // Gera um DID simplificado para o servidor
      this.serverDid = this.generateSimpleDID();
      
      this.initialized = true;
      logger.info(`✅ DIDComm inicializado. Servidor DID: ${this.serverDid}`);

    } catch (error) {
      logger.error('❌ Erro ao inicializar DIDComm:', error);
      throw error;
    }
  }

  /**
   * Gera um DID simplificado
   */
  generateSimpleDID() {
    const publicKey = crypto.randomBytes(32).toString('hex');
    return `did:key:z${publicKey}`;
  }

  /**
   * Registra um cliente
   */
  registerClient(client) {
    if (!client.did || !client.ws) {
      throw new Error('Cliente deve ter DID e WebSocket');
    }

    this.connectedClients.set(client.did, {
      ws: client.ws,
      registeredAt: new Date(),
      lastActivity: new Date()
    });

    logger.info(`👤 Cliente registrado: ${client.did}`);

    // Processa mensagens em fila para este cliente
    this.processQueuedMessages(client.did);
  }

  /**
   * Remove cliente
   */
  unregisterClient(did) {
    if (this.connectedClients.has(did)) {
      this.connectedClients.delete(did);
      logger.info(`👋 Cliente removido: ${did}`);
    }
  }

  /**
   * Envia mensagem criptografada
   */
  async sendEncryptedMessage(fromDid, toDid, message) {
    try {
      if (!this.initialized) {
        throw new Error('Serviço DIDComm não inicializado');
      }

      // Simula criptografia (em produção usaria DIDComm real)
      const encryptedMessage = {
        type: 'didcomm_encrypted',
        from: fromDid,
        to: toDid,
        content: this.simpleEncrypt(JSON.stringify(message)),
        timestamp: new Date().toISOString(),
        messageId: crypto.randomUUID()
      };

      const targetClient = this.connectedClients.get(toDid);
      
      if (targetClient && targetClient.ws.readyState === 1) {
        // Cliente online - envia diretamente
        targetClient.ws.send(JSON.stringify({
          type: 'didcomm_message',
          message: encryptedMessage
        }));
        
        logger.info(`📨 Mensagem enviada de ${fromDid} para ${toDid}`);
        return true;
      } else {
        // Cliente offline - adiciona à fila
        this.queueMessage(toDid, encryptedMessage);
        logger.info(`📬 Mensagem enfileirada para ${toDid}`);
        return false;
      }

    } catch (error) {
      logger.error('❌ Erro ao enviar mensagem:', error);
      throw error;
    }
  }

  /**
   * Processa mensagem recebida
   */
  async processReceivedMessage(fromDid, encryptedMessage) {
    try {
      // Simula descriptografia
      const decryptedContent = this.simpleDecrypt(encryptedMessage.content);
      const message = JSON.parse(decryptedContent);

      logger.info(`🔓 Mensagem descriptografada de ${fromDid}`);

      return {
        type: 'didcomm_decrypted',
        fromDid,
        content: message,
        timestamp: encryptedMessage.timestamp,
        messageId: encryptedMessage.messageId
      };

    } catch (error) {
      logger.error('❌ Erro ao processar mensagem:', error);
      throw error;
    }
  }

  /**
   * Criptografia simples para demonstração
   */
  simpleEncrypt(text) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync('didcomm-demo-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Descriptografia simples para demonstração
   */
  simpleDecrypt(encryptedText) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync('didcomm-demo-key', 'salt', 32);
    
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Adiciona mensagem à fila
   */
  queueMessage(toDid, message) {
    if (!this.messageQueue.has(toDid)) {
      this.messageQueue.set(toDid, []);
    }
    
    this.messageQueue.get(toDid).push(message);
    
    // Limita fila a 100 mensagens
    if (this.messageQueue.get(toDid).length > 100) {
      this.messageQueue.get(toDid).shift();
    }
  }

  /**
   * Processa mensagens em fila
   */
  processQueuedMessages(did) {
    const queuedMessages = this.messageQueue.get(did);
    
    if (queuedMessages && queuedMessages.length > 0) {
      const client = this.connectedClients.get(did);
      
      if (client && client.ws.readyState === 1) {
        queuedMessages.forEach(message => {
          client.ws.send(JSON.stringify({
            type: 'didcomm_message',
            message
          }));
        });
        
        logger.info(`📮 ${queuedMessages.length} mensagens em fila enviadas para ${did}`);
        this.messageQueue.delete(did);
      }
    }
  }

  /**
   * Obtém clientes conectados
   */
  getConnectedClients() {
    return Array.from(this.connectedClients.keys());
  }

  /**
   * Obtém DID do servidor
   */
  getServerDID() {
    return this.serverDid;
  }

  /**
   * Verifica se cliente está online
   */
  isClientOnline(did) {
    const client = this.connectedClients.get(did);
    return client && client.ws.readyState === 1;
  }

  /**
   * Atualiza atividade do cliente
   */
  updateClientActivity(did) {
    const client = this.connectedClients.get(did);
    if (client) {
      client.lastActivity = new Date();
    }
  }

  /**
   * Limpa recursos
   */
  cleanup() {
    // Limpa clientes conectados
    this.connectedClients.clear();
    
    // Limpa fila de mensagens
    this.messageQueue.clear();
    
    console.log('🧹 DIDComm Service limpo');
  }

  /**
   * Limpa recursos
   */
  cleanup() {
    // Limpa clientes conectados
    this.connectedClients.clear();
    
    // Limpa fila de mensagens
    this.messageQueue.clear();
    
    console.log('🧹 DIDComm Service limpo');
  }

  /**
   * Verifica se está inicializado
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Assina uma credencial (versão simplificada)
   * Na versão completa, usaria Veramo para assinar VCs
   */
  async signCredential(credential, issuerDid) {
    if (!this.initialized) {
      throw new Error('DIDComm Service não inicializado');
    }

    logger.info(`🔏 Assinando credencial para ${issuerDid}`);

    // Cria assinatura simplificada
    const credentialString = JSON.stringify(credential);
    const signature = crypto
      .createHmac('sha256', issuerDid)
      .update(credentialString)
      .digest('hex');

    // Retorna credencial com prova
    const signedCredential = {
      ...credential,
      proof: {
        type: 'JwtProof2020',
        created: new Date().toISOString(),
        proofPurpose: 'assertionMethod',
        verificationMethod: issuerDid,
        jwt: `eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSJ9.${Buffer.from(credentialString).toString('base64')}.${signature}`
      }
    };

    logger.info('✅ Credencial assinada com sucesso');
    return signedCredential;
  }

  /**
   * Demonstra uso do serviço
   */
  async demonstrateUsage() {
    console.log('\n🔐 === DEMONSTRAÇÃO DIDComm ===');
    console.log(`🖥️  Servidor DID: ${this.serverDid}`);
    console.log(`👥 Clientes conectados: ${this.getConnectedClients().length}`);
    
    // Simula clientes
    const client1Did = this.generateSimpleDID();
    const client2Did = this.generateSimpleDID();
    
    console.log(`👤 Cliente 1: ${client1Did}`);
    console.log(`👤 Cliente 2: ${client2Did}`);
    
    // Simula envio de mensagem
    const testMessage = { text: 'Olá! Esta é uma mensagem DIDComm segura.' };
    
    try {
      await this.sendEncryptedMessage(client1Did, client2Did, testMessage);
      console.log('✅ Mensagem enviada com sucesso');
    } catch (error) {
      console.log('❌ Erro ao enviar mensagem:', error.message);
    }
  }
}

module.exports = DIDCommService;