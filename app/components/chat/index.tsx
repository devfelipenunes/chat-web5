import { Button, Input, StatusIndicator, Badge, LoadingSpinner } from '../ui';

interface Message {
  id: string;
  content: string;
  senderDid: string;
  timestamp: string;
  isCurrentUser: boolean;
}

interface ChatHeaderProps {
  chatName: string;
  isOwner: boolean;
  isConnected: boolean;
  isOnline?: boolean;
  isActive?: boolean;
  onBack?: () => void;
  onSettings?: () => void;
  onWebhook?: () => void;
  onInvite?: () => void;
  onShareQR?: () => void;
  onToggleChat?: () => void;
}

export const ChatHeader = ({ 
  chatName, 
  isOwner, 
  isConnected, 
  isOnline = false,
  isActive = true,
  onBack,
  onSettings,
  onWebhook,
  onInvite,
  onShareQR,
  onToggleChat
}: ChatHeaderProps) => {
  return (
    <div className="bg-gray-800 border-b border-gray-700 p-3 lg:p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1">
          {onBack && (
            <Button
              onClick={onBack}
              variant="secondary"
              size="sm"
              className="lg:hidden flex-shrink-0 w-8 h-8 p-1"
            >
              ←
            </Button>
          )}
          
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h2 className="text-sm lg:text-lg font-semibold text-white truncate">{chatName}</h2>
            <StatusIndicator isOnline={isOnline} size="sm" />
          </div>
        </div>

        <div className="flex items-center gap-1 lg:gap-2 flex-shrink-0">
          <Badge 
            variant={isOwner ? 'primary' : 'secondary'}
            className="text-xs hidden sm:inline-flex"
          >
            {isOwner ? 'Dono' : 'Convidado'}
          </Badge>

          <Badge 
            variant={isConnected ? 'success' : 'danger'}
            className="text-xs"
          >
            <span className="lg:hidden">{isConnected ? '🟢' : '🔴'}</span>
            <span className="hidden lg:inline">{isConnected ? 'Conectado' : 'Desconectado'}</span>
          </Badge>

          {isOwner && onInvite && (
            <Button
              onClick={onInvite}
              variant="primary"
              size="sm"
              className="text-xs lg:text-sm px-2 py-1 lg:px-3 lg:py-2"
            >
              <span className="lg:hidden">📨</span>
              <span className="hidden lg:inline">📨 Convite</span>
            </Button>
          )}

          {isOwner && onShareQR && (
            <Button
              onClick={onShareQR}
              variant="success"
              size="sm"
              className="text-xs lg:text-sm px-2 py-1 lg:px-3 lg:py-2"
            >
              <span className="lg:hidden">📱</span>
              <span className="hidden lg:inline">📱 QR</span>
            </Button>
          )}

          {isOwner && onToggleChat && (
            <Button
              onClick={onToggleChat}
              variant={isActive ? "success" : "danger"}
              size="sm"
              className="text-xs lg:text-sm px-2 py-1 lg:px-3 lg:py-2"
            >
              <span className="lg:hidden">{isActive ? '🟢' : '🔴'}</span>
              <span className="hidden lg:inline">{isActive ? '🟢 On' : '🔴 Off'}</span>
            </Button>
          )}

          {isOwner && onWebhook && (
            <Button
              onClick={onWebhook}
              variant="secondary"
              size="sm"
              className="hidden sm:inline-flex text-xs lg:text-sm px-2 py-1 lg:px-3 lg:py-2"
            >
              <span className="lg:hidden">🔗</span>
              <span className="hidden lg:inline">🔗 Webhook</span>
            </Button>
          )}

          {onSettings && (
            <Button
              onClick={onSettings}
              variant="secondary"
              size="sm"
              className="hidden sm:inline-flex text-xs lg:text-sm px-2 py-1 lg:px-3 lg:py-2"
            >
              ⚙️
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

interface MessageBubbleProps {
  message: Message;
  showSender?: boolean;
}

export const MessageBubble = ({ message, showSender = true }: MessageBubbleProps) => {
  const isCurrentUser = message.isCurrentUser;
  
  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-3 px-2 sm:px-3 lg:px-4`}>
      <div className={`max-w-[85%] sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-2xl ${isCurrentUser ? 'ml-auto' : 'mr-auto'}`}>
        <div
          className={`px-3 py-2 sm:px-4 sm:py-3 rounded-2xl shadow-sm word-wrap break-words overflow-wrap-anywhere ${
            isCurrentUser
              ? 'bg-blue-500 text-white rounded-br-md'
              : 'bg-gray-700 text-gray-100 rounded-bl-md'
          }`}
        >
          {showSender && (
            <div className={`text-xs mb-1 truncate ${
              isCurrentUser ? 'text-blue-100' : 'text-gray-400'
            }`}>
              {isCurrentUser ? 'Você' : `${message.senderDid.slice(-8)}`}
            </div>
          )}
          
                    <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap word-break break-words hyphens-auto overflow-hidden">
            {message.content}
          </div>
          
          <div className={`text-xs mt-2 opacity-75 ${ 
            isCurrentUser ? 'text-blue-100' : 'text-gray-400'
          }`}>
            {new Date(message.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export const MessageList = ({ 
  messages, 
  isLoading = false, 
  onLoadMore,
  hasMore = false 
}: MessageListProps) => {
  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-gray-400 mt-2">Carregando mensagens...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-gray-400 max-w-sm">
          <div className="text-4xl lg:text-6xl mb-4">💬</div>
          <p className="text-base lg:text-lg font-medium">Nenhuma mensagem ainda</p>
          <p className="text-sm lg:text-base mt-2 text-gray-500">
            Seja o primeiro a enviar uma mensagem!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-1 sm:p-2 lg:p-4 pb-safe">
      {hasMore && (
        <div className="text-center mb-3 sm:mb-4">
          <Button
            onClick={onLoadMore}
            variant="secondary"
            size="sm"
            disabled={isLoading}
            className="text-xs sm:text-sm px-3 py-2"
          >
            {isLoading ? 'Carregando...' : 'Carregar mais mensagens'}
          </Button>
        </div>
      )}

      <div className="space-y-2 sm:space-y-3 min-h-0">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            showSender={true}
          />
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center mt-4">
          <LoadingSpinner size="md" />
        </div>
      )}
    </div>
  );
};

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  isConnected?: boolean;
  isSending?: boolean;
}

export const ChatInput = ({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "Digite sua mensagem...",
  isConnected = true,
  isSending = false
}: ChatInputProps) => {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled && !isSending) {
        onSend();
      }
    }
  };

  const canSend = value.trim() && !disabled && !isSending && isConnected;

  return (
    <div className="bg-gray-800 border-t border-gray-700 p-3 lg:p-4">
      {!isConnected && (
        <div className="mb-2 text-center">
          <Badge variant="warning" className="text-xs">
            Desconectado - As mensagens não serão enviadas
          </Badge>
        </div>
      )}

      <div className="flex gap-2 lg:gap-3">
        <div className="flex-1">
          <Input
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled || !isConnected}
            className="w-full text-sm lg:text-base py-2 lg:py-3"
            onKeyPress={handleKeyPress}
          />
        </div>

        <Button
          onClick={onSend}
          disabled={!canSend}
          variant="primary"
          className="px-3 py-2 lg:px-6 lg:py-3 text-sm lg:text-base flex-shrink-0"
        >
          {isSending ? (
            <LoadingSpinner size="sm" />
          ) : (
            <>
              <span className="lg:hidden">📤</span>
              <span className="hidden lg:inline">Enviar</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

interface ConnectionStatusProps {
  isConnected: boolean;
  isConnecting: boolean;
  error?: string | null;
  onReconnect?: () => void;
}

export const ConnectionStatus = ({
  isConnected,
  isConnecting,
  error,
  onReconnect
}: ConnectionStatusProps) => {
  if (isConnected) {
    return null;
  }

  return (
    <div className="bg-yellow-600 text-white p-3 text-center">
      <div className="flex items-center justify-center gap-2">
        {isConnecting ? (
          <>
            <LoadingSpinner size="sm" />
            <span>Conectando...</span>
          </>
        ) : (
          <>
            <span>⚠️ Desconectado</span>
            {error && <span className="text-sm">({error})</span>}
            {onReconnect && (
              <Button
                onClick={onReconnect}
                variant="secondary"
                size="sm"
                className="ml-2"
              >
                Reconectar
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface ChatAreaProps {
  chatName: string;
  isOwner: boolean;
  isConnected: boolean;
  isOnline?: boolean;
  isActive?: boolean;
  messages: Message[];
  messageValue: string;
  onMessageChange: (value: string) => void;
  onSendMessage: () => void;
  isSending?: boolean;
  isLoadingMessages?: boolean;
  onLoadMore?: () => void;
  hasMoreMessages?: boolean;
  error?: string | null;
  onReconnect?: () => void;
  onBack?: () => void;
  onSettings?: () => void;
  onWebhook?: () => void;
  onInvite?: () => void;
  onShareQR?: () => void;
  onToggleChat?: () => void;
}

export const ChatArea = ({
  chatName,
  isOwner,
  isConnected,
  isOnline = false,
  isActive = true,
  messages,
  messageValue,
  onMessageChange,
  onSendMessage,
  isSending = false,
  isLoadingMessages = false,
  onLoadMore,
  hasMoreMessages = false,
  error,
  onReconnect,
  onBack,
  onSettings,
  onWebhook,
  onInvite,
  onShareQR,
  onToggleChat
}: ChatAreaProps) => {
  return (
    <div className="flex-1 flex flex-col h-full">
      <ChatHeader
        chatName={chatName}
        isOwner={isOwner}
        isConnected={isConnected}
        isOnline={isOnline}
        isActive={isActive}
        onBack={onBack}
        onSettings={onSettings}
        onWebhook={onWebhook}
        onInvite={onInvite}
        onShareQR={onShareQR}
        onToggleChat={onToggleChat}
      />

      <ConnectionStatus
        isConnected={isConnected}
        isConnecting={false}
        error={error}
        onReconnect={onReconnect}
      />

      <MessageList
        messages={messages}
        isLoading={isLoadingMessages}
        onLoadMore={onLoadMore}
        hasMore={hasMoreMessages}
      />

      <ChatInput
        value={messageValue}
        onChange={onMessageChange}
        onSend={onSendMessage}
        disabled={false}
        isConnected={isConnected}
        isSending={isSending}
      />
    </div>
  );
};