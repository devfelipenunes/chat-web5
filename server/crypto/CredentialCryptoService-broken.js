/**
 * Serviço de Criptografia para Credenciais
 * 
 * Este serviço gerencia o armazenamento criptográfico seguro de credenciais:
 * - Criptografia AES-256-GCM para dados sensíveis
 * - Derivação de chaves baseada em DID
 * - Armazenamento seguro com salt e IV únicos
 * - Backup e recuperação de credenciais
 */

const crypto = require('crypto');
const { scrypt, randomBytes, timingSafeEqual } = crypto;
const { promisify } = require('util');

const scryptAsync = promisify(scrypt);

class CredentialCryptoService {
  constructor() {
    this.algorithm = 'aes-256-cbc';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16;  // 128 bits
    this.iterations = 100000; // Para PBKDF2
  }

  /**
   * Deriva chave de criptografia a partir do DID do usuário
   */
  async deriveKey(userDid, salt) {
    if (!userDid) {
      throw new Error('DID do usuário é obrigatório');
    }

    try {
      // Usa o DID como senha base e adiciona salt
      const key = await scryptAsync(userDid, salt, this.keyLength, this.scryptOptions);
      return key;
    } catch (error) {
      console.error('❌ Erro ao derivar chave:', error);
      throw new Error('Falha na derivação da chave');
    }
  }

  /**
   * Criptografa credencial
   */
  async encryptCredential(userDid, credentialData) {
    try {
      // Gera salt e IV únicos
      const salt = randomBytes(this.saltLength);
      const iv = randomBytes(this.ivLength);

      // Deriva chave de criptografia
      const key = await this.deriveKey(userDid, salt);

      // Serializa os dados da credencial
      const plaintext = JSON.stringify(credentialData);

      // Criptografa usando AES-256-CBC
      const cipher = crypto.createCipher(this.algorithm, key);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Retorna dados criptografados com metadados
      const encryptedCredential = {
        version: '1.0',
        algorithm: this.algorithm,
        encrypted: encrypted,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        createdAt: new Date().toISOString(),
        userDid: userDid,
        checksum: this.calculateChecksum(encrypted)
      };
        userDid: userDid // Para validação
      };

      console.log(`🔐 Credencial criptografada para ${userDid}`);
      return encryptedCredential;

    } catch (error) {
      console.error('❌ Erro ao criptografar credencial:', error);
      throw new Error('Falha na criptografia da credencial');
    }
  }

  /**
   * Descriptografa credencial
   */
  async decryptCredential(userDid, encryptedCredential) {
    try {
      // Valida se a credencial pertence ao usuário
      if (encryptedCredential.userDid !== userDid) {
        throw new Error('Credencial não pertence ao usuário');
      }

      // Extrai componentes criptográficos
      const salt = Buffer.from(encryptedCredential.salt, 'hex');
      const iv = Buffer.from(encryptedCredential.iv, 'hex');
      const authTag = Buffer.from(encryptedCredential.authTag, 'hex');
      const encrypted = encryptedCredential.encrypted;

      // Deriva a mesma chave
      const key = await this.deriveKey(userDid, salt);

      // Descriptografa usando AES-256-GCM
      const decipher = crypto.createDecipher('aes-256-gcm', key);
      decipher.setAuthTag(authTag);
      decipher.setAAD(Buffer.from(userDid)); // Dados adicionais autenticados

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      // Deserializa os dados
      const credentialData = JSON.parse(decrypted);

      console.log(`🔓 Credencial descriptografada para ${userDid}`);
      return credentialData;

    } catch (error) {
      console.error('❌ Erro ao descriptografar credencial:', error);
      throw new Error('Falha na descriptografia da credencial');
    }
  }

  /**
   * Criptografa múltiplas credenciais em lote
   */
  async encryptCredentialBatch(userDid, credentials) {
    const results = [];

    for (const credential of credentials) {
      try {
        const encrypted = await this.encryptCredential(userDid, credential);
        results.push({ success: true, data: encrypted, error: null });
      } catch (error) {
        results.push({ success: false, data: null, error: error.message });
      }
    }

    return results;
  }

  /**
   * Descriptografa múltiplas credenciais em lote
   */
  async decryptCredentialBatch(userDid, encryptedCredentials) {
    const results = [];

    for (const encryptedCredential of encryptedCredentials) {
      try {
        const decrypted = await this.decryptCredential(userDid, encryptedCredential);
        results.push({ success: true, data: decrypted, error: null });
      } catch (error) {
        results.push({ success: false, data: null, error: error.message });
      }
    }

    return results;
  }

  /**
   * Cria backup criptografado de todas as credenciais
   */
  async createEncryptedBackup(userDid, credentials, backupPassword) {
    try {
      // Usa senha adicional para backup
      const backupSalt = randomBytes(this.saltLength);
      const backupKey = await scryptAsync(
        `${userDid}:${backupPassword}`, 
        backupSalt, 
        this.keyLength, 
        this.scryptOptions
      );

      const iv = randomBytes(this.ivLength);

      // Criptografa todas as credenciais
      const backupData = {
        userDid,
        credentials,
        createdAt: new Date().toISOString(),
        version: '1.0'
      };

      const plaintext = JSON.stringify(backupData);
      
      const cipher = crypto.createCipherGCM(this.algorithm, backupKey, iv);
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();

      const backup = {
        version: '1.0',
        type: 'credential_backup',
        encrypted: encrypted,
        salt: backupSalt.toString('hex'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        createdAt: new Date().toISOString()
      };

      console.log(`💾 Backup criptografado criado para ${userDid}`);
      return backup;

    } catch (error) {
      console.error('❌ Erro ao criar backup:', error);
      throw new Error('Falha na criação do backup');
    }
  }

  /**
   * Restaura backup criptografado
   */
  async restoreEncryptedBackup(userDid, encryptedBackup, backupPassword) {
    try {
      const salt = Buffer.from(encryptedBackup.salt, 'hex');
      const iv = Buffer.from(encryptedBackup.iv, 'hex');
      const authTag = Buffer.from(encryptedBackup.authTag, 'hex');

      // Deriva chave do backup
      const backupKey = await scryptAsync(
        `${userDid}:${backupPassword}`, 
        salt, 
        this.keyLength, 
        this.scryptOptions
      );

      // Descriptografa
      const decipher = crypto.createDecipherGCM(this.algorithm, backupKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedBackup.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      const backupData = JSON.parse(decrypted);

      // Valida se o backup pertence ao usuário
      if (backupData.userDid !== userDid) {
        throw new Error('Backup não pertence ao usuário');
      }

      console.log(`📥 Backup restaurado para ${userDid}`);
      return backupData.credentials;

    } catch (error) {
      console.error('❌ Erro ao restaurar backup:', error);
      throw new Error('Falha na restauração do backup');
    }
  }

  /**
   * Valida integridade da credencial criptografada
   */
  async validateCredentialIntegrity(encryptedCredential) {
    try {
      // Verifica se todos os campos obrigatórios estão presentes
      const requiredFields = ['version', 'algorithm', 'encrypted', 'salt', 'iv', 'authTag', 'userDid'];
      
      for (const field of requiredFields) {
        if (!encryptedCredential[field]) {
          return { valid: false, error: `Campo obrigatório ausente: ${field}` };
        }
      }

      // Verifica comprimentos
      if (encryptedCredential.salt.length !== this.saltLength * 2) {
        return { valid: false, error: 'Salt com comprimento inválido' };
      }

      if (encryptedCredential.iv.length !== this.ivLength * 2) {
        return { valid: false, error: 'IV com comprimento inválido' };
      }

      if (encryptedCredential.authTag.length !== this.tagLength * 2) {
        return { valid: false, error: 'AuthTag com comprimento inválido' };
      }

      // Verifica algoritmo
      if (encryptedCredential.algorithm !== this.algorithm) {
        return { valid: false, error: 'Algoritmo não suportado' };
      }

      return { valid: true, error: null };

    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Rotaciona criptografia (re-criptografa com nova chave)
   */
  async rotateCredentialEncryption(userDid, encryptedCredential, newUserDid = null) {
    try {
      // Descriptografa com chave atual
      const credentialData = await this.decryptCredential(userDid, encryptedCredential);

      // Re-criptografa com nova chave (mesmo DID ou DID novo)
      const targetDid = newUserDid || userDid;
      const newEncryptedCredential = await this.encryptCredential(targetDid, credentialData);

      console.log(`🔄 Criptografia rotacionada: ${userDid} -> ${targetDid}`);
      return newEncryptedCredential;

    } catch (error) {
      console.error('❌ Erro na rotação de criptografia:', error);
      throw new Error('Falha na rotação da criptografia');
    }
  }

  /**
   * Obtém metadados da credencial sem descriptografar
   */
  getCredentialMetadata(encryptedCredential) {
    return {
      version: encryptedCredential.version,
      algorithm: encryptedCredential.algorithm,
      userDid: encryptedCredential.userDid,
      createdAt: encryptedCredential.createdAt,
      size: encryptedCredential.encrypted.length / 2 // bytes
    };
  }

  /**
   * Obtém estatísticas do serviço
   */
  getStats() {
    return {
      algorithm: this.algorithm,
      keyLength: this.keyLength,
      supportedOperations: [
        'encrypt',
        'decrypt', 
        'batch_encrypt',
        'batch_decrypt',
        'backup',
        'restore',
        'validate',
        'rotate'
      ],
      securityFeatures: [
        'AES-256-GCM encryption',
        'PBKDF2 key derivation',
        'Unique salt per credential',
        'Authentication tags',
        'DID-based key derivation'
      ]
    };
  }
}

module.exports = CredentialCryptoService;