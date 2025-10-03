/**
 * Serviço de Criptografia de Credenciais Simplificado
 * 
 * Fornece criptografia segura para credenciais usando:
 * - AES-256-CBC para criptografia simétrica
 * - PBKDF2 para derivação de chaves baseada em DID
 * - SHA-256 para checksums de integridade
 */

const crypto = require('crypto');

class CredentialCryptoService {
  constructor() {
    this.algorithm = 'aes-256-cbc';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16;  // 128 bits
    this.iterations = 100000; // Para PBKDF2
  }

  /**
   * Deriva chave criptográfica a partir do DID do usuário
   */
  async deriveKey(userDid, salt) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(userDid, salt, this.iterations, this.keyLength, 'sha256', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  }

  /**
   * Calcula checksum para validação de integridade
   */
  calculateChecksum(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Criptografa credencial
   */
  async encryptCredential(userDid, credential) {
    try {
      if (!userDid || !credential) {
        throw new Error('DID do usuário e credencial são obrigatórios');
      }

      // Gera salt e IV aleatórios
      const salt = crypto.randomBytes(16);
      const iv = crypto.randomBytes(this.ivLength);

      // Deriva chave a partir do DID
      const key = await this.deriveKey(userDid, salt);

      // Serializa os dados da credencial
      const plaintext = JSON.stringify(credential);

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
      if (!userDid || !encryptedCredential) {
        throw new Error('DID do usuário e credencial criptografada são obrigatórios');
      }

      // Valida se a credencial pertence ao usuário
      if (encryptedCredential.userDid !== userDid) {
        throw new Error('Credencial não pertence ao usuário');
      }

      // Extrai componentes criptográficos
      const salt = Buffer.from(encryptedCredential.salt, 'hex');
      const encrypted = encryptedCredential.encrypted;

      // Deriva a mesma chave
      const key = await this.deriveKey(userDid, salt);

      // Descriptografa usando AES-256-CBC
      const decipher = crypto.createDecipher(this.algorithm, key);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      // Deserializa os dados
      const credential = JSON.parse(decrypted);

      console.log(`🔓 Credencial descriptografada para ${userDid}`);
      return credential;

    } catch (error) {
      console.error('❌ Erro ao descriptografar credencial:', error);
      throw new Error('Falha na descriptografia da credencial');
    }
  }

  /**
   * Valida integridade da credencial criptografada
   */
  async validateCredentialIntegrity(encryptedCredential) {
    try {
      const currentChecksum = this.calculateChecksum(encryptedCredential.encrypted);
      const originalChecksum = encryptedCredential.checksum;

      const isValid = currentChecksum === originalChecksum;
      
      return {
        valid: isValid,
        currentChecksum,
        originalChecksum,
        algorithm: encryptedCredential.algorithm,
        createdAt: encryptedCredential.createdAt
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Cria backup criptografado de múltiplas credenciais
   */
  async createEncryptedBackup(userDid, credentials, backupPassword) {
    try {
      if (!Array.isArray(credentials)) {
        throw new Error('Credenciais devem ser um array');
      }

      // Criptografa cada credencial individualmente
      const encryptedCredentials = [];
      for (const credential of credentials) {
        const encrypted = await this.encryptCredential(userDid, credential);
        encryptedCredentials.push(encrypted);
      }

      // Cria dados do backup
      const backupData = {
        version: '1.0',
        userDid: userDid,
        createdAt: new Date().toISOString(),
        credentialsCount: credentials.length,
        credentials: encryptedCredentials
      };

      // Criptografa o backup inteiro com a senha
      const backupJson = JSON.stringify(backupData);
      const salt = crypto.randomBytes(16);
      const key = await this.deriveKeyFromPassword(backupPassword, salt);
      
      const cipher = crypto.createCipher(this.algorithm, key);
      let encryptedBackup = cipher.update(backupJson, 'utf8', 'hex');
      encryptedBackup += cipher.final('hex');

      const backup = {
        version: '1.0',
        encrypted: encryptedBackup,
        salt: salt.toString('hex'),
        createdAt: new Date().toISOString(),
        checksum: this.calculateChecksum(encryptedBackup)
      };

      console.log(`💾 Backup criado com ${credentials.length} credenciais`);
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
      // Descriptografa o backup
      const salt = Buffer.from(encryptedBackup.salt, 'hex');
      const key = await this.deriveKeyFromPassword(backupPassword, salt);
      
      const decipher = crypto.createDecipher(this.algorithm, key);
      let decryptedBackup = decipher.update(encryptedBackup.encrypted, 'hex', 'utf8');
      decryptedBackup += decipher.final('utf8');

      const backupData = JSON.parse(decryptedBackup);

      // Valida se o backup pertence ao usuário
      if (backupData.userDid !== userDid) {
        throw new Error('Backup não pertence ao usuário');
      }

      // Descriptografa cada credencial
      const credentials = [];
      for (const encryptedCredential of backupData.credentials) {
        const credential = await this.decryptCredential(userDid, encryptedCredential);
        credentials.push(credential);
      }

      console.log(`📥 Backup restaurado com ${credentials.length} credenciais`);
      return credentials;

    } catch (error) {
      console.error('❌ Erro ao restaurar backup:', error);
      throw new Error('Falha na restauração do backup');
    }
  }

  /**
   * Deriva chave a partir de senha
   */
  async deriveKeyFromPassword(password, salt) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, this.iterations, this.keyLength, 'sha256', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  }

  /**
   * Obtém metadados da credencial criptografada
   */
  getCredentialMetadata(encryptedCredential) {
    return {
      version: encryptedCredential.version,
      algorithm: encryptedCredential.algorithm,
      userDid: encryptedCredential.userDid,
      createdAt: encryptedCredential.createdAt,
      size: encryptedCredential.encrypted.length,
      hasChecksum: !!encryptedCredential.checksum
    };
  }

  /**
   * Demonstra uso do serviço
   */
  async demonstrateUsage() {
    console.log('\n🔐 === DEMONSTRAÇÃO CRYPTO SERVICE ===');
    
    const testDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
    const testCredential = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential'],
      issuer: testDid,
      credentialSubject: { id: testDid, role: 'demo' }
    };

    try {
      const encrypted = await this.encryptCredential(testDid, testCredential);
      console.log('✅ Criptografia bem-sucedida');

      const decrypted = await this.decryptCredential(testDid, encrypted);
      console.log('✅ Descriptografia bem-sucedida');

      const validation = await this.validateCredentialIntegrity(encrypted);
      console.log('✅ Validação:', validation.valid ? 'OK' : 'FALHA');

    } catch (error) {
      console.error('❌ Erro na demonstração:', error.message);
    }
  }
}

module.exports = CredentialCryptoService;