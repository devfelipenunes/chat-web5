/**
 * Cliente de exemplo simplificado para demonstrar DIDComm e criptografia de credenciais
 */

const WebSocket = require('ws');
const crypto = require('crypto');
const CredentialCryptoService = require('../crypto/CredentialCryptoService');

class ChatClient {
  constructor(serverUrl = 'ws://localhost:8080') {
    this.serverUrl = serverUrl;
    this.ws = null;
    this.userDid = null;
    this.serverDid = null;
    this.cryptoService = new CredentialCryptoService();
    this.connected = false;
    this.authenticated = false;
  }

  /**
   * Inicializa o cliente
   */
  async initialize() {
    try {
      console.log('🔧 Inicializando cliente...');

      // Gera DID simplificado
      this.userDid = this.generateSimpleDID();
      console.log(`👤 Identidade criada: ${this.userDid}`);

    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
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
   * Conecta ao servidor WebSocket
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.on('open', () => {
          console.log('✅ Conectado ao servidor');
          this.connected = true;
          this.authenticate();
          resolve();
        });

        this.ws.on('message', (data) => {
          this.handleMessage(JSON.parse(data));
        });

        this.ws.on('close', () => {
          console.log('❌ Desconectado do servidor');
          this.connected = false;
          this.authenticated = false;
        });

        this.ws.on('error', (error) => {
          console.error('❌ Erro na conexão:', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Autentica com o servidor
   */
  authenticate() {
    this.send({
      type: 'authenticate',
      did: this.userDid
    });
  }

  /**
   * Manipula mensagens recebidas
   */
  async handleMessage(message) {
    console.log('📨 Mensagem recebida:', message.type);

    switch (message.type) {
      case 'authenticated':
        this.authenticated = true;
        this.serverDid = message.serverDid;
        console.log(`🔐 Autenticado! Servidor DID: ${this.serverDid}`);
        console.log(`🎯 DIDComm habilitado: ${message.didcommEnabled}`);
        break;

      case 'didcomm_message':
        await this.handleDIDCommMessage(message);
        break;

      case 'didcomm_decrypted':
        console.log('🔓 Mensagem descriptografada recebida:', message);
        break;

      case 'encrypted_chat_sent':
        console.log(`✅ Chat criptografado enviado para ${message.toDid}`);
        break;

      case 'user_online':
        console.log(`🟢 Usuário online: ${message.did}`);
        break;

      case 'user_offline':
        console.log(`🔴 Usuário offline: ${message.did}`);
        break;

      case 'error':
      case 'auth_error':
      case 'didcomm_error':
      case 'encrypted_chat_error':
        console.error(`❌ Erro: ${message.message}`);
        break;

      default:
        console.log('📋 Mensagem não tratada:', message);
    }
  }

  /**
   * Manipula mensagem DIDComm criptografada
   */
  async handleDIDCommMessage(message) {
    try {
      console.log('🔓 Mensagem DIDComm recebida:', message.message);
      
      // Em uma implementação real, aqui descriptografaríamos a mensagem
      // Por agora, apenas logamos
      
    } catch (error) {
      console.error('❌ Erro ao manipular DIDComm:', error);
    }
  }

  /**
   * Envia mensagem normal
   */
  send(message) {
    if (this.connected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('❌ Cliente não conectado');
    }
  }

  /**
   * Envia mensagem de chat normal
   */
  sendChatMessage(chatId, content) {
    this.send({
      type: 'chat_message',
      chatId,
      content,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Envia mensagem de chat criptografada
   */
  sendEncryptedChat(toDid, content, chatId = null) {
    if (!this.authenticated) {
      console.error('❌ Cliente não autenticado');
      return;
    }

    this.send({
      type: 'encrypted_chat',
      toDid,
      content,
      chatId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Demonstra armazenamento criptográfico de credencial
   */
  async demonstrateCredentialStorage() {
    console.log('\n🔐 === DEMONSTRAÇÃO DE CRIPTOGRAFIA DE CREDENCIAIS ===');

    try {
      // Exemplo de credencial
      const credential = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'ChatRoomCredential'],
        issuer: this.userDid,
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: this.userDid,
          chatId: 'chat-exemplo-123',
          role: 'owner',
          permissions: ['read', 'write', 'admin']
        }
      };

      console.log('📝 Credencial original:', credential);

      // Criptografa
      const encrypted = await this.cryptoService.encryptCredential(this.userDid, credential);
      console.log('🔒 Credencial criptografada (resumo):', {
        algorithm: encrypted.algorithm,
        userDid: encrypted.userDid,
        encryptedSize: encrypted.encrypted.length,
        createdAt: encrypted.createdAt
      });

      // Descriptografa
      const decrypted = await this.cryptoService.decryptCredential(this.userDid, encrypted);
      console.log('🔓 Credencial descriptografada:', decrypted);

      // Valida integridade
      const validation = await this.cryptoService.validateCredentialIntegrity(encrypted);
      console.log('✅ Validação de integridade:', validation);

      // Demonstra backup
      const credentials = [credential];
      const backup = await this.cryptoService.createEncryptedBackup(
        this.userDid, 
        credentials, 
        'senha-super-secreta'
      );
      console.log('💾 Backup criptografado criado');

      // Restaura backup
      const restored = await this.cryptoService.restoreEncryptedBackup(
        this.userDid, 
        backup, 
        'senha-super-secreta'
      );
      console.log('📥 Backup restaurado:', restored.length, 'credenciais');

    } catch (error) {
      console.error('❌ Erro na demonstração:', error);
    }
  }

  /**
   * Desconecta do servidor
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Exemplo de uso
async function exemploUso() {
  const client1 = new ChatClient();
  const client2 = new ChatClient();

  try {
    // Inicializa clientes
    await client1.initialize();
    await client2.initialize();

    console.log('\n🚀 === DEMONSTRAÇÃO COMPLETA ===');
    console.log(`👤 Cliente 1 DID: ${client1.userDid}`);
    console.log(`👤 Cliente 2 DID: ${client2.userDid}`);

    // Conecta clientes
    await client1.connect();
    await client2.connect();

    // Aguarda autenticação
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Envia mensagem normal
    console.log('\n📨 Enviando mensagem normal...');
    client1.sendChatMessage('chat-teste', 'Olá mundo!');

    // Envia mensagem criptografada
    console.log('\n🔐 Enviando mensagem criptografada...');
    client1.sendEncryptedChat(client2.userDid, 'Mensagem secreta!', 'chat-privado');

    // Demonstra criptografia de credenciais
    await client1.demonstrateCredentialStorage();

    // Aguarda um pouco antes de desconectar
    setTimeout(() => {
      console.log('\n👋 Desconectando clientes...');
      client1.disconnect();
      client2.disconnect();
    }, 3000);

  } catch (error) {
    console.error('❌ Erro no exemplo:', error);
  }
}

// Executa exemplo se for chamado diretamente
if (require.main === module) {
  exemploUso().catch(console.error);
}

module.exports = ChatClient;