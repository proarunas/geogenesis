import { SYSTEM_IDS } from '@geogenesis/ids';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';

import { EntityTableContainer } from '~/modules/components/entity-table/entity-table-container';
import { SpaceHeader } from '~/modules/components/space/space-header';
import { SpaceNavbar } from '~/modules/components/space/space-navbar';
import { Spacer } from '~/modules/design-system/spacer';
import { DEFAULT_PAGE_SIZE, EntityTable, EntityTableStoreProvider } from '~/modules/entity';
import { Params } from '~/modules/params';
import { NetworkData } from '~/modules/io';
import { StorageClient } from '~/modules/services/storage';
import { Column, Proposal, Row, Space, Triple } from '~/modules/types';

interface Props {
  spaceId: string;
  proposals: Proposal[];
  spaceName?: string;
  spaceImage: string | null;
  initialSelectedType: Triple | null;
  initialTypes: Triple[];
  initialColumns: Column[];
  initialRows: Row[];
}

export default function EntitiesPage({
  spaceId,
  spaceName,
  spaceImage,
  proposals,
  initialColumns,
  initialSelectedType,
  initialRows,
  initialTypes,
}: Props) {
  return (
    <div>
      <Head>
        <title>{spaceName ?? spaceId}</title>
        <meta property="og:url" content={`https://geobrowser.io/${spaceId}}`} />
      </Head>
      <SpaceHeader proposals={proposals} spaceId={spaceId} spaceImage={spaceImage} spaceName={spaceName} />
      <Spacer height={34} />
      <SpaceNavbar spaceId={spaceId} />
      <EntityTableStoreProvider
        spaceId={spaceId}
        initialRows={initialRows}
        initialSelectedType={initialSelectedType}
        initialColumns={initialColumns}
        initialTypes={initialTypes}
      >
        <EntityTableContainer
          spaceId={spaceId}
          spaceName={spaceName}
          initialColumns={initialColumns}
          initialRows={initialRows}
        />
      </EntityTableStoreProvider>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async context => {
  const spaceId = context.params?.id as string;
  const initialParams = Params.parseEntityTableQueryParameters(context.resolvedUrl);
  const config = Params.getConfigFromUrl(context.resolvedUrl, context.req.cookies[Params.ENV_PARAM_NAME]);
  const storage = new StorageClient(config.ipfs);

  const network = new NetworkData.Network(storage, config.subgraph);
  const spaces = await network.fetchSpaces();
  const space = spaces.find(s => s.id === spaceId);

  if (!space)
    return {
      notFound: true,
    };

  const spaceImage = space.attributes[SYSTEM_IDS.IMAGE_ATTRIBUTE] ?? null;
  const spaceNames = Object.fromEntries(spaces.map(space => [space.id, space.attributes.name]));
  const spaceName = spaceNames[spaceId];

  const [initialSpaceTypes, initialForeignTypes, defaultTypeTriples, proposals] = await Promise.all([
    fetchSpaceTypeTriples(network, spaceId),
    fetchForeignTypeTriples(network, space),
    network.fetchTriples({
      query: '',
      skip: 0,
      first: DEFAULT_PAGE_SIZE,
      filter: [
        { field: 'entity-id', value: space.entityId ?? '' },
        {
          field: 'attribute-id',
          value: SYSTEM_IDS.DEFAULT_TYPE,
        },
      ],
    }),
    network.fetchProposals(spaceId),
  ]);

  const initialTypes = [...initialSpaceTypes, ...initialForeignTypes];

  const defaultTypeId = defaultTypeTriples.triples[0]?.value.id;

  const initialSelectedType =
    initialTypes.find(t => t.entityId === (initialParams.typeId || defaultTypeId)) || initialTypes[0] || null;

  const typeId = initialSelectedType?.entityId;

  const params = {
    ...initialParams,
    first: DEFAULT_PAGE_SIZE,
    skip: initialParams.pageNumber * DEFAULT_PAGE_SIZE,
    typeId,
  };

  const { columns } = await network.columns({
    spaceId,
    params,
  });

  const { rows: serverRows } = await network.rows({
    spaceId,
    params,
  });

  const { rows } = EntityTable.fromColumnsAndRows(spaceId, serverRows, columns);

  return {
    props: {
      spaceId,
      spaceName,
      spaceImage,
      proposals,
      initialSelectedType,
      initialForeignTypes,
      initialColumns: columns,
      initialRows: rows,
      initialTypes,
    },
  };
};

export const fetchForeignTypeTriples = async (network: NetworkData.INetwork, space: Space) => {
  if (!space.spaceConfigEntityId) {
    return [];
  }

  const foreignTypesFromSpaceConfig = await network.fetchTriples({
    query: '',
    space: space.id,
    skip: 0,
    first: DEFAULT_PAGE_SIZE,
    filter: [
      { field: 'entity-id', value: space.spaceConfigEntityId },
      { field: 'attribute-id', value: SYSTEM_IDS.FOREIGN_TYPES },
    ],
  });

  const foreignTypesIds = foreignTypesFromSpaceConfig.triples.map(triple => triple.value.id);

  const foreignTypes = await Promise.all(
    foreignTypesIds.map(entityId =>
      network.fetchTriples({
        query: '',
        skip: 0,
        first: DEFAULT_PAGE_SIZE,
        filter: [
          { field: 'entity-id', value: entityId },
          { field: 'attribute-id', value: SYSTEM_IDS.TYPES },
          { field: 'linked-to', value: SYSTEM_IDS.SCHEMA_TYPE },
        ],
      })
    )
  );

  return foreignTypes.flatMap(foreignType => foreignType.triples);
};

export const fetchSpaceTypeTriples = async (network: NetworkData.INetwork, spaceId: string) => {
  /* Fetch all entities with a type of type (e.g. Person / Place / Claim) */

  const { triples } = await network.fetchTriples({
    query: '',
    space: spaceId,
    skip: 0,
    first: DEFAULT_PAGE_SIZE,
    filter: [
      { field: 'attribute-id', value: SYSTEM_IDS.TYPES },
      {
        field: 'linked-to',
        value: SYSTEM_IDS.SCHEMA_TYPE,
      },
    ],
  });

  return triples;
};
