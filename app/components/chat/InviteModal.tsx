/**
 * Componente de Sistema de Convites com Credenciais Verificáveis
 * Emite credenciais VCs para acesso ao chat
 */

import React, { useState } from 'react';
import { X, Mail, Copy, Check, Shield, QrCode, Download } from 'lucide-react';

interface InviteCredential {
  credential: any; // Verifiable Credential
  inviteCode: string;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  createdAt: string;
}

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  chatName: string;
  chatDid: string;
  ownerDid: string;
  onCreateInvite: (config: {
    maxUses: number;
    expiresIn: number;
    permissions: string[];
  }) => Promise<InviteCredential>;
  existingInvites?: InviteCredential[];
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  chatId,
  chatName,
  chatDid,
  ownerDid,
  onCreateInvite,
  existingInvites = []
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresIn, setExpiresIn] = useState(24); // horas
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['read', 'write']);
  const [createdInvite, setCreatedInvite] = useState<InviteCredential | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const availablePermissions = [
    { id: 'read', label: 'Ler Mensagens', description: 'Pode visualizar mensagens do chat' },
    { id: 'write', label: 'Enviar Mensagens', description: 'Pode enviar mensagens no chat' },
    { id: 'invite', label: 'Criar Convites', description: 'Pode convidar outros usuários' },
    { id: 'manage', label: 'Gerenciar', description: 'Pode alterar configurações do chat' }
  ];

  const handlePermissionToggle = (permId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permId)
        ? prev.filter(p => p !== permId)
        : [...prev, permId]
    );
  };

  const handleCreateInvite = async () => {
    setIsCreating(true);
    try {
      const invite = await onCreateInvite({
        maxUses,
        expiresIn,
        permissions: selectedPermissions
      });
      setCreatedInvite(invite);
    } catch (error) {
      console.error('Erro ao criar convite:', error);
      alert('Erro ao criar convite: ' + (error as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyInvite = async (inviteCode: string) => {
    try {
      // Copia o JWT diretamente (convite P2P)
      await navigator.clipboard.writeText(inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar:', error);
    }
  };

  const handleDownloadCredential = (invite: InviteCredential) => {
    const credentialJson = JSON.stringify(invite.credential, null, 2);
    const blob = new Blob([credentialJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-invite-${invite.inviteCode}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatExpiresAt = (expiresAt: string) => {
    const date = new Date(expiresAt);
    return date.toLocaleString('pt-BR');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6 text-green-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Criar Convite com Credencial
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
          {!createdInvite ? (
            <>
              {/* Info sobre Credenciais */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-1">
                      Convite com Credencial Verificável (VC)
                    </h3>
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      Este convite gerará uma Verifiable Credential que comprova o acesso autorizado ao chat. 
                      Apenas quem possuir esta credencial poderá entrar nesta sala.
                    </p>
                  </div>
                </div>
              </div>

              {/* Configurações do Convite */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Número Máximo de Usos
                  </label>
                  <select
                    value={maxUses}
                    onChange={(e) => setMaxUses(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value={1}>1 uso (único)</option>
                    <option value={5}>5 usos</option>
                    <option value={10}>10 usos</option>
                    <option value={-1}>Ilimitado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Expira em
                  </label>
                  <select
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value={1}>1 hora</option>
                    <option value={6}>6 horas</option>
                    <option value={24}>24 horas</option>
                    <option value={72}>3 dias</option>
                    <option value={168}>7 dias</option>
                    <option value={720}>30 dias</option>
                  </select>
                </div>

                {/* Permissões */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Permissões da Credencial
                  </label>
                  <div className="space-y-2">
                    {availablePermissions.map((perm) => (
                      <label
                        key={perm.id}
                        className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(perm.id)}
                          onChange={() => handlePermissionToggle(perm.id)}
                          className="mt-1 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {perm.label}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {perm.description}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Create Button */}
              <button
                onClick={handleCreateInvite}
                disabled={isCreating || selectedPermissions.length === 0}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Shield className="w-5 h-5" />
                {isCreating ? 'Gerando Credencial...' : 'Criar Convite com Credencial'}
              </button>
            </>
          ) : (
            <>
              {/* Convite Criado */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 space-y-4">
                <div className="flex items-center gap-3 text-green-800 dark:text-green-200">
                  <Check className="w-6 h-6" />
                  <h3 className="font-semibold text-lg">Convite Criado com Sucesso!</h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-green-700 dark:text-green-300 uppercase flex items-center gap-2">
                      <Shield className="w-3 h-3" />
                      Credencial Verificável (JWT) - Convite P2P
                    </label>
                    <p className="text-xs text-green-600 dark:text-green-400 mb-2">
                      Compartilhe este JWT com o convidado. É peer-to-peer e validado localmente!
                    </p>
                    <div className="flex gap-2">
                      <textarea
                        readOnly
                        value={createdInvite.inviteCode}
                        className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-green-300 dark:border-green-700 rounded text-xs font-mono h-24 resize-none"
                      />
                      <button
                        onClick={() => handleCopyInvite(createdInvite.inviteCode)}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors self-start"
                        title="Copiar JWT"
                      >
                        {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-green-700 dark:text-green-300">Usos:</span>
                      <span className="ml-2 font-medium text-green-900 dark:text-green-100">
                        {createdInvite.maxUses === -1 ? 'Ilimitado' : `${createdInvite.usedCount}/${createdInvite.maxUses}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-green-700 dark:text-green-300">Expira:</span>
                      <span className="ml-2 font-medium text-green-900 dark:text-green-100">
                        {formatExpiresAt(createdInvite.expiresAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-green-200 dark:border-green-800">
                  <button
                    onClick={() => handleDownloadCredential(createdInvite)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-green-300 dark:border-green-700 rounded hover:bg-green-50 dark:hover:bg-gray-600 transition-colors text-green-800 dark:text-green-200"
                  >
                    <Download className="w-4 h-4" />
                    Baixar Credencial (JSON)
                  </button>
                </div>
              </div>

              <button
                onClick={() => setCreatedInvite(null)}
                className="w-full px-4 py-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
              >
                Criar Outro Convite
              </button>
            </>
          )}

          {/* Existing Invites */}
          {existingInvites.length > 0 && !createdInvite && (
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Convites Ativos ({existingInvites.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {existingInvites.map((invite) => (
                  <div
                    key={invite.inviteCode}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-gray-600 dark:text-gray-400 truncate">
                        {invite.inviteCode}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {invite.maxUses === -1 ? 'Ilimitado' : `${invite.usedCount}/${invite.maxUses} usos`} • 
                        Expira: {formatExpiresAt(invite.expiresAt)}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleCopyInvite(invite.inviteCode)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                        title="Copiar link"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadCredential(invite)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                        title="Baixar credencial"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};