import { Root } from '@geogenesis/action-schema';
import { EntryAddedEventObject, Space as SpaceContract, Space__factory } from '@geogenesis/contracts';
import { ContractTransaction, Event, Signer, utils } from 'ethers';
import { Account, Action, EntityNames, FilterField, FilterState, ReviewState, Space, Triple, Value } from '../types';
import { IStorageClient } from './storage';

type NetworkNumberValue = { valueType: 'NUMBER'; numberValue: string };

type NetworkStringValue = { valueType: 'STRING'; stringValue: string };

type NetworkEntityValue = { valueType: 'ENTITY'; entityValue: { id: string; name: string | null } };

type NetworkValue = NetworkNumberValue | NetworkStringValue | NetworkEntityValue;

/**
 * Triple type returned by GraphQL
 */
export type NetworkTriple = NetworkValue & {
  id: string;
  entity: { id: string; name: string | null };
  attribute: { id: string; name: string | null };
  valueId: string;
  isProtected: boolean;
};

export function extractValue(networkTriple: NetworkTriple): Value {
  switch (networkTriple.valueType) {
    case 'STRING':
      return { type: 'string', id: networkTriple.valueId, value: networkTriple.stringValue };
    case 'NUMBER':
      return { type: 'number', id: networkTriple.valueId, value: networkTriple.numberValue };
    case 'ENTITY':
      return { type: 'entity', id: networkTriple.entityValue.id };
  }
}

function getActionFromChangeStatus(action: Action) {
  switch (action.type) {
    case 'createTriple':
    case 'deleteTriple':
      return [action];

    case 'editTriple':
      return [action.before, action.after];
  }
}

export type FetchTriplesOptions = {
  query: string;
  space: string;
  skip: number;
  first: number;
  filter: FilterState;
};

export type PublishOptions = {
  signer: Signer;
  actions: Action[];
  space: string;
  onChangePublishState: (newState: ReviewState) => void;
};

type FetchTriplesResult = { triples: Triple[]; entityNames: EntityNames };

export interface INetwork {
  fetchTriples: (options: FetchTriplesOptions) => Promise<FetchTriplesResult>;
  fetchSpaces: () => Promise<Space[]>;
  fetchEntities: (name: string) => Promise<{ id: string; name: string | null }[]>;
  publish: (options: PublishOptions) => Promise<void>;
}

const UPLOAD_CHUNK_SIZE = 2000;

export class Network implements INetwork {
  triplesAbortController = new AbortController();
  entitiesAbortController = new AbortController();

  constructor(public storageClient: IStorageClient, public subgraphUrl: string) {}

  publish = async ({ actions, signer, onChangePublishState, space }: PublishOptions): Promise<void> => {
    const contract = Space__factory.connect(space, signer);

    onChangePublishState('publishing-ipfs');
    const cids: string[] = [];

    for (let i = 0; i < actions.length; i += UPLOAD_CHUNK_SIZE) {
      console.log(`Publishing ${i / UPLOAD_CHUNK_SIZE}/${Math.ceil(actions.length / UPLOAD_CHUNK_SIZE)}`);

      const chunk = actions.slice(i, i + UPLOAD_CHUNK_SIZE);

      const root: Root = {
        type: 'root',
        version: '0.0.1',
        actions: chunk.flatMap(getActionFromChangeStatus),
      };

      const cidString = await this.storageClient.uploadObject(root);
      cids.push(`ipfs://${cidString}`);
    }

    onChangePublishState('publishing-contract');
    await addEntries(contract, cids);
  };

  fetchTriples = async ({ space, query, skip, first, filter }: FetchTriplesOptions) => {
    this.triplesAbortController.abort();
    this.triplesAbortController = new AbortController();

    const fieldFilters = Object.fromEntries(filter.map(clause => [clause.field, clause.value])) as Record<
      FilterField,
      string
    >;

    const where = [
      `space: ${JSON.stringify(space)}`,
      query && `entity_: {name_contains_nocase: ${JSON.stringify(query)}}`,
      fieldFilters['entity-id'] && `entity: ${JSON.stringify(fieldFilters['entity-id'])}`,
      fieldFilters['attribute-name'] &&
        `attribute_: {name_contains_nocase: ${JSON.stringify(fieldFilters['attribute-name'])}}`,
      fieldFilters['attribute-id'] && `attribute: ${JSON.stringify(fieldFilters['attribute-id'])}`,

      // Until we have OR we can't search for name_contains OR value string contains
      fieldFilters.value && `entityValue_: {name_contains_nocase: ${JSON.stringify(fieldFilters.value)}}`,
      fieldFilters['linked-to'] && `valueId: ${JSON.stringify(fieldFilters['linked-to'])}`,
    ]
      .filter(Boolean)
      .join(' ');

    const response = await fetch(this.subgraphUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: this.triplesAbortController.signal,
      body: JSON.stringify({
        query: `query {
          triples(where: {${where}}, skip: ${skip}, first: ${first}) {
            id
            attribute {
              id
              name
            }
            entity {
              id
              name
            }
            entityValue {
              id
              name
            }
            numberValue
            stringValue
            valueType
            valueId
            isProtected
          }
        }`,
      }),
    });

    const json: {
      data: {
        triples: NetworkTriple[];
      };
    } = await response.json();

    const triples = json.data.triples
      .filter(triple => !triple.isProtected)
      .map((networkTriple): Triple => {
        return {
          id: networkTriple.id,
          entityId: networkTriple.entity.id,
          entityName: networkTriple.entity.name,
          attributeId: networkTriple.attribute.id,
          value: extractValue(networkTriple),
          space,
        };
      });

    const entityNames: EntityNames = json.data.triples.reduce((acc, triple) => {
      if (triple.entity.name !== null) {
        acc[triple.entity.id] = triple.entity.name;
      }

      if (triple.valueType === 'ENTITY') {
        acc[triple.entityValue.id] = triple.entityValue.name;
      }

      if (triple.attribute.name !== null) {
        acc[triple.attribute.id] = triple.attribute.name;
      }
      return acc;
    }, {} as EntityNames);

    return { triples, entityNames };
  };

  fetchEntities = async (name: string) => {
    this.entitiesAbortController.abort();
    this.entitiesAbortController = new AbortController();

    // Until full-text search is supported, fetchEntities will return a list of entities that start with the search term,
    // followed by a list of entities that contain the search term.
    // Tracking issue:  https://github.com/graphprotocol/graph-node/issues/2330#issuecomment-1353512794
    const response = await fetch(this.subgraphUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: this.entitiesAbortController.signal,
      body: JSON.stringify({
        query: `query {
          startEntities: geoEntities(where: {name_starts_with_nocase: ${JSON.stringify(
            name
          )}}, orderBy: name, orderDirection: asc) {
            id,
            name
          }
          containEntities: geoEntities(where: {name_contains_nocase: ${JSON.stringify(name)}}) {
            id,
            name
          }
        }`,
      }),
    });

    const json: {
      data: {
        startEntities: { name: string | null; id: string }[];
        containEntities: { name: string | null; id: string }[];
      };
    } = await response.json();

    const { startEntities, containEntities } = json.data;
    const startEntityIds = startEntities.map(entity => entity.id);

    const sortLengthThenAlphabetically = (a: string | null, b: string | null) => {
      if (a === null && b === null) {
        return 0;
      }
      if (a === null) {
        return 1;
      }
      if (b === null) {
        return -1;
      }
      if (a.length === b.length) {
        return a.localeCompare(b);
      }
      return a.length - b.length;
    };

    const primaryResults = startEntities.sort((a, b) => sortLengthThenAlphabetically(a.name, b.name));
    const secondaryResults = containEntities
      .filter(entity => !startEntityIds.includes(entity.id))
      .sort((a, b) => sortLengthThenAlphabetically(a.name, b.name));

    return [...primaryResults, ...secondaryResults];
  };

  fetchSpaces = async () => {
    const response = await fetch(this.subgraphUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `query {
          spaces {
            id
            isRootSpace
            admins {
              id
            }
            editors {
              id
            }
            editorControllers {
              id
            }
            entity {
              entityOf {
                id
                stringValue
                attribute {
                  id
                }
              }
            }
          }
        }`,
      }),
    });

    const json: {
      data: {
        spaces: {
          id: string;
          isRootSpace: boolean;
          admins: Account[];
          editors: Account[];
          editorControllers: Account[];
          entity?: {
            entityOf: { id: string; stringValue: string; attribute: { id: string } }[];
          };
        }[];
      };
    } = await response.json();

    const spaces = json.data.spaces.map((space): Space => {
      const attributes = Object.fromEntries(
        space.entity?.entityOf.map(entityOf => [entityOf.attribute.id, entityOf.stringValue]) || []
      );

      if (space.isRootSpace) {
        attributes.name = 'Root Space';
      }

      return {
        id: space.id,
        isRootSpace: space.isRootSpace,
        admins: space.admins.map(account => account.id),
        editorControllers: space.editorControllers.map(account => account.id),
        editors: space.editors.map(account => account.id),
        attributes,
      };
    });

    return spaces;
  };
}

async function findEvents(tx: ContractTransaction, name: string): Promise<Event[]> {
  const receipt = await tx.wait();
  return (receipt.events || []).filter(event => event.event === name);
}

async function addEntries(spaceContract: SpaceContract, uris: string[]) {
  const gasResponse = await fetch('https://gasstation-mainnet.matic.network/v2');
  const gasSuggestion: {
    standard: {
      maxPriorityFee: number;
      maxFee: number;
    };
    estimatedBaseFee: number;
  } = await gasResponse.json();

  const maxFeeAsGWei = utils.parseUnits(gasSuggestion.standard.maxFee.toFixed().toString(), 'gwei');
  const maxPriorityFeeAsGWei = utils.parseUnits(gasSuggestion.standard.maxPriorityFee.toFixed().toString(), 'gwei');

  const mintTx = await spaceContract.addEntries(uris, {
    maxFeePerGas: maxFeeAsGWei,
    maxPriorityFeePerGas: maxPriorityFeeAsGWei,
  });
  console.log(`Transaction receipt: ${JSON.stringify(mintTx)}`);
  const transferEvent = await findEvents(mintTx, 'EntryAdded');
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const eventObject = transferEvent.pop()!.args as unknown as EntryAddedEventObject;
  return eventObject;
}
