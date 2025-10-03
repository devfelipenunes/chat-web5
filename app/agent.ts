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

interface ChatCredential {
  type: string;
  jwt: string;
  chatId: string;
  ownerDid: string;
  createdAt: string;
  hash: string;
  savedAt: string;
}

class PersistentCredentialStore {
  private readonly storageKey = 'veramo-credentials';

  private getStoredCredentials(): Map<string, any> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        return new Map(Object.entries(data));
      }
    } catch (error) {
      console.error('❌ Erro ao carregar credenciais do localStorage:', error);
    }
    return new Map();
  }

  private saveCredentials(credentials: Map<string, any>): void {
    try {
      const data = Object.fromEntries(credentials);
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('❌ Erro ao salvar credenciais no localStorage:', error);
    }
  }

  async saveCredential(credential: any): Promise<string> {
    const hash = this.generateHash(credential);
    const credentials = this.getStoredCredentials();
    
    credentials.set(hash, {
      ...credential,
      hash,
      savedAt: new Date().toISOString()
    });
    
    this.saveCredentials(credentials);
    console.log('💾 Credencial salva:', hash);
    return hash;
  }

  async getCredential(hash: string): Promise<any | null> {
    const credentials = this.getStoredCredentials();
    return credentials.get(hash) || null;
  }

  async getAllCredentials(): Promise<any[]> {
    const credentials = this.getStoredCredentials();
    return Array.from(credentials.values());
  }

  async getCredentialsByIssuer(issuerDid: string): Promise<any[]> {
    const credentials = this.getStoredCredentials();
    return Array.from(credentials.values()).filter(
      (cred: any) => cred.issuer?.id === issuerDid || cred.issuer === issuerDid
    );
  }

  async getCredentialsBySubject(subjectDid: string): Promise<any[]> {
    const credentials = this.getStoredCredentials();
    return Array.from(credentials.values()).filter(
      (cred: any) => cred.credentialSubject?.id === subjectDid
    );
  }

  async deleteCredential(hash: string): Promise<boolean> {
    const credentials = this.getStoredCredentials();
    const deleted = credentials.delete(hash);
    if (deleted) {
      this.saveCredentials(credentials);
      console.log('🗑️ Credencial removida:', hash);
    }
    return deleted;
  }

  async clearAllCredentials(): Promise<void> {
    localStorage.removeItem(this.storageKey);
    console.log('🧹 Todas as credenciais removidas');
  }

  private generateHash(credential: any): string {
    const content = JSON.stringify(credential);
    return CryptoJS.SHA256(content).toString();
  }
}

const persistentCredentialStore = new PersistentCredentialStore();

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

  (agent as any).saveCredential = async (credential: any): Promise<string> => {
    return await persistentCredentialStore.saveCredential(credential);
  };

  (agent as any).getCredential = async (hash: string): Promise<any | null> => {
    return await persistentCredentialStore.getCredential(hash);
  };

  (agent as any).getAllCredentials = async (): Promise<any[]> => {
    return await persistentCredentialStore.getAllCredentials();
  };

  (agent as any).getCredentialsByIssuer = async (issuerDid: string): Promise<any[]> => {
    return await persistentCredentialStore.getCredentialsByIssuer(issuerDid);
  };

  (agent as any).getCredentialsBySubject = async (subjectDid: string): Promise<any[]> => {
    return await persistentCredentialStore.getCredentialsBySubject(subjectDid);
  };

  (agent as any).deleteCredential = async (hash: string): Promise<boolean> => {
    return await persistentCredentialStore.deleteCredential(hash);
  };

  (agent as any).saveChatCredential = async (jwt: string, chatId: string, ownerDid: string): Promise<string> => {
    const credential = {
      type: 'ChatAccessCredential',
      jwt,
      chatId,
      ownerDid,
      createdAt: new Date().toISOString(),
    };
    
    console.log('💾 Salvando credencial de chat:', { chatId, ownerDid });
    return await persistentCredentialStore.saveCredential(credential);
  };

  (agent as any).getChatCredentials = async (): Promise<ChatCredential[]> => {
    const allCredentials = await persistentCredentialStore.getAllCredentials();
    return allCredentials.filter((cred: any) => cred.type === 'ChatAccessCredential');
  };

  (agent as any).getCredential = async (credentialId: string): Promise<ChatCredential | null> => {
    const allCredentials = await persistentCredentialStore.getAllCredentials();
    return allCredentials.find((cred: any) => cred.id === credentialId) || null;
  };

  (agent as any).deleteCredential = async (credentialId: string): Promise<void> => {
    await persistentCredentialStore.deleteCredential(credentialId);
  };

  (agent as any).clearAllCredentials = async (): Promise<void> => {
    await persistentCredentialStore.clearAllCredentials();
  };
  
  return agent;
}

export type { ChatCredential };