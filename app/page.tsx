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

  const handleCreateChat = async () => {
    if (!currentUserDid || !agent || isCreatingChat) return;
    
    setIsCreatingChat(true);
    try {
      const chatId = `chat:${currentUserDid}:${Date.now()}`;
      const chatName = `Chat ${new Date().toLocaleString()}`;

      const vcJwt = await agent.createVerifiableCredential({
        credential: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiableCredential', 'ChatOwnershipCredential'],
          issuer: { id: currentUserDid },
          issuanceDate: new Date().toISOString(),
          credentialSubject: {
            id: currentUserDid,
            chatId: chatId,
            role: 'owner',
            chatName: chatName,
            permissions: ['read', 'write', 'invite', 'manage']
          }
        },
        proofFormat: 'jwt'
      });

      console.log('✅ Chat criado com VC:', vcJwt);

      await db.chatRooms.add({
        chatId: chatId,
        name: chatName,
        ownerDid: currentUserDid,
        createdAt: new Date().toISOString(),
        isOwner: true,
        saveMessagesLocally: true,
        webhookEnabled: false,
        websocketUrl: 'ws://192.168.15.3:8080',
        isActive: true
      });

      await db.credentials.add({
        chatId: chatId,
        issuerDid: currentUserDid,
        jwt: vcJwt.proof.jwt,
        receivedAt: new Date().toISOString()
      });

      const newChat: Chat = {
        id: chatId,
        name: chatName,
        host: currentUserDid,
        isOwner: true,
        webhookEnabled: false,
        saveLocally: true
      };
      
      addChat(newChat);
      selectChat(chatId);
    } catch (error) {
      console.error('Erro ao criar chat:', error);
    } finally {
      setIsCreatingChat(false);
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
    
    console.log('🎫 Processando convite P2P...');
    setIsProcessingInvite(true);
    
    try {
      const jwtToken = inviteCode.trim();
      
      console.log('🔍 Verificando VC...');
      
      const result = await agent.verifyCredential({
        credential: jwtToken
      });

      console.log('✅ Resultado da verificação:', result);

      if (result.verified) {
        const credential = result.verifiableCredential;
        const subject = credential.credentialSubject;
        
        const chatId = subject.chatId;
        const chatName = subject.chatName || 'Chat sem nome';
        const hostDid = credential.issuer.id;
        const permissions = subject.permissions || ['read', 'write'];
        const websocketUrl = subject.websocketUrl || 'ws://localhost:8080';
        const webhookConfig = subject.webhookConfig;
        const chatStatus = subject.chatStatus || 'active';

        console.log('📋 Dados do convite:', {
          chatId,
          chatName,
          hostDid,
          permissions,
          websocketUrl,
          webhookConfig,
          chatStatus
        });

        const existingChat = await db.chatRooms.where('chatId').equals(chatId).first();
        
        if (existingChat) {
          console.log('⚠️ Você já tem acesso a este chat');
          alert('Você já tem acesso a este chat!');
          selectChat(chatId);
          clearInvite();
          return;
        }

        await db.credentials.add({
          chatId: chatId,
          issuerDid: hostDid,
          jwt: jwtToken,
          receivedAt: new Date().toISOString()
        });

        await db.chatRooms.add({
          chatId: chatId,
          name: chatName,
          ownerDid: hostDid,
          createdAt: credential.issuanceDate || new Date().toISOString(),
          isOwner: false,
          saveMessagesLocally: true,
          webhookEnabled: false,
          websocketUrl: websocketUrl,
          isActive: chatStatus === 'active'
        });

        if (webhookConfig) {
          await db.webhookConfigs.add({
            chatId: chatId,
            ownerDid: hostDid,
            url: webhookConfig.url || '',
            secret: webhookConfig.secret || '',
            active: webhookConfig.active || false,
            retryAttempts: webhookConfig.retryAttempts || 3,
            headers: webhookConfig.headers || {},
            createdAt: new Date().toISOString()
          });
        }

        await loadChats();
        
        await new Promise(resolve => setTimeout(resolve, 150));
        
        selectChat(chatId);
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
              console.log('🎫 Criando convite P2P com VC...');
              
              const expiresAt = new Date();
              expiresAt.setHours(expiresAt.getHours() + config.expiresIn);

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
                    permissions: config.permissions,
                    maxUses: config.maxUses,
                    inviteId: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                  }
                },
                proofFormat: 'jwt'
              });

              console.log('✅ VC criada:', vcJwt);

              const inviteCode = vcJwt.proof.jwt;

              return {
                credential: vcJwt,
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

      {/* Aviso de Segurança para HTTP */}
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