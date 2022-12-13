import styled from '@emotion/styled';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import pluralize from 'pluralize';
import { useEffect, useState } from 'react';
import { createColumns, Table } from '~/modules/components/table';
import { SmallButton } from '~/modules/design-system/button';
import { Chip } from '~/modules/design-system/chip';
import { ChevronDownSmall } from '~/modules/design-system/icons/chevron-down-small';
import { RightArrowDiagonal } from '~/modules/design-system/icons/right-arrow-diagonal';
import { Tick } from '~/modules/design-system/icons/tick';
import { ResizableContainer } from '~/modules/design-system/resizable-container';
import { Spacer } from '~/modules/design-system/spacer';
import { Text } from '~/modules/design-system/text';
import { Truncate } from '~/modules/design-system/truncate';
import { getConfigFromUrl } from '~/modules/params';
import { Network } from '~/modules/services/network';
import { StorageClient } from '~/modules/services/storage';
import { usePageName } from '~/modules/state/use-page-name';
import { EntityNames, Triple } from '~/modules/types';
import { getEntityDescription, getEntityName, groupBy, navUtils, partition } from '~/modules/utils';

const Content = styled.div(({ theme }) => ({
  border: `1px solid ${theme.colors['grey-02']}`,
  borderRadius: theme.radius,
  backgroundColor: theme.colors.white,
}));

const Attributes = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space * 6,
  padding: theme.space * 5,
}));

const Entities = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  flexWrap: 'wrap',
  gap: theme.space * 3,
}));

const EntityActionGroup = styled.div({
  display: 'flex',
  justifyContent: 'flex-end',

  '@media (max-width: 600px)': {
    button: {
      flexGrow: 1,
    },
  },
});

interface Props {
  triples: Triple[];
  id: string;
  name: string;
  space: string;
  entityNames: EntityNames;
  linkedEntities: Record<string, EntityGroup>;
}

const CopyText = styled(Text)`
  display: inline-flex;
  align-items: center;
`;

const MotionCopyText = motion(CopyText);

export default function EntityPage({
  triples,
  id,
  name,
  space,
  entityNames,
  linkedEntities,
  relatedEntities,
  columns,
  rowData,
}: Props) {
  const { setPageName } = usePageName();
  const [copyText, setCopyText] = useState<'Copy ID' | 'Entity ID Copied'>('Copy ID');

  console.log({ triples, id, name, space, entityNames, linkedEntities, relatedEntities, columns, rowData });

  console.log(createColumns(columns));

  const columnData = Object.values(linkedEntities)
    .map(e => e.triples)
    .flat();

  console.log(columnData);
  // const columns = Object.values(linkedEntities)[0].map

  useEffect(() => {
    if (name !== id) setPageName(name);
    return () => setPageName('');
  }, [name, id, setPageName]);

  const onCopyEntityId = () => {
    navigator.clipboard.writeText(id);
    setCopyText('Entity ID Copied');
    setTimeout(() => setCopyText('Copy ID'), 3600);
  };

  const description = getEntityDescription(triples, entityNames);
  const triplesWithoutDescription = triples.filter(t =>
    t.value.type === 'entity'
      ? entityNames[t.value.id] !== description
      : t.value.type === 'string'
      ? t.value.value !== description
      : false
  );

  return (
    <div>
      <Head>
        <title>{name ?? id}</title>
        <meta property="og:url" content={`https://geobrowser.io/spaces/${id}`} />
      </Head>

      <Truncate maxLines={3} shouldTruncate>
        <Text as="h1" variant="mainPage">
          {name}
        </Text>
      </Truncate>

      {description && (
        <>
          <Spacer height={16} />
          <Text as="p" color="grey-04">
            {description}
          </Text>
        </>
      )}

      <Spacer height={16} />

      <EntityActionGroup>
        <SmallButton
          onClick={onCopyEntityId}
          variant={copyText === 'Entity ID Copied' ? 'tertiary' : 'secondary'}
          icon={copyText === 'Entity ID Copied' ? undefined : 'copy'}
        >
          <AnimatePresence mode="wait">
            {copyText === 'Entity ID Copied' ? (
              <MotionCopyText
                color="white"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                variant="smallButton"
              >
                <Tick />
                <Spacer width={4} />
                {copyText}
              </MotionCopyText>
            ) : (
              <motion.span
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
              >
                {copyText}
              </motion.span>
            )}
          </AnimatePresence>
        </SmallButton>
      </EntityActionGroup>

      <Spacer height={8} />

      <Content>
        <Attributes>
          <EntityAttributes entityId={id} triples={triplesWithoutDescription} space={space} entityNames={entityNames} />
        </Attributes>
      </Content>

      <Spacer height={40} />

      <Text as="h2" variant="mediumTitle">
        Linked by
      </Text>

      <Table columns={createColumns(columns)} triples={columnData} />

      <Entities>
        {Object.entries(linkedEntities).length === 0 ? (
          <Text color="grey-04">There are no other entities that are linking to this entity.</Text>
        ) : (
          <LayoutGroup>
            <Spacer height={12} />
            {Object.values(linkedEntities).map(group => (
              <LinkedEntityCard
                key={group.id}
                originalEntityId={id}
                entityGroup={group}
                space={space}
                entityNames={entityNames}
              />
            ))}
          </LayoutGroup>
        )}
      </Entities>
    </div>
  );
}

const EntityAttributeContainer = styled.div({
  wordBreak: 'break-word',
});

const GroupedAttributes = styled.div(({ theme }) => ({
  display: 'flex',
  gap: theme.space * 2,
  flexWrap: 'wrap',
}));

function EntityAttribute({ triple, space, entityNames }: { triple: Triple; space: string; entityNames: EntityNames }) {
  return (
    <div key={triple.attributeId}>
      <Text as="p" variant="bodySemibold">
        {entityNames[triple.attributeId] || triple.attributeId}
      </Text>
      {triple.value.type === 'entity' ? (
        <>
          <Spacer height={4} />
          <Chip href={navUtils.toEntity(space, triple.value.id)}>
            {entityNames[triple.value.id] || triple.value.id}
          </Chip>
        </>
      ) : (
        <Text as="p">{triple.value.value}</Text>
      )}
    </div>
  );
}

function EntityAttributes({
  entityId,
  triples,
  space,
  entityNames,
}: {
  entityId: string;
  triples: Props['triples'];
  space: Props['space'];
  entityNames: Props['entityNames'];
}) {
  const groupedTriples = groupBy(triples, t => t.attributeId);

  return (
    <>
      {Object.entries(groupedTriples).map(([attributeId, triples]) => (
        <EntityAttributeContainer key={`${entityId}-entity-attributes-${attributeId}`}>
          <Text as="p" variant="bodySemibold">
            {entityNames[attributeId] || attributeId}
          </Text>
          <GroupedAttributes>
            {/* 
              Have to do some janky layout stuff instead of being able to just use gap since we want different
              height between the attribute name and the attribute value for entities vs strings
            */}
            {triples.map(triple =>
              triple.value.type === 'entity' ? (
                <div key={`entity-${triple.id}`} style={{ marginTop: 4 }}>
                  <Chip href={navUtils.toEntity(space, triple.value.id)}>
                    {entityNames[triple.value.id] || triple.value.id}
                  </Chip>
                </div>
              ) : (
                <>
                  <Text as="p">{triple.value.value}</Text>
                </>
              )
            )}
          </GroupedAttributes>
        </EntityAttributeContainer>
      ))}
    </>
  );
}

const LinkedEntityCardContainer = styled.div(({ theme }) => ({
  borderRadius: theme.radius,
  border: `1px solid ${theme.colors['grey-02']}`,
  overflow: 'hidden',
  transition: 'border-color 0.15s ease-in-out',

  ':hover': {
    border: `1px solid ${theme.colors.text}`,

    a: {
      borderColor: theme.colors.text,
    },
  },
}));

const LinkedEntityCardHeader = styled.a(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  verticalAlign: 'top',
  gap: theme.space * 5,

  padding: theme.space * 4,

  div: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.space * 4,
  },

  img: {
    borderRadius: theme.radius,
  },
}));

const IconContainer = styled.div({
  // HACK: Fix visual alignment when aligning the content to the top. The icon does not
  // line up visually because of the text line height.
  marginTop: 6,
});

const LinkedEntityCardContent = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space * 4,
  padding: theme.space * 4,
  backgroundColor: theme.colors.white,
}));

const LinkedEntityCardFooter = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${theme.space * 2}px ${theme.space * 4}px`,
  backgroundColor: theme.colors.white,
}));

const LinkedEntityDescription = styled.div(({ theme }) => ({
  padding: theme.space * 4,
  paddingTop: 0,
  backgroundColor: theme.colors.bg,
}));

function LinkedEntityCard({
  originalEntityId,
  entityGroup,
  space,
  entityNames,
}: {
  originalEntityId: string;
  entityGroup: EntityGroup;
  space: Props['space'];
  entityNames: Props['entityNames'];
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const [linkedTriples, unlinkedTriples] = partition(
    entityGroup.triples,
    t => t.value.type === 'entity' && t.value.id === originalEntityId
  );

  const description = getEntityDescription(entityGroup.triples, entityNames);
  const triplesWithoutDescription = unlinkedTriples.filter(t =>
    t.value.type === 'entity'
      ? entityNames[t.value.id] !== description
      : t.value.type === 'string'
      ? t.value.value !== description
      : false
  );

  const shouldMaximizeContent = Boolean(isExpanded || description || linkedTriples.length > 0);

  return (
    <ResizableContainer>
      <LinkedEntityCardContainer>
        <Link href={navUtils.toEntity(space, entityGroup.id)} passHref>
          <LinkedEntityCardHeader>
            <Text as="h2" variant="cardEntityTitle">
              {entityGroup.name ?? entityGroup.id}
            </Text>
            {/* Wrap in a div so the svg doesn't get scaled by dynamic flexbox */}
            <IconContainer>
              <RightArrowDiagonal color="grey-04" />
            </IconContainer>
          </LinkedEntityCardHeader>
        </Link>

        {description && (
          <LinkedEntityDescription>
            <Text as="p" color="grey-04">
              {description}
            </Text>
          </LinkedEntityDescription>
        )}

        <LinkedEntityCardContent>
          {shouldMaximizeContent && (
            <>
              {linkedTriples.map((triple, i) => (
                <EntityAttribute
                  key={`${triple.attributeId}-${triple.id}-${i}`}
                  triple={triple}
                  space={space}
                  entityNames={entityNames}
                />
              ))}
              {isExpanded && (
                <EntityAttributes
                  entityId={entityGroup.id}
                  triples={triplesWithoutDescription}
                  space={space}
                  entityNames={entityNames}
                />
              )}
            </>
          )}
        </LinkedEntityCardContent>

        <LinkedEntityCardFooter>
          <Text variant="breadcrumb">
            {entityGroup.triples.length} {pluralize('value', entityGroup.triples.length)}
          </Text>
          <SmallButton variant="secondary" onClick={() => setIsExpanded(!isExpanded)}>
            <span style={{ rotate: isExpanded ? '180deg' : '0deg' }}>
              <ChevronDownSmall color="grey-04" />
            </span>
            <Spacer width={6} />
            {isExpanded
              ? `Hide ${triplesWithoutDescription.length} more ${pluralize('value', triplesWithoutDescription.length)}`
              : `Show ${triplesWithoutDescription.length} more ${pluralize('value', triplesWithoutDescription.length)}`}
          </SmallButton>
        </LinkedEntityCardFooter>
      </LinkedEntityCardContainer>
    </ResizableContainer>
  );
}

type EntityGroup = {
  triples: Triple[];
  name: string | null;
  id: string;
};

export const getServerSideProps: GetServerSideProps<Props> = async context => {
  const space = context.query.id as string;
  const entityId = context.query.entityId as string;
  const config = getConfigFromUrl(context.resolvedUrl);

  const storage = new StorageClient(config.ipfs);

  const [entity, related] = await Promise.all([
    new Network(storage, config.subgraph).fetchTriples({
      space,
      query: '',
      skip: 0,
      first: 100,
      filter: [{ field: 'entity-id', value: entityId }],
    }),

    new Network(storage, config.subgraph).fetchTriples({
      space,
      query: '',
      skip: 0,
      first: 100,
      filter: [{ field: 'linked-to', value: entityId }],
    }),
  ]);

  const relatedEntities = await Promise.all(
    related.triples.map(triple =>
      new Network(storage, config.subgraph).fetchTriples({
        space,
        query: '',
        skip: 0,
        first: 100,
        filter: [{ field: 'entity-id', value: triple.entityId }],
      })
    )
  );

  const linkedEntities: Record<string, EntityGroup> = relatedEntities
    .flatMap(entity => entity.triples)
    .reduce((acc, triple) => {
      if (!acc[triple.entityId]) acc[triple.entityId] = { triples: [], name: null, id: triple.entityId };
      acc[triple.entityId].id = triple.entityId;
      acc[triple.entityId].name = triple.entityName;
      acc[triple.entityId].triples = [...acc[triple.entityId].triples, triple]; // Duplicates?
      return acc;
    }, {} as Record<string, EntityGroup>);

  const relatedEntityAttributeNames = relatedEntities.reduce((acc, { entityNames }) => {
    return { ...acc, ...entityNames };
  }, {} as EntityNames);

  const entityNames = {
    ...entity.entityNames,
    ...related.entityNames,
    ...relatedEntityAttributeNames,
  };
  const relatedTriples = Object.values(linkedEntities).flatMap(entity => entity.triples);

  const columnsMap = relatedTriples.reduce((acc, triple) => {
    if (!acc[triple.attributeId])
      acc[triple.attributeId] = {
        accessor: triple.attributeId,
        label: entityNames[triple.attributeId] || '',
      };
    return acc;
  }, {} as Record<string, { accessor: string; label: string }>);

  const rowLabels = Object.values(linkedEntities).map(entity => entityNames[entity.id] || 'invalid name');

  const rowData = Object.values(linkedEntities).map(entity => {
    return entity.triples.reduce((acc, triple) => {
      acc[triple.attributeId] = {
        ...triple.value,
        value: triple.value.value || entityNames[triple.value.id] || '',
      };
      return acc;
    }, {} as Record<string, string>);
  });

  return {
    props: {
      triples: entity.triples,
      id: entityId,
      columns: Object.values(columnsMap),
      name: getEntityName(entity.triples) ?? entityId,
      space,
      relatedEntities,
      entityNames,
      linkedEntities,
      key: entityId,
      rowData,
    },
  };
};
