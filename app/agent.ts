import { createAgent, IAgent } from '@veramo/core';
import { DIDManager,  MemoryDIDStore } from '@veramo/did-manager';
import { KeyManager,  MemoryKeyStore, MemoryPrivateKeyStore } from '@veramo/key-manager';
import { KeyManagementSystem } from '@veramo/kms-local';
import { CredentialPlugin, ICredentialIssuer } from '@veramo/credential-w3c';
import { DIDResolverPlugin } from '@veramo/did-resolver';
import { Resolver } from 'did-resolver';
import { getResolver as getKeyResolver } from 'key-did-resolver';
import { KeyDIDProvider } from '@veramo/did-provider-key';
import CryptoJS from 'crypto-js';

export const agentPromise = createAgent({
  plugins: [
    new KeyManager({
      store: new MemoryKeyStore(),
      kms: {
        local: new KeyManagementSystem(new MemoryPrivateKeyStore()),
      },
    }),
    new DIDManager({
      store: new MemoryDIDStore(),
      defaultProvider: 'did:key',
      providers: {
        'did:key': new KeyDIDProvider({
          defaultKms: 'local'
        })
      }
    }),
    new DIDResolverPlugin({
      resolver: new Resolver({
        ...getKeyResolver(),
      }),
    }),
    new CredentialPlugin(),
  ],
});

export class SimpleDIDCrypto {
  private agent: IAgent;

  constructor(agent: IAgent) {
    this.agent = agent;
  }

  private stringToArrayBuffer(str: string): ArrayBuffer {
    const encoder = new TextEncoder();
    return encoder.encode(str).buffer;
  }

  private arrayBufferToString(buffer: ArrayBuffer): string {
    const decoder = new TextDecoder();
    return decoder.decode(buffer);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async encryptMessage(message: any, fromDid: string, toDid: string): Promise<string> {
    try {
      if (!message || !fromDid || !toDid) {
        throw new Error('Parâmetros obrigatórios: message, fromDid, toDid');
      }

      const sortedDids = [fromDid.toLowerCase(), toDid.toLowerCase()].sort();
      const keyMaterial = sortedDids[0] + sortedDids[1] + 'encryption-key-v2';
      
      // Gerar uma chave forte usando PBKDF2
      const salt = CryptoJS.enc.Utf8.parse('chat-web5-salt');
      const key = CryptoJS.PBKDF2(keyMaterial, salt, {
        keySize: 256/32, // 256 bits = 32 bytes
        iterations: 1000
      });
      
      console.log('🔑 Chave derivada para criptografia:', sortedDids);
      
      const messageStr = JSON.stringify(message);
      
      // Criptografar usando AES-256-CBC
      const encrypted = CryptoJS.AES.encrypt(messageStr, key, {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
        iv: CryptoJS.lib.WordArray.random(16) // IV aleatório de 16 bytes
      });
      
      return encrypted.toString();
      
    } catch (error) {
      console.error('❌ Erro ao criptografar mensagem:', error);
      throw new Error(`Falha na criptografia: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async decryptMessage(encryptedData: string, fromDid: string, toDid: string): Promise<any> {
    try {
      if (!encryptedData || !fromDid || !toDid) {
        throw new Error('Parâmetros obrigatórios: encryptedData, fromDid, toDid');
      }

      const sortedDids = [fromDid.toLowerCase(), toDid.toLowerCase()].sort();
      const keyMaterial = sortedDids[0] + sortedDids[1] + 'encryption-key-v2';
      
      const salt = CryptoJS.enc.Utf8.parse('chat-web5-salt');
      const key = CryptoJS.PBKDF2(keyMaterial, salt, {
        keySize: 256/32, // 256 bits = 32 bytes
        iterations: 1000
      });
      
      console.log('🔓 Chave derivada para descriptografia:', sortedDids);
      
      const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
      
      const messageStr = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!messageStr) {
        throw new Error('Falha na descriptografia: dados inválidos ou chave incorreta');
      }
      
      return JSON.parse(messageStr);
      
    } catch (error) {
      console.error('❌ Erro ao descriptografar mensagem:', error);
      throw new Error(`Falha na descriptografia: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async packDIDCommMessage(params: { message: any }): Promise<string> {
    const { message } = params;
    
    if (!message) {
      throw new Error('Mensagem é obrigatória');
    }
    
    if (!message.from || !message.to?.[0]) {
      throw new Error('DIDs de origem (from) e destino (to) são obrigatórios');
    }
    
    return await this.encryptMessage(
      message,
      message.from,
      message.to[0]
    );
  }

  async unpackDIDCommMessage(encryptedMessage: string, fromDid: string, toDid: string): Promise<any> {
    return await this.decryptMessage(encryptedMessage, fromDid, toDid);
  }
}

export async function createAgentWithCrypto() {
  const agent = await agentPromise;
  const crypto = new SimpleDIDCrypto(agent);
  
  (agent as any).packDIDCommMessage = crypto.packDIDCommMessage.bind(crypto);
  (agent as any).unpackDIDCommMessage = crypto.unpackDIDCommMessage.bind(crypto);
  (agent as any).encryptMessage = crypto.encryptMessage.bind(crypto);
  (agent as any).decryptMessage = crypto.decryptMessage.bind(crypto);
  
  return agent;
}