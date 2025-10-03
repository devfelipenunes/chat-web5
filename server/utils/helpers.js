/**
 * Utilitários compartilhados do servidor
 */

const crypto = require('crypto');

/**
 * Gera ID único
 */
function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * Gera chave secreta aleatória
 */
function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Cria assinatura HMAC SHA-256
 */
function createSignature(data, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
}

/**
 * Verifica assinatura HMAC SHA-256
 */
function verifySignature(data, signature, secret) {
  const expectedSignature = createSignature(data, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Formata timestamp para logs
 */
function formatTimestamp(date = new Date()) {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Valida URL
 */
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

/**
 * Sanitiza dados para log (remove informações sensíveis)
 */
function sanitizeForLog(data) {
  const sanitized = { ...data };
  
  // Remove campos sensíveis
  const sensitiveFields = ['secret', 'password', 'token', 'key', 'jwt'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[HIDDEN]';
    }
  });

  return sanitized;
}

/**
 * Calcula delay para retry com backoff exponencial
 */
function calculateRetryDelay(attempt, baseDelay = 1000, maxDelay = 30000) {
  const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
  // Adiciona jitter para evitar thundering herd
  return delay + Math.random() * 1000;
}

/**
 * Valida formato DID simples
 */
function isValidDid(did) {
  return typeof did === 'string' && did.startsWith('did:') && did.length > 10;
}

/**
 * Rate limiter simples baseado em Map
 */
class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  isAllowed(key) {
    const now = Date.now();
    const userRequests = this.requests.get(key) || [];
    
    // Remove requests antigas
    const validRequests = userRequests.filter(timestamp => now - timestamp < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    // Adiciona request atual
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return true;
  }

  reset(key) {
    this.requests.delete(key);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(timestamp => now - timestamp < this.windowMs);
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }
}

/**
 * Logger simples com níveis
 */
class Logger {
  constructor(level = 'info') {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    this.level = level;
  }

  log(level, message, ...args) {
    if (this.levels[level] <= this.levels[this.level]) {
      const timestamp = formatTimestamp();
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
      console.log(prefix, message, ...args);
    }
  }

  error(message, ...args) {
    this.log('error', message, ...args);
  }

  warn(message, ...args) {
    this.log('warn', message, ...args);
  }

  info(message, ...args) {
    this.log('info', message, ...args);
  }

  debug(message, ...args) {
    this.log('debug', message, ...args);
  }
}

module.exports = {
  generateId,
  generateSecret,
  createSignature,
  verifySignature,
  formatTimestamp,
  isValidUrl,
  sanitizeForLog,
  calculateRetryDelay,
  isValidDid,
  RateLimiter,
  Logger
};