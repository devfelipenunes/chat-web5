import { Chat, WebhookFormData } from '../../types';
import { StatusIndicator, Button, Input, Card } from '../ui';

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | null;
  onChatSelect: (chatId: string) => void;
  onlineUsers: Set<string>;
  onToggleChat?: (chatId: string) => void;
}

export const ChatList = ({ chats, selectedChatId, onChatSelect, onlineUsers, onToggleChat }: ChatListProps) => {
  if (chats.length === 0) {
    return (
      <div className="text-gray-400 text-sm text-center py-8">
        Nenhum chat encontrado.
        <br />
        Crie um novo chat ou aguarde convites.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {chats.map((chat) => {
        const isOnline = onlineUsers.has(chat.id);
        const isSelected = selectedChatId === chat.id;
        
        return (
          <div
            key={chat.id}
            onClick={() => onChatSelect(chat.id)}
            className={`p-3 rounded-lg cursor-pointer transition-colors ${
              isSelected
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div 
                className="flex-1 cursor-pointer"
                onClick={() => onChatSelect(chat.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {chat.name}
                  </span>
                  <StatusIndicator isOnline={isOnline} size="sm" />
                  {chat.isActive !== false && (
                    <span className="text-xs text-green-400">●</span>
                  )}
                  {chat.isActive === false && (
                    <span className="text-xs text-red-400">●</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {chat.isOwner ? 'Você criou' : 'Convidado'}
                </div>
              </div>
              
              {chat.isOwner && onToggleChat && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleChat(chat.id);
                  }}
                  variant={chat.isActive !== false ? "success" : "danger"}
                  size="sm"
                  className="ml-2 px-2 py-1 text-xs"
                >
                  {chat.isActive !== false ? '🟢' : '🔴'}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface NewChatButtonProps {
  onCreateChat: () => void;
  isCreating: boolean;
}

export const NewChatButton = ({ onCreateChat, isCreating }: NewChatButtonProps) => {
  return (
    <Button
      onClick={onCreateChat}
      disabled={isCreating}
      variant="primary"
      className="w-full"
    >
      {isCreating ? 'Criando...' : '+ Novo Chat'}
    </Button>
  );
};

interface InviteFormProps {
  inviteCode: string;
  onInviteCodeChange: (code: string) => void;
  onProcessInvite: () => void;
  isProcessing: boolean;
  onScanQR?: () => void;
}

export const InviteForm = ({ 
  inviteCode, 
  onInviteCodeChange, 
  onProcessInvite, 
  isProcessing,
  onScanQR 
}: InviteFormProps) => {
  return (
    <Card>
      <h3 className="text-lg font-semibold mb-3">Processar Convite</h3>
      <div className="space-y-3">
        <Input
          value={inviteCode}
          onChange={onInviteCodeChange}
          placeholder="Cole o código do convite aqui..."
          disabled={isProcessing}
        />
        <div className="flex gap-2">
          <Button
            onClick={onProcessInvite}
            disabled={!inviteCode.trim() || isProcessing}
            variant="success"
            className="flex-1"
          >
            {isProcessing ? 'Processando...' : 'Aceitar Convite'}
          </Button>
          {onScanQR && (
            <Button
              onClick={onScanQR}
              disabled={isProcessing}
              variant="secondary"
              className="px-3"
            >
              📱
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

interface WebhookConfigProps {
  webhookData: WebhookFormData;
  onWebhookDataChange: (data: WebhookFormData) => void;
  onSaveWebhook: () => void;
  isSaving: boolean;
}

export const WebhookConfig = ({
  webhookData,
  onWebhookDataChange,
  onSaveWebhook,
  isSaving
}: WebhookConfigProps) => {
  const updateWebhookField = (field: keyof WebhookFormData, value: string | number) => {
    onWebhookDataChange({
      ...webhookData,
      [field]: value
    });
  };

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-3">Configurar Webhook</h3>
      <div className="space-y-3">
        <Input
          value={webhookData.url}
          onChange={(value) => updateWebhookField('url', value)}
          placeholder="URL do webhook"
          type="url"
          disabled={isSaving}
        />
        
        <Input
          value={webhookData.secret}
          onChange={(value) => updateWebhookField('secret', value)}
          placeholder="Chave secreta (opcional)"
          disabled={isSaving}
        />
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Max Tentativas</label>
            <Input
              value={webhookData.retries.toString()}
              onChange={(value) => updateWebhookField('retries', parseInt(value) || 3)}
              type="number"
              min={1}
              max={10}
              disabled={isSaving}
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Timeout (ms)</label>
            <Input
              value={webhookData.timeout.toString()}
              onChange={(value) => updateWebhookField('timeout', parseInt(value) || 5000)}
              type="number"
              min={1000}
              max={30000}
              disabled={isSaving}
            />
          </div>
        </div>
        
        <Button
          onClick={onSaveWebhook}
          disabled={!webhookData.url.trim() || isSaving}
          variant="primary"
          className="w-full"
        >
          {isSaving ? 'Salvando...' : 'Salvar Webhook'}
        </Button>
      </div>
    </Card>
  );
};

// Main Sidebar Component
interface SidebarProps {
  chats: Chat[];
  selectedChatId: string | null;
  onChatSelect: (chatId: string) => void;
  onlineUsers: Set<string>;
  onCreateChat: () => void;
  isCreatingChat: boolean;
  inviteCode: string;
  onInviteCodeChange: (code: string) => void;
  onProcessInvite: () => void;
  isProcessingInvite: boolean;
  webhookData: WebhookFormData;
  onWebhookDataChange: (data: WebhookFormData) => void;
  onSaveWebhook: () => void;
  isSavingWebhook: boolean;
  onScanQR?: () => void;
  onToggleChat?: (chatId: string) => void;
}


export const Sidebar = ({
  chats,
  selectedChatId,
  onChatSelect,
  onlineUsers,
  onCreateChat,
  isCreatingChat,
  inviteCode,
  onInviteCodeChange,
  onProcessInvite,
  isProcessingInvite,
  webhookData,
  onWebhookDataChange,
  onSaveWebhook,
  isSavingWebhook,
  onScanQR,
  onToggleChat
}: SidebarProps) => {
  return (
    <div className="w-full h-full bg-gray-900 p-4 border-r border-gray-700 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Header */}
        <div className="pb-4 border-b border-gray-700">
          <h1 className="text-xl font-bold text-white">Web5 Chat</h1>
        </div>

        {/* New Chat Button */}
        <NewChatButton 
          onCreateChat={onCreateChat}
          isCreating={isCreatingChat}
        />

        {/* Chat List */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">
            Seus Chats
          </h2>
          <ChatList
            chats={chats}
            selectedChatId={selectedChatId}
            onChatSelect={onChatSelect}
            onlineUsers={onlineUsers}
            onToggleChat={onToggleChat}
          />
        </div>

        {/* Invite Form */}
        <InviteForm
          inviteCode={inviteCode}
          onInviteCodeChange={onInviteCodeChange}
          onProcessInvite={onProcessInvite}
          isProcessing={isProcessingInvite}
          onScanQR={onScanQR}
        />

        {/* Webhook Configuration */}
        <WebhookConfig
          webhookData={webhookData}
          onWebhookDataChange={onWebhookDataChange}
          onSaveWebhook={onSaveWebhook}
          isSaving={isSavingWebhook}
        />
      </div>
    </div>
  );
};