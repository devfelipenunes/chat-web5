/**
 * Sistema de logging simples para o servidor de chat
 */

class Logger {
  constructor() {
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    this.currentLevel = this.levels.INFO;
  }

  /**
   * Define o nível de log
   */
  setLevel(level) {
    if (typeof level === 'string') {
      this.currentLevel = this.levels[level.toUpperCase()] || this.levels.INFO;
    } else {
      this.currentLevel = level;
    }
  }

  /**
   * Formata mensagem de log
   */
  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const levelStr = Object.keys(this.levels)[level].padEnd(5);
    const formattedMessage = typeof message === 'string' ? message : JSON.stringify(message);
    
    return `[${timestamp}] ${levelStr} ${formattedMessage}${args.length ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ') : ''}`;
  }

  /**
   * Log de erro
   */
  error(message, ...args) {
    if (this.currentLevel >= this.levels.ERROR) {
      console.error(this.formatMessage(this.levels.ERROR, message, ...args));
    }
  }

  /**
   * Log de aviso
   */
  warn(message, ...args) {
    if (this.currentLevel >= this.levels.WARN) {
      console.warn(this.formatMessage(this.levels.WARN, message, ...args));
    }
  }

  /**
   * Log de informação
   */
  info(message, ...args) {
    if (this.currentLevel >= this.levels.INFO) {
      console.log(this.formatMessage(this.levels.INFO, message, ...args));
    }
  }

  /**
   * Log de debug
   */
  debug(message, ...args) {
    if (this.currentLevel >= this.levels.DEBUG) {
      console.log(this.formatMessage(this.levels.DEBUG, message, ...args));
    }
  }
}

// Exporta instância singleton
const logger = new Logger();

// Configura nível baseado em variável de ambiente
if (process.env.LOG_LEVEL) {
  logger.setLevel(process.env.LOG_LEVEL);
} else if (process.env.NODE_ENV === 'development') {
  logger.setLevel('DEBUG');
} else if (process.env.NODE_ENV === 'test') {
  logger.setLevel('WARN');
}

module.exports = logger;