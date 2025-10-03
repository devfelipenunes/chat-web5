/**
 * Hook simplificado para gerenciar Convites P2P
 * Sistema peer-to-peer - credenciais criadas e validadas localmente
 */

import { useState, useCallback } from 'react';

interface InviteConfig {
  permissions: string[];
  maxUses: number;
  expiresIn: number;
}

interface Invite {
  inviteId: string;
  chatId: string;
  issuerDid: string;
  permissions: string[];
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  createdAt: string;
  credential: any;
}

export const useInvite = (chatId: string | null, ownerDid: string | null) => {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Placeholder - criação real acontece no page.tsx usando Veramo
  const createInvite = useCallback(async (config: InviteConfig): Promise<Invite | null> => {
    // Este método não faz nada - é apenas para compatibilidade
    // A lógica real está em page.tsx
    return null;
  }, [chatId, ownerDid]);

  // Gera link de convite a partir do JWT
  const generateInviteLink = useCallback((invite: Invite): string => {
    // Retorna apenas o JWT - é P2P!
    return invite.credential?.proof?.jwt || '';
  }, []);

  return {
    invites,
    isLoading,
    createInvite,
    generateInviteLink
  };
};
