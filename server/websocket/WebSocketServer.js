const WebSocket = require('ws');
const WebhookManager = require('../webhook/WebhookManager');
const DIDCommService = require('../didcomm/DIDCommService');

class WebSocketServer {
  constructor(port = 8080, host = '0.0.0.0') { // Mudou de 'localhost' para '0.0.0.0'
    this.port = port;
    this.host = host;
    this.wss = null;
    this.webhookManager = new WebhookManager();
    this.didCommService = new DIDCommService();
    
    this.clients = new Set();
    this.clientDids = new Map(); 
    this.onlineUsers = new Map();
    this.isInitialized = false;

  }

  /**
   * Inicializa o servidor WebSocket
   */
  async init() {
    if (this.isInitialized) {
      console.log('⚠️  WebSocket Server já foi inicializado');
      return;
    }

    try {
      // Inicializa DIDComm primeiro
      await this.didCommService.initialize();
      
      this.wss = new WebSocket.Server({ 
        port: this.port,
        host: this.host
      });

      console.log(`🚀 WebSocket server listening on port ${this.port}`);
      console.log('🔗 Sistema de webhooks ativo');
      console.log('🔐 DIDComm habilitado');

      this.setupEventHandlers();
      this.isInitialized = true;
      
    } catch (error) {
      console.error('❌ Erro no servidor WebSocket:', error);
      throw error;
    }
  }

  /**
   * Configura os manipuladores de eventos
   */
  setupEventHandlers() {
    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      console.error('❌ Erro no servidor WebSocket:', error);
    });

    // Limpeza periódica de conexões órfãs
    setInterval(() => {
      this.cleanupConnections();
    }, 30000);
  }

  /**
   * Manipula nova conexão
   */
  handleConnection(ws, request) {
    const clientId = this.generateClientId();
    this.clients.add(ws);
    
    console.log(`✅ Cliente conectado: ${clientId} (Total: ${this.clients.size})`);
    console.log(`   IP: ${request.socket.remoteAddress}`);

    // Configura eventos do cliente
    this.setupClientEvents(ws, clientId);

    // Envia mensagem de boas-vindas
    this.sendToClient(ws, {
      type: 'connection_established',
      clientId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Configura eventos específicos do cliente
   */
  setupClientEvents(ws, clientId) {
    ws.on('message', (data) => {
      this.handleMessage(ws, data, clientId);
    });

    ws.on('close', () => {
      this.handleDisconnection(ws, clientId);
    });

    ws.on('error', (error) => {
      console.error(`❌ Erro no cliente ${clientId}:`, error);
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });
  }

  /**
   * Manipula mensagem recebida do cliente
   */
  async handleMessage(ws, data, clientId) {
    try {
      const message = JSON.parse(data);
      console.log(`📨 Mensagem recebida de ${clientId}:`, message.type);

      switch (message.type) {
        case 'authenticate':
        case 'auth': // Compatibilidade com frontend
          this.handleAuthentication(ws, message, clientId);
          break;

        case 'chat_message':
          await this.handleChatMessage(ws, message, clientId);
          break;

        case 'didcomm_message':
          await this.handleDIDCommMessage(ws, message, clientId);
          break;

        case 'encrypted_chat':
          await this.handleEncryptedChat(ws, message, clientId);
          break;

        case 'register_webhook':
          this.handleWebhookRegistration(ws, message, clientId);
          break;

        case 'remove_webhook':
          this.handleWebhookRemoval(ws, message, clientId);
          break;

        case 'create_invite':
          await this.handleCreateInvite(ws, message, clientId);
          break;

        case 'use_invite':
          await this.handleUseInvite(ws, message, clientId);
          break;

        case 'revoke_invite':
          await this.handleRevokeInvite(ws, message, clientId);
          break;

        case 'list_invites':
          await this.handleListInvites(ws, message, clientId);
          break;

        case 'configure_webhook':
          await this.handleConfigureWebhook(ws, message, clientId);
          break;

        case 'test_webhook':
          await this.handleTestWebhook(ws, message, clientId);
          break;

        case 'ping':
          this.handlePing(ws, clientId);
          break;

        default:
          console.log(`⚠️ Tipo de mensagem desconhecido: ${message.type}`);
      }
    } catch (error) {
      console.error(`❌ Erro ao processar mensagem de ${clientId}:`, error);
      this.sendToClient(ws, {
        type: 'error',
        message: 'Formato de mensagem inválido'
      });
    }
  }

  /**
   * Manipula autenticação do usuário
   */
  async handleAuthentication(ws, message, clientId) {
    const { did } = message;
    
    if (!did) {
      this.sendToClient(ws, {
        type: 'auth_error',
        message: 'DID é obrigatório'
      });
      return;
    }

    try {
      // Armazena o DID do cliente
      this.clientDids.set(ws, did);
      
      // Registra no serviço DIDComm
      this.didCommService.registerClient({ did, ws });
      
      // Atualiza status online
      this.setUserOnline(did, ws);

      // Confirma autenticação
      this.sendToClient(ws, {
        type: 'authenticated',
        did,
        didcommEnabled: true,
        serverDid: this.didCommService.serverDid?.did,
        timestamp: new Date().toISOString()
      });

      // Notifica outros clientes sobre usuário online
      this.broadcastUserOnline(did);
      
      console.log(`🔐 Cliente ${clientId} autenticado como ${did}`);
    } catch (error) {
      console.error(`❌ Erro na autenticação ${clientId}:`, error);
      this.sendToClient(ws, {
        type: 'auth_error',
        message: 'Falha na autenticação DIDComm'
      });
    }
  }

  /**
   * Manipula mensagem de chat
   */
  async handleChatMessage(ws, message, clientId) {
    const senderDid = this.clientDids.get(ws);
    
    if (!senderDid) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Cliente não autenticado'
      });
      return;
    }

    // Adiciona metadados à mensagem
    const enrichedMessage = {
      ...message,
      sender: senderDid,
      timestamp: new Date().toISOString(),
      clientId
    };

    // Retransmite para todos os clientes
    this.broadcast(enrichedMessage);

    // Dispara webhook se configurado
    if (message.chatId) {
      await this.webhookManager.triggerWebhook(message.chatId, enrichedMessage);
    }

    console.log(`💬 Mensagem de chat retransmitida: ${senderDid} -> ${message.chatId}`);
  }

  /**
   * Manipula registro de webhook
   */
  handleWebhookRegistration(ws, message, clientId) {
    const senderDid = this.clientDids.get(ws);
    
    if (!senderDid) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Cliente não autenticado'
      });
      return;
    }

    try {
      const webhook = this.webhookManager.registerWebhook(
        message.chatId,
        senderDid,
        message.webhook
      );

      this.sendToClient(ws, {
        type: 'webhook_registered',
        chatId: message.chatId,
        webhook: {
          url: webhook.url,
          secret: webhook.secret,
          active: webhook.active
        }
      });

      console.log(`🔗 Webhook registrado: ${message.chatId} por ${senderDid}`);
    } catch (error) {
      this.sendToClient(ws, {
        type: 'webhook_error',
        message: error.message
      });
    }
  }

  /**
   * Manipula remoção de webhook
   */
  handleWebhookRemoval(ws, message, clientId) {
    const senderDid = this.clientDids.get(ws);
    
    if (!senderDid) {
      this.sendToClient(ws, {
        type: 'error', 
        message: 'Cliente não autenticado'
      });
      return;
    }

    try {
      this.webhookManager.removeWebhook(message.chatId, senderDid);
      
      this.sendToClient(ws, {
        type: 'webhook_removed',
        chatId: message.chatId
      });

      console.log(`🗑️ Webhook removido: ${message.chatId} por ${senderDid}`);
    } catch (error) {
      this.sendToClient(ws, {
        type: 'webhook_error',
        message: error.message
      });
    }
  }

  /**
   * Manipula mensagem DIDComm criptografada recebida
   */
  async handleDIDCommMessage(ws, message, clientId) {
    const senderDid = this.clientDids.get(ws);
    
    if (!senderDid) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Cliente não autenticado'
      });
      return;
    }

    try {
      // Processa mensagem DIDComm criptografada
      const decryptedMessage = await this.didCommService.processReceivedMessage(
        message.encryptedMessage, 
        senderDid
      );

      // Retransmite mensagem descriptografada
      this.broadcast({
        type: 'didcomm_decrypted',
        ...decryptedMessage,
        clientId
      });

      console.log(`💬 Mensagem DIDComm processada: ${senderDid}`);
    } catch (error) {
      console.error(`❌ Erro ao processar DIDComm de ${clientId}:`, error);
      this.sendToClient(ws, {
        type: 'didcomm_error',
        message: 'Falha ao processar mensagem criptografada'
      });
    }
  }

  /**
   * Manipula envio de chat criptografado com DIDComm
   */
  async handleEncryptedChat(ws, message, clientId) {
    const senderDid = this.clientDids.get(ws);
    
    if (!senderDid) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Cliente não autenticado'
      });
      return;
    }

    const { chatId, encryptedPayload, timestamp } = message;
    
    if (!chatId || !encryptedPayload) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'chatId e encryptedPayload são obrigatórios'
      });
      return;
    }

    console.log(`🔐 Repassando mensagem criptografada no chat ${chatId}`);

    try {
      // Broadcast mensagem criptografada para todos os clientes conectados
      // (cada cliente vai descriptografar localmente se tiver as chaves)
      this.clients.forEach(client => {
        if (client !== ws && client.readyState === 1) {
          const clientDid = this.clientDids.get(client);
          if (clientDid) {
            this.sendToClient(client, {
              type: 'encrypted_chat',
              chatId,
              encryptedPayload,
              sender: senderDid,
              timestamp,
              clientId: clientId
            });
          }
        }
      });

      // Confirma envio ao remetente
      this.sendToClient(ws, {
        type: 'encrypted_chat_sent',
        chatId,
        sent: true,
        timestamp: new Date().toISOString()
      });

      // Dispara webhook se configurado
      if (chatId) {
        await this.webhookManager.triggerWebhook(chatId, {
          type: 'encrypted_message',
          from: senderDid,
          to: toDid,
          encrypted: true,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🔐 Chat criptografado enviado: ${senderDid} -> ${toDid}`);
    } catch (error) {
      console.error(`❌ Erro no chat criptografado de ${clientId}:`, error);
      this.sendToClient(ws, {
        type: 'encrypted_chat_error',
        message: 'Falha ao enviar mensagem criptografada'
      });
    }
  }

  /**
   * Manipula desconexão do cliente
   */
  handleDisconnection(ws, clientId) {
    const did = this.clientDids.get(ws);
    
    this.clients.delete(ws);
    this.clientDids.delete(ws);
    
    if (did) {
      // Remove do DIDComm
      this.didCommService.unregisterClient(did);
      
      this.setUserOffline(did, ws);
      this.broadcastUserOffline(did);
    }

    console.log(`❌ Cliente desconectado: ${clientId} (Total: ${this.clients.size})`);
    if (did) {
      console.log(`   DID: ${did}`);
    }
  }

  /**
   * Manipula ping
   */
  handlePing(ws, clientId) {
    this.sendToClient(ws, {
      type: 'pong',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Define usuário como online
   */
  setUserOnline(did, ws) {
    if (!this.onlineUsers.has(did)) {
      this.onlineUsers.set(did, {
        lastSeen: new Date().toISOString(),
        clientIds: new Set()
      });
    }
    
    this.onlineUsers.get(did).clientIds.add(ws);
    this.onlineUsers.get(did).lastSeen = new Date().toISOString();
  }

  /**
   * Define usuário como offline
   */
  setUserOffline(did, ws) {
    const userInfo = this.onlineUsers.get(did);
    if (userInfo) {
      userInfo.clientIds.delete(ws);
      if (userInfo.clientIds.size === 0) {
        this.onlineUsers.delete(did);
      }
    }
  }

  /**
   * Notifica usuário online
   */
  broadcastUserOnline(did) {
    this.broadcast({
      type: 'user_online',
      did,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Notifica usuário offline
   */
  broadcastUserOffline(did) {
    if (!this.onlineUsers.has(did)) {
      this.broadcast({
        type: 'user_offline',
        did,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Envia mensagem para cliente específico
   */
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Faz broadcast de mensagem para todos os clientes
   */
  broadcast(message) {
    const messageStr = JSON.stringify(message);
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  /**
   * Limpa conexões órfãs
   */
  cleanupConnections() {
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.CLOSED) {
        const did = this.clientDids.get(client);
        if (did) {
          this.didCommService.unregisterClient(did);
        }
        this.clients.delete(client);
        this.clientDids.delete(client);
      } else {
        // Ping para verificar se está vivo
        client.isAlive = false;
        client.ping();
        
        setTimeout(() => {
          if (!client.isAlive) {
            console.log('🧹 Removendo conexão morta');
            client.terminate();
          }
        }, 5000);
      }
    });
    
    // Cleanup do DIDComm
    this.didCommService.cleanup();
  }

  /**
   * Gera ID único para cliente
   */
  generateClientId() {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Manipula criação de convite
   */
  async handleCreateInvite(ws, message, clientId) {
    const { chatId, invite } = message;
    const issuerDid = this.clientDids.get(ws);

    if (!issuerDid || !chatId || !invite) {
      this.sendToClient(ws, {
        type: 'error',
        inviteId: invite?.inviteId,
        message: 'DID, chatId ou invite não fornecido'
      });
      return;
    }

    console.log(`📨 Criando convite para chat ${chatId} por ${issuerDid}`);

    try {
      // Assina a credencial com o DIDComm service
      const signedCredential = await this.didCommService.signCredential(
        invite.credential,
        issuerDid
      );

      // Envia resposta com credencial assinada
      this.sendToClient(ws, {
        type: 'invite_created',
        inviteId: invite.inviteId,
        chatId,
        credential: signedCredential
      });

      console.log(`✅ Convite ${invite.inviteId} criado com sucesso`);
    } catch (error) {
      console.error('❌ Erro ao criar convite:', error);
      this.sendToClient(ws, {
        type: 'error',
        inviteId: invite?.inviteId,
        message: `Erro ao criar convite: ${error.message}`
      });
    }
  }

  /**
   * Manipula uso de convite
   */
  async handleUseInvite(ws, message, clientId) {
    const { inviteId, userDid } = message;

    if (!inviteId || !userDid) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'inviteId ou userDid não fornecido'
      });
      return;
    }

    console.log(`🎟️ Usuário ${userDid} usando convite ${inviteId}`);

    // Aqui você implementaria a lógica de validação
    // Por enquanto, simula sucesso
    this.sendToClient(ws, {
      type: 'invite_used',
      inviteId,
      success: true
    });
  }

  /**
   * Manipula revogação de convite
   */
  async handleRevokeInvite(ws, message, clientId) {
    const { inviteId } = message;

    if (!inviteId) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'inviteId não fornecido'
      });
      return;
    }

    console.log(`🚫 Revogando convite ${inviteId}`);

    this.sendToClient(ws, {
      type: 'invite_revoked',
      inviteId,
      success: true
    });
  }

  /**
   * Manipula listagem de convites
   */
  async handleListInvites(ws, message, clientId) {
    const { chatId } = message;

    if (!chatId) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'chatId não fornecido'
      });
      return;
    }

    console.log(`📋 Listando convites do chat ${chatId}`);

    // Por enquanto retorna array vazio
    this.sendToClient(ws, {
      type: 'invites_list',
      chatId,
      invites: []
    });
  }

  /**
   * Manipula configuração de webhook
   */
  async handleConfigureWebhook(ws, message, clientId) {
    const { chatId, webhook } = message;
    const ownerDid = this.clientDids.get(ws);

    if (!ownerDid || !chatId || !webhook) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'DID, chatId ou webhook não fornecido'
      });
      return;
    }

    console.log(`🔗 Configurando webhook para chat ${chatId}`);

    try {
      // Registra webhook
      await this.webhookManager.registerWebhook(chatId, {
        url: webhook.url,
        events: webhook.events || [],
        ownerDid
      });

      this.sendToClient(ws, {
        type: 'webhook_configured',
        chatId,
        success: true
      });

      console.log(`✅ Webhook configurado para ${chatId}`);
    } catch (error) {
      console.error('❌ Erro ao configurar webhook:', error);
      this.sendToClient(ws, {
        type: 'error',
        message: `Erro ao configurar webhook: ${error.message}`
      });
    }
  }

  /**
   * Manipula teste de webhook
   */
  async handleTestWebhook(ws, message, clientId) {
    const { chatId } = message;
    const ownerDid = this.clientDids.get(ws);

    if (!ownerDid || !chatId) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'DID ou chatId não fornecido'
      });
      return;
    }

    console.log(`🧪 Testando webhook do chat ${chatId}`);

    try {
      // Envia teste para o webhook
      const success = await this.webhookManager.testWebhook(chatId, {
        type: 'test',
        chatId,
        message: 'Teste de webhook',
        timestamp: new Date().toISOString()
      });

      this.sendToClient(ws, {
        type: 'webhook_test_result',
        chatId,
        success
      });

      console.log(`✅ Teste de webhook ${success ? 'bem-sucedido' : 'falhou'}`);
    } catch (error) {
      console.error('❌ Erro ao testar webhook:', error);
      this.sendToClient(ws, {
        type: 'webhook_test_result',
        chatId,
        success: false
      });
    }
  }

  /**
   * Obtém estatísticas do servidor
   */
  getStats() {
    return {
      totalConnections: this.clients.size,
      onlineUsers: this.onlineUsers.size,
      activeWebhooks: this.webhookManager.listWebhooks().length,
      uptime: process.uptime(),
      didcomm: {
        enabled: this.didCommService.isInitialized(),
        registeredClients: this.clientDids.size
      }
    };
  }

  /**
   * Para o servidor
   */
  stop() {
    console.log('🛑 Parando servidor WebSocket...');
    this.wss.close(() => {
      console.log('✅ Servidor WebSocket parado');
    });
  }
}

// Exporta a classe e inicia o servidor se executado diretamente
module.exports = WebSocketServer;

if (require.main === module) {
  new WebSocketServer();
}