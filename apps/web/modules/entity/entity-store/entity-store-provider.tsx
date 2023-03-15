import * as React from 'react';
import { createContext, useContext, useMemo } from 'react';

import { useActionsStoreContext } from '../../action';
import { Services } from '../../services';
import { Triple } from '../../types';
import { EntityStore } from './entity-store';

const EntityStoreContext = createContext<EntityStore | undefined>(undefined);

interface Props {
  id: string;
  spaceId: string;
  children: React.ReactNode;
  initialTriples: Triple[];
  initialSchemaTriples: Triple[];
  initialBlockIds: string[];
  initialBlockTriples: Triple[];
  name: string;
}

export function EntityStoreProvider({
  id,
  spaceId,
  name,
  children,
  initialBlockIds,
  initialBlockTriples,
  initialTriples,
  initialSchemaTriples,
}: Props) {
  const { network } = Services.useServices();
  const ActionsStore = useActionsStoreContext();

  const store = useMemo(() => {
    return new EntityStore({
      api: network,
      name,
      spaceId,
      initialBlockIds,
      initialBlockTriples,
      initialTriples,
      initialSchemaTriples,
      id,
      ActionsStore,
    });
  }, [
    network,
    spaceId,
    name,
    initialBlockTriples,
    initialTriples,
    initialBlockIds,
    initialSchemaTriples,
    id,
    ActionsStore,
  ]);

  return <EntityStoreContext.Provider value={store}>{children}</EntityStoreContext.Provider>;
}

export function useEntityStoreContext() {
  const value = useContext(EntityStoreContext);

  if (!value) {
    throw new Error(`Missing EntityStoreProvider`);
  }

  return value;
}
