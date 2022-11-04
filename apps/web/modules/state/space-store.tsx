import { computed, ObservableComputed } from '@legendapp/state';
import { INetwork } from '../services/network';
import { Space } from '../types';
import { makeOptionalComputed } from '../utils';

type SpacesAccounts = Record<string, string[]>;

export class SpaceStore {
  private api: INetwork;
  spaces$: ObservableComputed<Space[]>;
  admins$: ObservableComputed<SpacesAccounts>;
  editors$: ObservableComputed<SpacesAccounts>;

  constructor({ api }: { api: INetwork }) {
    this.api = api;

    this.spaces$ = makeOptionalComputed(
      [],
      computed(() => this.api.fetchSpaces())
    );

    this.admins$ = makeOptionalComputed(
      {},
      computed(() => {
        return this.spaces$.get().reduce((admins, space) => {
          admins[space.id] = space.admins;
          return admins;
        }, {} as SpacesAccounts);
      })
    );

    this.editors$ = makeOptionalComputed(
      {},
      computed(() => {
        return this.spaces$.get().reduce((editors, space) => {
          editors[space.id] = space.editors;
          return editors;
        }, {} as SpacesAccounts);
      })
    );
  }

  get(spaceId: string) {
    return this.spaces$.get().find(space => space.id === spaceId);
  }
}
