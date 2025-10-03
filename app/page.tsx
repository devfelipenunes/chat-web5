"use client";
import "@/utils/polyfill";

import React, { useState, useEffect } from "react";
import { createAgentWithCrypto } from "./agent";
import { Sidebar } from "./components/sidebar";
import { ChatArea } from "./components/chat";
import { WebhookConfigModal } from "./components/chat/WebhookConfigModal";
import { InviteModal } from "./components/chat/InviteModal";
import QRCodeModal from "./components/qr/QRCodeModal";
import { LoadingSpinner } from "./components/ui";
import { 
  useChats, 
  useChatMessages, 
  useWebhookForm, 
  useMessageInput, 
  useInviteProcessor, 
  useOnlineStatus,
  useChatCreation 
} from "./hooks";
import { useWebSocket } from "./useWebSocket";
import { useWebhook } from "./hooks/useWebhook";
import { useInvite } from "./hooks/useInvite";
import { Chat } from "./types";
import { Message } from "./types/message";
import { db, ChatMessage, ChatRoom } from "./db";

function parseJWT(token: string) {
  try {
    console.log('🔍 Decodificando JWT...', { token, type: typeof token });
    
    if (!token || typeof token !== 'string') {
      throw new Error(`Token inválido: esperado string, recebido ${typeof token}`);
    }
    
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('JWT inválido: deve ter 3 partes separadas por ponto');
    }
    
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    
    const padding = base64.length % 4;
    const paddedBase64 = padding ? base64 + '='.repeat(4 - padding) : base64;
    
    const jsonPayload = atob(paddedBase64);
    const decoded = JSON.parse(jsonPayload);
    
    console.log('✅ JWT decodificado com sucesso:', decoded);
    return decoded;
    
  } catch (error) {
    console.error('❌ Erro ao decodificar JWT:', error);
    console.error('❌ Token recebido:', token);
    return null;
  }
}

const App = () => {
  const [view, setView] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [agent, setAgent] = useState<any | null>(null);
  const [currentUserDid, setCurrentUserDid] = useState<string | null>(null);
  const [isSecureContext, setIsSecureContext] = useState(true);
  const [showSecurityWarning, setShowSecurityWarning] = useState(false);

  useEffect(() => {
    const checkSecureContext = () => {
      const isSecure = window.isSecureContext || 
                      window.location.protocol === 'https:' || 
                      window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';
      
      setIsSecureContext(isSecure);
      
      if (!isSecure && (!crypto || !crypto.subtle)) {
        setShowSecurityWarning(true);
        console.warn('⚠️  Contexto inseguro detectado. Algumas funcionalidades podem estar limitadas.');
      }
    };
    
    checkSecureContext();
  }, []);

  const {
    chats,
    selectedChat,
    selectedChatId,
    isLoading: isLoadingChats,
    selectChat,
    addChat,
    updateChat,
    loadChats
  } = useChats();

  const {
    messages,
    isLoading: isLoadingMessages,
    hasMore: hasMoreMessages,
    loadMessages,
    addMessage
  } = useChatMessages(selectedChatId, currentUserDid);

  const {
    webhookData,
    isSaving: isSavingWebhook,
    updateField: updateWebhookField,
    setWebhookData
  } = useWebhookForm();

  const {
    messageValue,
    isSending,
    setMessageValue,
    setIsSending,
    clearMessage
  } = useMessageInput();

  const {
    inviteCode,
    isProcessing: isProcessingInvite,
    setInviteCode,
    setIsProcessing: setIsProcessingInvite,
    clearInvite
  } = useInviteProcessor();

  const {
    onlineUsers,
    setUserOnline,
    setUserOffline,
    updateOnlineUsers
  } = useOnlineStatus();

  const {
    isCreating: isCreatingChat,
    setIsCreating: setIsCreatingChat
  } = useChatCreation();

  const isRoomOwner = selectedChatId ? chats.find(c => c.id === selectedChatId)?.host === currentUserDid : false;

  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrMode, setQrMode] = useState<'generate' | 'scan'>('generate');
  const [qrData, setQrData] = useState<string>('');
  
  const [showSidebar, setShowSidebar] = useState(false);

  const {
    connectionError,
    isConnected,
    sendMessage: sendWebSocketMessage,
    registerWebhook,
    ws
  } = useWebSocket({
    did: currentUserDid,
    activeChatId: selectedChatId,
    isRoomOwner
  });

  const webhookHook = useWebhook(selectedChatId, currentUserDid, ws);
  const inviteHook = useInvite(selectedChatId, currentUserDid);

  useEffect(() => {
    const initializeAgent = async () => {
      try {
        const resolvedAgent = await createAgentWithCrypto();
        setAgent(resolvedAgent);

        const identifier = await resolvedAgent.didManagerGetOrCreate({
          alias: 'default',
          provider: 'did:key'
        });

        setCurrentUserDid(identifier.did);
        console.log('DID do usuário:', identifier.did);
        setView("ready");
      } catch (error: any) {
        console.error('Erro ao inicializar agente:', error);
        setErrorMessage(`Erro ao inicializar: ${error?.message || 'Erro desconhecido'}`);
        setView("error");
      }
    };

    initializeAgent();
  }, []);

  useEffect(() => {
    if (agent) {
      (window as any).debugCredentials = debugCredentials;
      (window as any).clearCredentials = async () => {
        await agent.clearAllCredentials();
        console.log('🧹 Credenciais limpas via console');
      };
    }
  }, [agent]);

  useEffect(() => {
    const handleWebSocketMessage = async (event: any) => {
      const message = event.detail;
      
      if (message.type === 'encrypted_chat' && message.chatId === selectedChatId) {
        console.log('� Mensagem criptografada recebida, descriptografando...');
        
        if (!agent) {
          console.error('❌ Agent não disponível para descriptografar');
          return;
        }

        try {
          const decrypted = await agent.unpackDIDCommMessage(
            message.encryptedPayload,
            message.sender,
            currentUserDid
          );

          console.log('✅ Mensagem descriptografada:', decrypted);
          
          const messageContent = decrypted.body?.content || decrypted.content || 'Mensagem sem conteúdo';
          const messageTimestamp = decrypted.body?.timestamp || decrypted.timestamp || message.timestamp;

          const newMessage: Message = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            content: messageContent,
            senderDid: message.sender,
            timestamp: messageTimestamp,
            isCurrentUser: message.sender === currentUserDid
          };
          
          addMessage(newMessage);
          
          await db.messages.add({
            chatId: message.chatId,
            sender: message.sender,
            content: messageContent,
            timestamp: messageTimestamp
          });
        } catch (error) {
          console.error('❌ Erro ao descriptografar mensagem:', error);
        }
      }

      else if (message.type === 'chat_message' && message.chatId === selectedChatId) {
        console.log('📨 Mensagem recebida via WebSocket');
        
        const existingMessage = await db.messages
          .where('chatId').equals(message.chatId)
          .and(msg => 
            msg.sender === message.sender && 
            msg.content === message.content &&
            Math.abs(new Date(msg.timestamp).getTime() - new Date(message.timestamp).getTime()) < 2000
          )
          .first();
          
        if (existingMessage) {
          console.log('🔄 Mensagem já existe no banco, ignorando');
          return;
        }
        
        const newMessage: Message = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
          content: message.content,
          senderDid: message.sender,
          timestamp: message.timestamp,
          isCurrentUser: message.sender === currentUserDid
        };
        
        addMessage(newMessage);
        
        await db.messages.add({
          chatId: message.chatId,
          sender: message.sender,
          content: message.content,
          timestamp: message.timestamp
        }).catch(error => {
          // Se der erro de duplicata, apenas ignore
          if (!error.message.includes('Key already exists')) {
            console.error('Erro ao salvar mensagem:', error);
          }
        });
      }
      
      else if (message.type === 'encrypted_chat_error') {
        console.error('❌ Erro de criptografia no servidor:', message.message);
        alert(`Erro ao enviar mensagem: ${message.message}`);
      }
      
      else if (message.type === 'encrypted_chat_sent') {
        console.log('✅ Mensagem enviada com sucesso:', message);
      }
      
      else {
        console.log('📨 Mensagem WebSocket não processada:', message.type);
      }
    };
    
    window.addEventListener('websocket-message', handleWebSocketMessage);
    
    return () => {
      window.removeEventListener('websocket-message', handleWebSocketMessage);
    };
  }, [selectedChatId, currentUserDid, agent, addMessage]);

  useEffect(() => {
    if (selectedChatId) {
      loadMessagesFromDB();
    }
  }, [selectedChatId]);

  const loadMessagesFromDB = async () => {
    if (!selectedChatId) return;
    
    try {
      const chatMessages = await db.messages
        .where('chatId')
        .equals(selectedChatId)
        .reverse()
        .limit(50)
        .toArray();

      const formattedMessages: Message[] = chatMessages.map(msg => ({
        id: msg.id?.toString() || `db_${msg.chatId}_${msg.timestamp}`,
        content: msg.content,
        senderDid: msg.sender,
        timestamp: msg.timestamp,
        isCurrentUser: msg.sender === currentUserDid
      }));

      loadMessages(50, 0);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  // Função para sincronizar chats com credenciais do Veramo
  const syncChatsWithCredentials = async () => {
    if (!agent || !currentUserDid) return;
    
    console.log('🔄 Sincronizando chats com credenciais...');
    
    try {
      const credentials = await agent.getChatCredentials();
      console.log('📋 Credenciais encontradas:', credentials.length);

      const existingChats = await db.chatRooms.toArray();
      const chatIds = new Set(existingChats.map(chat => chat.chatId));

      for (const cred of credentials) {
        try {
          const jwtData = parseJWT(cred.jwt);
          if (!jwtData?.vc?.credentialSubject) {
            console.warn('⚠️ Credencial com dados inválidos:', cred.id);
            continue;
          }

          const subject = jwtData.vc.credentialSubject;
          const credentialTypes = jwtData.vc.type || [];

          // Processar credencial de chat
          if (credentialTypes.includes('ChatCredential')) {
            const chatDid = subject.chatDid;
            const chatName = subject.chatName || 'Chat sem nome';
            const owner = subject.owner;
            const websocketUrl = subject.websocketUrl || 'ws://192.168.15.3:8080';
            const isOwner = owner === currentUserDid;

            if (!chatIds.has(chatDid)) {
              console.log(`➕ Adicionando chat do proprietário: ${chatName} (${chatDid})`);
              
              await db.chatRooms.add({
                chatId: chatDid,
                name: chatName,
                ownerDid: owner,
                createdAt: subject.createdAt || new Date().toISOString(),
                isOwner: isOwner,
                saveMessagesLocally: true,
                webhookEnabled: false,
                websocketUrl: websocketUrl,
                isActive: subject.status === 'active'
              });
              
              chatIds.add(chatDid);
            }
          }
          
          // Processar credencial de convite
          else if (credentialTypes.includes('ChatInviteCredential')) {
            const chatDid = subject.chatDid;
            const chatCredentialId = subject.chatCredentialId;
            
            if (!chatIds.has(chatDid)) {
              // Buscar a credencial do chat referenciada
              const chatCredential = await agent.getCredential(chatCredentialId);
              
              if (chatCredential) {
                const chatData = parseJWT(chatCredential.jwt);
                if (chatData?.vc?.credentialSubject) {
                  const chatInfo = chatData.vc.credentialSubject;
                  const chatName = chatInfo.chatName || 'Chat sem nome';
                  const owner = chatInfo.owner;
                  const websocketUrl = chatInfo.websocketUrl || 'ws://192.168.15.3:8080';
                  
                  console.log(`➕ Adicionando chat via convite: ${chatName} (${chatDid})`);
                  
                  await db.chatRooms.add({
                    chatId: chatDid,
                    name: chatName,
                    ownerDid: owner,
                    createdAt: chatInfo.createdAt || new Date().toISOString(),
                    isOwner: false,
                    saveMessagesLocally: true,
                    webhookEnabled: false,
                    websocketUrl: websocketUrl,
                    isActive: chatInfo.status === 'active'
                  });
                  
                  chatIds.add(chatDid);
                }
              } else {
                console.warn(`⚠️ Credencial de chat referenciada não encontrada: ${chatCredentialId}`);
              }
            }
          }
        } catch (error) {
          console.error('❌ Erro ao processar credencial:', error);
        }
      }

      console.log('✅ Sincronização concluída');
    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
    }
  };

  useEffect(() => {
    if (agent && currentUserDid) {
      syncChatsWithCredentials();
    }
  }, [agent, currentUserDid]);

  const handleCreateChat = async () => {
    if (!currentUserDid || !agent || isCreatingChat) return;
    
    setIsCreatingChat(true);
    try {
      // Gerar DID único para o chat
      const chatDid = `did:chat:${currentUserDid.split(':')[2]}:${Date.now()}`;
      const chatName = `Chat ${new Date().toLocaleString()}`;

      // 1. Criar credencial do chat (ownership)
      const chatCredential = await agent.createVerifiableCredential({
        credential: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiableCredential', 'ChatCredential'],
          issuer: { id: currentUserDid },
          issuanceDate: new Date().toISOString(),
          credentialSubject: {
            id: chatDid,
            chatName: chatName,
            owner: currentUserDid,
            createdAt: new Date().toISOString(),
            websocketUrl: 'ws://192.168.15.3:8080',
            status: 'active'
          }
        },
        proofFormat: 'jwt'
      });

      console.log('✅ Credencial do chat criada:', chatCredential);

      // Salvar no banco local
      await db.chatRooms.add({
        chatId: chatDid,
        name: chatName,
        ownerDid: currentUserDid,
        createdAt: new Date().toISOString(),
        isOwner: true,
        saveMessagesLocally: true,
        webhookEnabled: false,
        websocketUrl: 'ws://192.168.15.3:8080',
        isActive: true
      });

      // Salvar credencial do chat no Veramo
      await agent.saveChatCredential(
        chatCredential.proof.jwt,
        chatDid,
        currentUserDid
      );

      const newChat: Chat = {
        id: chatDid,
        name: chatName,
        host: currentUserDid,
        isOwner: true,
        webhookEnabled: false,
        saveLocally: true
      };
      
      addChat(newChat);
      selectChat(chatDid);
    } catch (error) {
      console.error('Erro ao criar chat:', error);
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!agent || !chatId) return;
    
    try {
      console.log('🗑️ Deletando chat:', chatId);
      
      // Confirmar com o usuário
      const confirmed = window.confirm('Tem certeza que deseja apagar este chat? Todas as mensagens e credenciais associadas serão removidas permanentemente.');
      
      if (!confirmed) return;
      
      // 1. Remover credenciais do Veramo
      const credentials = await agent.getChatCredentials();
      for (const cred of credentials) {
        try {
          const jwtData = parseJWT(cred.jwt);
          if (jwtData?.vc?.credentialSubject) {
            const subject = jwtData.vc.credentialSubject;
            
            // Verificar se é credencial relacionada ao chat
            if (subject.chatDid === chatId || subject.chatId === chatId) {
              console.log('🗑️ Removendo credencial:', cred.id);
              await agent.deleteCredential(cred.id);
            }
          }
        } catch (error) {
          console.error('Erro ao processar credencial para deletar:', error);
        }
      }
      
      // 2. Remover mensagens do banco local
      await db.messages.where('chatId').equals(chatId).delete();
      console.log('🗑️ Mensagens removidas do chat:', chatId);
      
      // 3. Remover webhook configs se existirem
      await db.webhookConfigs.where('chatId').equals(chatId).delete();
      console.log('🗑️ Configs de webhook removidas do chat:', chatId);
      
      // 4. Remover o chat do banco local
      await db.chatRooms.where('chatId').equals(chatId).delete();
      console.log('🗑️ Chat removido do banco:', chatId);
      
      // 5. Atualizar estado
      if (selectedChatId === chatId) {
        selectChat(null);
      }
      
      // 6. Recarregar lista de chats
      await loadChats();
      
      console.log('✅ Chat deletado com sucesso:', chatId);
      alert('Chat deletado com sucesso!');
      
    } catch (error: any) {
      console.error('❌ Erro ao deletar chat:', error);
      alert('Erro ao deletar chat: ' + error.message);
    }
  };

  const handleSendMessage = async () => {
    if (!messageValue.trim() || !selectedChatId || !currentUserDid || isSending) return;

    setIsSending(true);
    try {
      const timestamp = new Date().toISOString();
      
      const messageData = {
        type: 'chat_message',
        chatId: selectedChatId,
        sender: currentUserDid,
        content: messageValue.trim(),
        timestamp: timestamp
      };

      await sendWebSocketMessage(messageData);
      
      clearMessage();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem');
    } finally {
      setIsSending(false);
    }
  };

  const handleProcessInvite = async () => {
    if (!inviteCode.trim() || !currentUserDid || !agent || isProcessingInvite) return;
    
    console.log('🎫 Processando convite com nova estrutura...');
    setIsProcessingInvite(true);
    
    try {
      const jwtToken = inviteCode.trim();
      
      console.log('🔍 Verificando credencial de convite...');
      
      const result = await agent.verifyCredential({
        credential: jwtToken
      });

      console.log('✅ Resultado da verificação:', result);

      if (result.verified) {
        const credential = result.verifiableCredential;
        const subject = credential.credentialSubject;
        
        // Verificar se é credencial de convite
        if (!credential.type.includes('ChatInviteCredential')) {
          throw new Error('Tipo de credencial inválido. Esperado: ChatInviteCredential');
        }

        const chatDid = subject.chatDid;
        const chatCredentialId = subject.chatCredentialId;
        const permissions = subject.permissions || ['read', 'write'];

        console.log('📋 Dados do convite:', {
          chatDid,
          chatCredentialId,
          permissions,
          inviteType: subject.inviteType
        });

        // Buscar a credencial do chat referenciada
        const chatCredential = await agent.getCredential(chatCredentialId);
        if (!chatCredential) {
          throw new Error('Credencial do chat referenciada não encontrada');
        }

        // Decodificar a credencial do chat para obter informações
        const chatData = parseJWT(chatCredential.jwt);
        if (!chatData?.vc?.credentialSubject) {
          throw new Error('Dados do chat inválidos');
        }

        const chatInfo = chatData.vc.credentialSubject;
        const chatName = chatInfo.chatName || 'Chat sem nome';
        const owner = chatInfo.owner;
        const websocketUrl = chatInfo.websocketUrl || 'ws://192.168.15.3:8080';

        const existingChat = await db.chatRooms.where('chatId').equals(chatDid).first();
        
        if (existingChat) {
          console.log('⚠️ Você já tem acesso a este chat');
          alert('Você já tem acesso a este chat!');
          selectChat(chatDid);
          clearInvite();
          return;
        }

        // Salvar credencial de acesso no Veramo
        await agent.saveChatCredential(
          jwtToken, // Salvar a credencial de convite
          chatDid,
          owner
        );

        await db.chatRooms.add({
          chatId: chatDid,
          name: chatName,
          ownerDid: owner,
          createdAt: chatInfo.createdAt || new Date().toISOString(),
          isOwner: false,
          saveMessagesLocally: true,
          webhookEnabled: false,
          websocketUrl: websocketUrl,
          isActive: chatInfo.status === 'active'
        });

        await loadChats();
        
        await new Promise(resolve => setTimeout(resolve, 150));
        
        selectChat(chatDid);
        clearInvite();
        
        console.log('✅ Convite aceito! Você entrou no chat.');
        alert(`✅ Convite aceito! Você entrou no chat "${chatName}"`);
      } else {
        console.error('❌ Credencial inválida:', result.error);
        throw new Error(result.error?.message || 'Credencial inválida');
      }
    } catch (error: any) {
      console.error('❌ Erro ao processar convite:', error);
      alert(`Erro ao processar convite: ${error.message}`);
    } finally {
      setIsProcessingInvite(false);
    }
  };

  const handleSaveWebhook = async () => {
    if (!webhookData.url.trim() || !selectedChatId) return;

    try {
      await registerWebhook(webhookData.url, webhookData.retries);
      console.log('Webhook configurado com sucesso');
    } catch (error) {
      console.error('Erro ao configurar webhook:', error);
    }
  };

  // Função para debugar credenciais
  const debugCredentials = async () => {
    if (!agent) return;
    
    try {
      const allCredentials = await agent.getAllCredentials();
      const chatCredentials = await agent.getChatCredentials();
      
      console.log('🔍 Todas as credenciais:', allCredentials);
      console.log('💬 Credenciais de chat:', chatCredentials);
      
      const shouldClear = confirm(`Credenciais armazenadas: ${allCredentials.length} total, ${chatCredentials.length} de chat.\n\nDeseja limpar todas as credenciais?`);
      
      if (shouldClear) {
        await agent.clearAllCredentials();
        console.log('🧹 Credenciais limpas');
        alert('Credenciais limpas! Recarregue a página.');
      }
    } catch (error) {
      console.error('❌ Erro ao listar credenciais:', error);
    }
  };

  const handleToggleChatStatus = async (chatId?: string) => {
    const targetChatId = chatId || selectedChatId;
    const targetChat = chats.find(c => c.id === targetChatId);
    
    if (!targetChatId || !targetChat || !targetChat.isOwner) return;

    try {
      const newStatus = !targetChat.isActive;
      
      await db.chatRooms.where('chatId').equals(targetChatId).modify({
        isActive: newStatus
      });

      await loadChats();
      
      console.log(`🔄 Chat ${newStatus ? 'ativado' : 'desativado'}`);
      alert(`Chat ${newStatus ? 'ativado' : 'desativado'} com sucesso!`);
    } catch (error) {
      console.error('❌ Erro ao alterar status do chat:', error);
      alert('Erro ao alterar status do chat');
    }
  };

  const handleCreateQRInvite = async () => {
    if (!selectedChatId || !selectedChat || !currentUserDid || !agent) return;

    try {
      console.log('🎫 Criando convite QR P2P com VC...');
      
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const vcJwt = await agent.createVerifiableCredential({
        credential: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiableCredential', 'ChatAccessCredential'],
          issuer: { id: currentUserDid },
          issuanceDate: new Date().toISOString(),
          expirationDate: expiresAt.toISOString(),
          credentialSubject: {
            chatId: selectedChatId,
            chatName: selectedChat.name,
            permissions: ['read', 'write'],
            maxUses: 10,
            inviteId: `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            websocketUrl: 'ws://192.168.15.3:8080',
            webhookConfig: selectedChat.isOwner ? webhookData : null,
            chatStatus: selectedChat.isActive !== false ? 'active' : 'inactive'
          }
        },
        proofFormat: 'jwt'
      });

      setQrData(vcJwt.proof.jwt);
      setQrMode('generate');
      setShowQRModal(true);
    } catch (error) {
      console.error('❌ Erro ao criar convite QR:', error);
      alert('Erro ao criar convite QR');
    }
  };

  if (view === "loading") {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-gray-400 mt-4">Inicializando aplicação...</p>
        </div>
      </div>
    );
  }

  if (view === "error") {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">😞</div>
          <h1 className="text-xl font-bold text-white mb-2">Erro na aplicação</h1>
          <p className="text-gray-400 mb-4">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-500"
          >
            🔄 Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex relative">
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}
      
      <div className={`${
        showSidebar ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 fixed lg:relative z-50 lg:z-auto w-80 lg:w-80 h-full transition-transform duration-300 ease-in-out`}>
        <Sidebar
          chats={chats}
          selectedChatId={selectedChatId}
          onChatSelect={(chatId) => {
            selectChat(chatId);
            setShowSidebar(false); 
          }}
          onlineUsers={onlineUsers}
          onCreateChat={handleCreateChat}
          isCreatingChat={isCreatingChat}
          inviteCode={inviteCode}
          onInviteCodeChange={setInviteCode}
          onProcessInvite={handleProcessInvite}
          isProcessingInvite={isProcessingInvite}
          webhookData={webhookData}
          onWebhookDataChange={setWebhookData}
          onSaveWebhook={handleSaveWebhook}
          isSavingWebhook={isSavingWebhook}
          onScanQR={() => {
            setQrMode('scan');
            setShowQRModal(true);
            setShowSidebar(false);
          }}
          onToggleChat={handleToggleChatStatus}
          onDeleteChat={handleDeleteChat}
          onDebugCredentials={debugCredentials}
        />
      </div>

      <div className="flex-1 flex flex-col lg:ml-0">
        {selectedChat ? (
          <ChatArea
            chatName={selectedChat.name}
            isOwner={selectedChat.isOwner || false}
            isConnected={isConnected}
            isOnline={onlineUsers.has(selectedChatId || '')}
            isActive={selectedChat.isActive !== false}
            messages={messages}
            messageValue={messageValue}
            onMessageChange={setMessageValue}
            onSendMessage={handleSendMessage}
            isSending={isSending}
            isLoadingMessages={isLoadingMessages}
            onLoadMore={() => loadMessages(50, messages.length)}
            hasMoreMessages={hasMoreMessages}
            error={connectionError}
            onReconnect={() => window.location.reload()}
            onWebhook={() => setShowWebhookModal(true)}
            onInvite={() => setShowInviteModal(true)}
            onBack={() => setShowSidebar(true)}
            onToggleChat={handleToggleChatStatus}
            onShareQR={() => {
              if (selectedChatId) {
                handleCreateQRInvite();
              }
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400 px-4">
              <h2 className="text-xl font-semibold mb-2">Bem-vindo ao Web5 Chat</h2>
              <p className="mb-4">Selecione um chat ou crie um novo para começar</p>

              <button
                onClick={() => setShowSidebar(true)}
                className="lg:hidden bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-500 mb-4"
              >
                📱 Abrir Menu
              </button>
              
              <div className="mt-4 text-sm">
                <p className="break-all">👤 Seu DID: <span className="font-mono text-xs">{currentUserDid}</span></p>
              </div>
            </div>
          </div>
        )}
      </div>

      {showWebhookModal && selectedChatId && selectedChat && (
        <WebhookConfigModal
          chatId={selectedChatId}
          chatName={selectedChat.name}
          currentWebhook={webhookHook.webhook ? {
            url: webhookHook.webhook.url,
            events: [], 
            isActive: webhookHook.webhook.active
          } : null}
          isOpen={showWebhookModal}
          onClose={() => setShowWebhookModal(false)}
          onSave={async (config) => {
            await webhookHook.saveWebhook(config);
            setShowWebhookModal(false);
          }}
          onDelete={async () => {
            await webhookHook.deleteWebhook();
            setShowWebhookModal(false);
          }}
          onTest={webhookHook.testWebhook}
        />
      )}

      {showInviteModal && selectedChatId && selectedChat && currentUserDid && agent && (
        <InviteModal
          chatId={selectedChatId}
          chatName={selectedChat.name}
          chatDid={selectedChatId}
          ownerDid={currentUserDid}
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onCreateInvite={async (config) => {
            try {
              console.log('🎫 Criando convite com nova estrutura...');
              
              const expiresAt = new Date();
              expiresAt.setHours(expiresAt.getHours() + config.expiresIn);

              // Buscar a credencial do chat para referenciar
              const chatCredentials = await agent.getChatCredentials();
              const chatCredential = chatCredentials.find((cred: any) => {
                // Decodificar JWT para verificar se é do chat atual
                try {
                  const decoded = parseJWT(cred.jwt);
                  return decoded?.vc?.credentialSubject?.id === selectedChatId;
                } catch {
                  return false;
                }
              });

              if (!chatCredential) {
                throw new Error('Credencial do chat não encontrada');
              }

              // Criar credencial de convite que referencia a credencial do chat
              const inviteCredential = await agent.createVerifiableCredential({
                credential: {
                  '@context': ['https://www.w3.org/2018/credentials/v1'],
                  type: ['VerifiableCredential', 'ChatInviteCredential'],
                  issuer: { id: currentUserDid },
                  issuanceDate: new Date().toISOString(),
                  expirationDate: expiresAt.toISOString(),
                  credentialSubject: {
                    id: `did:invite:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
                    chatDid: selectedChatId,
                    chatCredentialId: chatCredential.hash, // Referência à credencial do chat
                    permissions: config.permissions,
                    maxUses: config.maxUses,
                    inviteType: 'access'
                  }
                },
                proofFormat: 'jwt'
              });

              console.log('✅ Credencial de convite criada:', inviteCredential);

              const inviteCode = inviteCredential.proof.jwt;

              return {
                credential: inviteCredential,
                inviteCode: inviteCode,
                expiresAt: expiresAt.toISOString(),
                maxUses: config.maxUses,
                usedCount: 0,
                createdAt: new Date().toISOString()
              };
            } catch (error) {
              console.error('❌ Erro ao criar convite:', error);
              throw error;
            }
          }}
        />
      )}

      {showQRModal && (
        <QRCodeModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          mode={qrMode}
          data={qrMode === 'generate' ? qrData : undefined}
          title={qrMode === 'generate' ? 'Compartilhar Convite' : 'Escanear Convite'}
          onScanResult={(result: string) => {
            console.log('QR Code escaneado:', result);
            setInviteCode(result);
            setShowQRModal(false);

            if (result.trim()) {
              setTimeout(() => {
                handleProcessInvite();
              }, 500);
            }
          }}
        />
      )}

      {showSecurityWarning && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-600 text-black p-3 z-50">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span className="text-sm">
                <strong>Modo de Compatibilidade:</strong> Conexão não segura detectada. 
                Criptografia limitada ativada.
              </span>
            </div>
            <button
              onClick={() => setShowSecurityWarning(false)}
              className="text-black hover:text-gray-700 font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;