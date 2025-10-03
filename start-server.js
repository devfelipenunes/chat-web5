const ChatServer = require('./server/index');

const config = {
  port: process.env.PORT || 8080,
  host: process.env.HOST || '0.0.0.0',
  environment: process.env.NODE_ENV || 'development'
};

console.log('🚀 === INICIANDO CHAT WEB5 SERVER ===');
console.log(`📍 Porta: ${config.port}`);
console.log(`🌐 Host: ${config.host}`);
console.log(`⚙️  Ambiente: ${config.environment}`);
console.log('=======================================\n');

const server = new ChatServer(config);

server.start().then(() => {
  console.log('\n✅ Servidor iniciado com sucesso!');
  console.log(`🔗 WebSocket: ws://${config.host}:${config.port}`);
  console.log('📋 Use Ctrl+C para parar o servidor');
  console.log('🔍 Logs em tempo real aparecem abaixo...\n');
}).catch(error => {
  console.error('❌ Erro ao iniciar servidor:', error);
  process.exit(1);
});