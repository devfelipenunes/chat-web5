/**
 * Componente de Configuração de Webhook por Chat
 * Permite configurar webhook específico para cada sala de chat
 */

import React, { useState, useEffect } from 'react';
import { X, Webhook, Save, Trash2, TestTube } from 'lucide-react';

interface WebhookConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  chatName: string;
  currentWebhook?: {
    url: string;
    events: string[];
    isActive: boolean;
  } | null;
  onSave: (webhook: { url: string; events: string[]; isActive: boolean }) => Promise<void>;
  onDelete: () => Promise<void>;
  onTest: () => Promise<boolean>;
}

export const WebhookConfigModal: React.FC<WebhookConfigModalProps> = ({
  isOpen,
  onClose,
  chatId,
  chatName,
  currentWebhook,
  onSave,
  onDelete,
  onTest
}) => {
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const availableEvents = [
    { id: 'message_sent', label: 'Nova Mensagem', description: 'Quando uma mensagem é enviada' },
    { id: 'user_joined', label: 'Usuário Entrou', description: 'Quando alguém entra no chat' },
    { id: 'user_left', label: 'Usuário Saiu', description: 'Quando alguém sai do chat' },
    { id: 'chat_created', label: 'Chat Criado', description: 'Quando o chat é criado' },
    { id: 'invite_created', label: 'Convite Criado', description: 'Quando um convite é gerado' },
    { id: 'invite_used', label: 'Convite Usado', description: 'Quando um convite é aceito' }
  ];

  useEffect(() => {
    if (currentWebhook) {
      setUrl(currentWebhook.url);
      setSelectedEvents(currentWebhook.events);
      setIsActive(currentWebhook.isActive);
    } else {
      setUrl('');
      setSelectedEvents(['message_sent']);
      setIsActive(true);
    }
    setTestResult(null);
  }, [currentWebhook, isOpen]);

  const handleEventToggle = (eventId: string) => {
    setSelectedEvents(prev =>
      prev.includes(eventId)
        ? prev.filter(e => e !== eventId)
        : [...prev, eventId]
    );
  };

  const handleSave = async () => {
    if (!url || selectedEvents.length === 0) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave({ url, events: selectedEvents, isActive });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar webhook:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const success = await onTest();
      setTestResult({
        success,
        message: success ? 'Webhook testado com sucesso!' : 'Falha ao testar webhook'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Erro ao testar webhook: ' + (error as Error).message
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('Tem certeza que deseja remover o webhook deste chat?')) {
      try {
        await onDelete();
        onClose();
      } catch (error) {
        console.error('Erro ao deletar webhook:', error);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Webhook className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Configurar Webhook
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Chat: {chatName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              URL do Webhook *
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://exemplo.com/webhook"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Esta URL receberá notificações POST dos eventos selecionados
            </p>
          </div>

          {/* Events Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Eventos para Notificar *
            </label>
            <div className="space-y-2">
              {availableEvents.map((event) => (
                <label
                  key={event.id}
                  className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(event.id)}
                    onChange={() => handleEventToggle(event.id)}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {event.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {event.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                Webhook Ativo
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Ativar/desativar notificações sem remover a configuração
              </div>
            </div>
            <button
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActive ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`p-4 rounded-lg ${
                testResult.success
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
              }`}
            >
              <p className="text-sm font-medium">{testResult.message}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            {currentWebhook && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Remover
              </button>
            )}
            <button
              onClick={handleTest}
              disabled={!url || isTesting}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TestTube className="w-4 h-4" />
              {isTesting ? 'Testando...' : 'Testar'}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!url || selectedEvents.length === 0 || isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};