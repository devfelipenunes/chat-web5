# 🚀 Chat Web5 Server

Servidor backend para o sistema de chat Web5 com suporte a WebSocket e Webhooks.

## 📁 Estrutura do Servidor

```
server/
├── index.js                    # Arquivo principal do servidor
├── websocket/
│   └── WebSocketServer.js      # Servidor WebSocket
├── webhook/
│   └── WebhookManager.js       # Gerenciador de webhooks
└── utils/
    └── helpers.js              # Utilitários compartilhados
```

## 🚀 Como Usar

### Desenvolvimento
```bash
# Instalar dependências
npm install

# Iniciar servidor em modo desenvolvimento
npm run server:dev

# Ou iniciar manualmente
npm run server
```

### Produção
```bash
# Iniciar em modo produção
npm run server:prod

# Com variáveis de ambiente customizadas
PORT=8080 HOST=0.0.0.0 NODE_ENV=production npm run server:prod
```

## 🔧 Configuração

### Variáveis de Ambiente

- `PORT` - Porta do servidor (padrão: 8080)
- `HOST` - Host do servidor (padrão: localhost)
- `NODE_ENV` - Ambiente (development/production)

### Exemplo de uso:
```bash
export PORT=8080
export HOST=0.0.0.0
export NODE_ENV=production
npm run server
```

## 📡 Funcionalidades

### WebSocket Server
- ✅ Conexões em tempo real
- ✅ Autenticação via DID
- ✅ Retransmissão de mensagens
- ✅ Tracking de usuários online
- ✅ Sistema de ping/pong para manter conexões vivas

### Webhook Manager
- ✅ Registro/remoção de webhooks por chat
- ✅ Autenticação HMAC SHA-256
- ✅ Sistema de retry com backoff exponencial
- ✅ Validação de permissões (apenas donos podem configurar)

### Utilitários
- ✅ Rate limiting
- ✅ Logger com níveis
- ✅ Helpers para criptografia
- ✅ Validação de URLs e DIDs

## 📊 Monitoramento

O servidor fornece estatísticas em tempo real:

```javascript
// Estatísticas disponíveis
{
  totalConnections: 5,      // Total de conexões ativas
  onlineUsers: 3,          // Usuários únicos online
  activeWebhooks: 2,       // Webhooks ativos
  uptime: 1234            // Tempo de atividade em segundos
}
```

Em modo desenvolvimento, as estatísticas são logadas a cada minuto.

## 🔌 API WebSocket

### Conexão
```javascript
const ws = new WebSocket('ws://localhost:8080');
```

### Mensagens Suportadas

#### Autenticação
```javascript
ws.send(JSON.stringify({
  type: 'authenticate',
  did: 'did:key:z6Mk...'
}));
```

#### Enviar Mensagem de Chat
```javascript
ws.send(JSON.stringify({
  type: 'chat_message',
  chatId: 'chat-123',
  content: 'Olá mundo!',
  timestamp: new Date().toISOString()
}));
```

#### Registrar Webhook
```javascript
ws.send(JSON.stringify({
  type: 'register_webhook',
  chatId: 'chat-123',
  webhook: {
    url: 'https://api.exemplo.com/webhook',
    secret: 'minha-chave-secreta',
    retryAttempts: 3,
    timeout: 5000
  }
}));
```

#### Remover Webhook
```javascript
ws.send(JSON.stringify({
  type: 'remove_webhook',
  chatId: 'chat-123'
}));
```

## 🔒 Segurança

### Webhooks
- Assinatura HMAC SHA-256 em todas as requisições
- Validação de permissões (apenas donos podem configurar)
- Rate limiting para prevenir abuse
- Timeout configurável para requisições

### WebSocket
- Autenticação obrigatória via DID
- Validação de mensagens
- Cleanup automático de conexões órfãs
- Rate limiting por cliente

## 🐛 Debugging

### Logs
O servidor produz logs detalhados em modo desenvolvimento:

```
[2025-10-02 12:34:56] [INFO] 🚀 Servidor WebSocket iniciado em ws://localhost:8080
[2025-10-02 12:34:57] [INFO] ✅ Cliente conectado: abc123 (Total: 1)
[2025-10-02 12:34:58] [INFO] 🔐 Cliente abc123 autenticado como did:key:z6Mk...
[2025-10-02 12:35:00] [INFO] 💬 Mensagem de chat retransmitida: did:key:z6Mk... -> chat-123
```

### Estatísticas
Em desenvolvimento, estatísticas são mostradas a cada minuto:
```
📊 Stats: { conexões: 5, usuáriosOnline: 3, webhooks: 2, uptime: '1234s' }
```

## 🔄 Desenvolvimento

Para contribuir com o servidor:

1. **Estrutura modular** - Cada funcionalidade em seu próprio módulo
2. **Error handling** - Sempre trate erros adequadamente
3. **Logging** - Use o sistema de logs fornecido
4. **Testes** - Adicione testes para novas funcionalidades
5. **Documentação** - Documente APIs e funcionalidades

## 📝 Exemplo Completo

```javascript
const WebSocket = require('ws');

// Conectar ao servidor
const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  console.log('Conectado ao servidor');
  
  // Autenticar
  ws.send(JSON.stringify({
    type: 'authenticate',
    did: 'did:key:z6MkExample...'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Mensagem recebida:', message);
  
  if (message.type === 'authenticated') {
    // Registrar webhook
    ws.send(JSON.stringify({
      type: 'register_webhook',
      chatId: 'meu-chat',
      webhook: {
        url: 'https://minha-api.com/webhook',
        secret: 'minha-chave-secreta'
      }
    }));
  }
});

// Enviar mensagem de chat
setTimeout(() => {
  ws.send(JSON.stringify({
    type: 'chat_message',
    chatId: 'meu-chat',
    content: 'Olá, mundo!'
  }));
}, 2000);
```

---

**Servidor Chat Web5** - Comunicação em tempo real com WebSocket e Webhooks 🚀