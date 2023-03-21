'use client';

import * as React from 'react';
import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSelector } from '@legendapp/state/react';

import { useActionsStoreContext } from '../action';
import { Params } from '../params';
import { Services } from '../services';
import { FilterState, Triple } from '../types';
import { TripleStore } from './triple-store';

const TripleStoreContext = createContext<TripleStore | undefined>(undefined);

interface Props {
  space: string;
  children: React.ReactNode;
  initialTriples: Triple[];
}

export function TripleStoreProvider({ space, children, initialTriples }: Props) {
  const { network } = Services.useServices();
  const ActionsStore = useActionsStoreContext();
  const asPath = usePathname();
  const urlRef = useRef(asPath ?? '');

  const store = useMemo(() => {
    const initialParams = Params.parseTripleQueryParameters(urlRef.current);
    return new TripleStore({ api: network, space, initialParams, initialTriples, ActionsStore });
  }, [network, space, initialTriples, ActionsStore]);

  const query = useSelector(store.query$);
  const pageNumber = useSelector(store.pageNumber$);

  // Legendstate has a hard time inferring observable array contents
  const filterState = useSelector<FilterState>(store.filterState$);

  // Update the url with query search params whenever query or page number changes
  // @TODO: Add back url params for filterState in next 13
  useEffect(() => {
    // replace.current(basePath);
  }, []);

  return <TripleStoreContext.Provider value={store}>{children}</TripleStoreContext.Provider>;
}

export function useTripleStoreContext() {
  const value = useContext(TripleStoreContext);

  if (!value) {
    throw new Error(`Missing TripleStoreProvider`);
  }

  return value;
}
