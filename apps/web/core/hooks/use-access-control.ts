'use client';

import { useQuery } from '@tanstack/react-query';

import { useAccount } from 'wagmi';

import { Services } from '../services';
import { useHydrated } from './use-hydrated';

export function useAccessControl(spaceId?: string | null) {
  const { subgraph, config } = Services.useServices();
  // We need to wait for the client to check the status of the client-side wallet
  // before setting state. Otherwise there will be client-server hydration mismatches.
  const hydrated = useHydrated();
  const { address } = useAccount();

  const { data: space } = useQuery({
    queryKey: ['access-control', spaceId, address],
    queryFn: async () => {
      if (!spaceId || !address) return null;

      return await subgraph.fetchSpace({ endpoint: config.subgraph, id: spaceId });
    },
  });

  if (process.env.NODE_ENV === 'development') {
    return {
      isAdmin: true,
      isEditorController: true,
      isEditor: true,
    };
  }

  if (!address || !hydrated || !space) {
    return {
      isAdmin: false,
      isEditorController: false,
      isEditor: false,
    };
  }

  return {
    isAdmin: space.admins.includes(address),
    isEditorController: space.editorControllers.includes(address),
    isEditor: space.editors.includes(address),
  };
}
