#!/usr/bin/env node

/**
 * Script de teste para validar integração completa
 * - Servidor WebSocket com DIDComm
 * - Criptografia de credenciais
 * - Comunicação segura peer-to-peer
 */

const path = require('path');
const { spawn } = require('child_process');

class IntegrationTest {
  constructor() {
    this.serverProcess = null;
    this.testResults = [];
    this.testPort = null;
  }

  /**
   * Executa todos os testes
   */
  async runAllTests() {
    console.log('🧪 === INICIANDO TESTES DE INTEGRAÇÃO ===\\n');

    try {
      // 1. Teste de servidor
      await this.testServerStart();
      
      // 2. Teste de DIDComm
      await this.testDIDCommService();
      
      // 3. Teste de criptografia
      await this.testCryptoService();
      
      // 4. Teste de integração completa
      await this.testFullIntegration();

      // Exibe resultados
      this.displayResults();

    } catch (error) {
      console.error('❌ Erro nos testes:', error);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Encontra uma porta livre
   */
  async findFreePort() {
    const net = require('net');
    
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(0, () => {
        const port = server.address().port;
        server.close(() => resolve(port));
      });
      server.on('error', reject);
    });
  }

  /**
   * Testa inicialização do servidor
   */
  async testServerStart() {
    console.log('🖥️  Testando inicialização do servidor...');
    
    // Encontra porta livre
    const freePort = await this.findFreePort();
    console.log(`🔍 Usando porta livre: ${freePort}`);
    
    return new Promise((resolve, reject) => {
      const serverPath = path.join(__dirname, 'index.js');
      this.serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test', PORT: freePort.toString() }
      });

      let output = '';
      const timeout = setTimeout(() => {
        this.testResults.push({
          test: 'Server Start',
          status: 'TIMEOUT',
          message: 'Servidor demorou mais de 10 segundos para iniciar'
        });
        reject(new Error('Timeout na inicialização do servidor'));
      }, 10000);

      this.serverProcess.stdout.on('data', (data) => {
        output += data.toString();
        
        if (output.includes(`WebSocket server listening on port ${freePort}`)) {
          clearTimeout(timeout);
          this.testResults.push({
            test: 'Server Start',
            status: 'PASS',
            message: 'Servidor iniciado com sucesso'
          });
          console.log('✅ Servidor iniciado');
          this.testPort = freePort;
          resolve();
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        const error = data.toString();
        if (!error.includes('warning') && !error.includes('deprecat')) {
          clearTimeout(timeout);
          this.testResults.push({
            test: 'Server Start',
            status: 'FAIL',
            message: `Erro no servidor: ${error}`
          });
          reject(new Error(error));
        }
      });

      this.serverProcess.on('error', (error) => {
        clearTimeout(timeout);
        this.testResults.push({
          test: 'Server Start',
          status: 'FAIL',
          message: `Erro ao iniciar servidor: ${error.message}`
        });
        reject(error);
      });
    });
  }

  /**
   * Testa serviço DIDComm
   */
  async testDIDCommService() {
    console.log('🔐 Testando serviço DIDComm...');

    try {
      const DIDCommService = require('../didcomm/DIDCommService');
      const service = new DIDCommService();

      // Inicializa serviço
      await service.initialize();
      
      this.testResults.push({
        test: 'DIDComm Init',
        status: 'PASS',
        message: 'Serviço DIDComm inicializado com sucesso'
      });

      // Testa registro de cliente fictício
      const mockClient = { did: 'did:key:test123', ws: null };
      service.registerClient(mockClient);

      const isRegistered = service.getConnectedClients().includes('did:key:test123');
      
      this.testResults.push({
        test: 'DIDComm Client Registration',
        status: isRegistered ? 'PASS' : 'FAIL',
        message: isRegistered ? 'Cliente registrado com sucesso' : 'Falha no registro de cliente'
      });

      console.log('✅ Serviço DIDComm testado');

    } catch (error) {
      this.testResults.push({
        test: 'DIDComm Service',
        status: 'FAIL',
        message: `Erro no serviço DIDComm: ${error.message}`
      });
      console.error('❌ Erro no teste DIDComm:', error);
    }
  }

  /**
   * Testa serviço de criptografia
   */
  async testCryptoService() {
    console.log('🔒 Testando serviço de criptografia...');

    try {
      const CredentialCryptoService = require('../crypto/CredentialCryptoService');
      const cryptoService = new CredentialCryptoService();

      // Dados de teste
      const testDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
      const testCredential = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential'],
        issuer: testDid,
        credentialSubject: { id: testDid, test: true }
      };

      // Teste de criptografia
      const encrypted = await cryptoService.encryptCredential(testDid, testCredential);
      
      this.testResults.push({
        test: 'Credential Encryption',
        status: 'PASS',
        message: 'Credencial criptografada com sucesso'
      });

      // Teste de descriptografia
      const decrypted = await cryptoService.decryptCredential(testDid, encrypted);
      
      const isValid = JSON.stringify(decrypted) === JSON.stringify(testCredential);
      
      this.testResults.push({
        test: 'Credential Decryption',
        status: isValid ? 'PASS' : 'FAIL',
        message: isValid ? 'Credencial descriptografada corretamente' : 'Falha na descriptografia'
      });

      // Teste de backup
      const backup = await cryptoService.createEncryptedBackup(
        testDid, 
        [testCredential], 
        'test-password'
      );

      this.testResults.push({
        test: 'Encrypted Backup',
        status: 'PASS',
        message: 'Backup criptografado criado com sucesso'
      });

      // Teste de restauração
      const restored = await cryptoService.restoreEncryptedBackup(
        testDid, 
        backup, 
        'test-password'
      );

      const backupValid = restored.length === 1 && 
                         JSON.stringify(restored[0]) === JSON.stringify(testCredential);

      this.testResults.push({
        test: 'Backup Restore',
        status: backupValid ? 'PASS' : 'FAIL',
        message: backupValid ? 'Backup restaurado corretamente' : 'Falha na restauração'
      });

      console.log('✅ Serviço de criptografia testado');

    } catch (error) {
      this.testResults.push({
        test: 'Crypto Service',
        status: 'FAIL',
        message: `Erro no serviço de criptografia: ${error.message}`
      });
      console.error('❌ Erro no teste de criptografia:', error);
    }
  }

  /**
   * Testa integração completa
   */
  async testFullIntegration() {
    console.log('🔄 Testando integração completa...');

    try {
      // Aguarda servidor estar pronto
      await new Promise(resolve => setTimeout(resolve, 2000));

      const ChatClient = require('./ChatClient');
      const client = new ChatClient(`ws://localhost:${this.testPort}`);

      // Inicializa e conecta cliente
      await client.initialize();
      
      const connected = await new Promise((resolve) => {
        client.connect()
          .then(() => resolve(true))
          .catch(() => resolve(false));
        
        setTimeout(() => resolve(false), 5000);
      });

      this.testResults.push({
        test: 'Client Connection',
        status: connected ? 'PASS' : 'FAIL',
        message: connected ? 'Cliente conectou com sucesso' : 'Falha na conexão do cliente'
      });

      if (connected) {
        // Testa autenticação
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        this.testResults.push({
          test: 'Client Authentication',
          status: client.authenticated ? 'PASS' : 'FAIL',
          message: client.authenticated ? 'Cliente autenticado com sucesso' : 'Falha na autenticação'
        });

        client.disconnect();
      }

      console.log('✅ Integração completa testada');

    } catch (error) {
      this.testResults.push({
        test: 'Full Integration',
        status: 'FAIL',
        message: `Erro na integração: ${error.message}`
      });
      console.error('❌ Erro no teste de integração:', error);
    }
  }

  /**
   * Exibe resultados dos testes
   */
  displayResults() {
    console.log('\\n📊 === RESULTADOS DOS TESTES ===\\n');

    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const timeout = this.testResults.filter(r => r.status === 'TIMEOUT').length;

    this.testResults.forEach(result => {
      const icon = {
        'PASS': '✅',
        'FAIL': '❌',
        'TIMEOUT': '⏱️'
      }[result.status];
      
      console.log(`${icon} ${result.test}: ${result.message}`);
    });

    console.log(`\\n📈 Resumo: ${passed} passou, ${failed} falhou, ${timeout} timeout`);
    console.log(`🎯 Taxa de sucesso: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);

    if (failed === 0 && timeout === 0) {
      console.log('\\n🎉 Todos os testes passaram! Sistema pronto para uso.');
    } else {
      console.log('\\n⚠️  Alguns testes falharam. Verifique os problemas acima.');
    }
  }

  /**
   * Limpa recursos
   */
  async cleanup() {
    console.log('\\n🧹 Limpando recursos...');
    
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      
      // Aguarda processo finalizar
      await new Promise(resolve => {
        this.serverProcess.on('exit', resolve);
        setTimeout(resolve, 2000);
      });
    }
    
    console.log('✅ Limpeza concluída');
  }
}

// Executa testes se chamado diretamente
if (require.main === module) {
  const test = new IntegrationTest();
  test.runAllTests().catch(console.error);
}

module.exports = IntegrationTest;