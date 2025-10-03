/**
 * Arquivo principal do servidor Chat Web5
 * 
 * Este arquivo inicializa todos os serviços do servidor:
 * - WebSocket Server para comunicação em tempo real
 * - Sistema de Webhook para notificações externas
 * - Logging e monitoramento
 */

const WebSocketServer = require('./websocket/WebSocketServer');

class ChatServer {
  constructor(options = {}) {
    this.options = {
      port: options.port || process.env.PORT || 8080,
      host: options.host || 'localhost',
      environment: options.environment || process.env.NODE_ENV || 'development',
      ...options
    };

    this.webSocketServer = null;
    this.isRunning = false;
  }

  /**
   * Inicia o servidor
   */
  async start() {
    try {
      console.log('🚀 Iniciando Chat Web5 Server...');
      console.log(`📍 Ambiente: ${this.options.environment}`);
      console.log(`🌐 Host: ${this.options.host}:${this.options.port}`);

      // Inicia o servidor WebSocket (agora é async)
      this.webSocketServer = new WebSocketServer(this.options.port, this.options.host);
      await this.webSocketServer.init(); // Espera inicialização completa
      
      this.isRunning = true;
      this.setupGracefulShutdown();
      
      console.log('✅ Chat Web5 Server iniciado com sucesso!');
      console.log('📊 Para ver estatísticas, acesse: http://localhost:8080/stats');
      
      // Log periódico de estatísticas
      this.startStatsLogging();

    } catch (error) {
      console.error('❌ Erro ao iniciar servidor:', error);
      process.exit(1);
    }
  }

  /**
   * Para o servidor
   */
  async stop() {
    if (!this.isRunning) return;

    console.log('🛑 Parando Chat Web5 Server...');
    
    if (this.webSocketServer) {
      this.webSocketServer.stop();
    }
    
    this.isRunning = false;
    console.log('✅ Servidor parado com sucesso');
  }

  /**
   * Configura shutdown graceful
   */
  setupGracefulShutdown() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGQUIT'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        console.log(`\n📋 Recebido sinal ${signal}, parando servidor...`);
        await this.stop();
        process.exit(0);
      });
    });

    // Trata erros não capturados
    process.on('uncaughtException', (error) => {
      console.error('❌ Erro não capturado:', error);
      this.stop().then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Promise rejeitada não tratada:', reason);
      this.stop().then(() => process.exit(1));
    });
  }

  /**
   * Inicia logging periódico de estatísticas
   */
  startStatsLogging() {
    if (this.options.environment === 'development') {
      setInterval(() => {
        if (this.webSocketServer && this.isRunning) {
          const stats = this.webSocketServer.getStats();
          console.log('📊 Stats:', {
            conexões: stats.totalConnections,
            usuáriosOnline: stats.onlineUsers,
            webhooks: stats.activeWebhooks,
            uptime: `${Math.floor(stats.uptime)}s`
          });
        }
      }, 60000); // A cada minuto
    }
  }

  /**
   * Obtém estatísticas do servidor
   */
  getStats() {
    if (!this.webSocketServer) return null;
    return this.webSocketServer.getStats();
  }

  /**
   * Verifica se o servidor está rodando
   */
  isHealthy() {
    return this.isRunning && this.webSocketServer;
  }
}

// Exporta a classe
module.exports = ChatServer;

// Se executado diretamente, inicia o servidor
if (require.main === module) {
  const server = new ChatServer({
    port: process.env.PORT || 8080,
    host: process.env.HOST || 'localhost',
    environment: process.env.NODE_ENV || 'development'
  });

  server.start().catch(error => {
    console.error('❌ Falha ao iniciar servidor:', error);
    process.exit(1);
  });
}