import { PLACEHOLDER_SPACE_IMAGE } from '../constants';
import { Value } from '../types';
import { Entities } from '../utils/entity';
import { EntityDto } from './dto/entities';
import { SpaceConfigEntity } from './dto/spaces';
import { SubstreamEntity, SubstreamTriple, SubstreamType, TypeId } from './schema';

export type TripleWithSpaceMetadata = {
  space: {
    id: string;
    name: string;
    metadata: {
      nodes: SubstreamEntity[];
    };
  };
  entityId: string;
  attributeId: string;
  value: Value;

  entityName: string | null;
  attributeName: string | null;

  // We have a set of application-specific metadata that we attach to each local version of a triple.
  id?: string; // `${spaceId}:${entityId}:${attributeId}`
  placeholder?: boolean;
  // We keep published triples optimistically in the store. It can take a while for the blockchain
  // to process our transaction, then a few seconds for the subgraph to pick it up and index it.
  // We keep the published triples so we can continue to render them locally while the backend
  // catches up.
  hasBeenPublished?: boolean;
  timestamp?: string; // ISO-8601
  isDeleted?: boolean;
};

function extractValue(networkTriple: SubstreamTriple): Value {
  switch (networkTriple.valueType) {
    case 'TEXT':
      return { type: 'TEXT', value: networkTriple.textValue };
    case 'ENTITY': {
      return {
        type: 'ENTITY',
        value: networkTriple.entityValue.id,
        name: networkTriple.entityValue.name,
      };
    }
    case 'TIME':
      return { type: 'TIME', value: networkTriple.textValue };
    case 'URI':
      return { type: 'URI', value: networkTriple.textValue };
  }
}

export function TripleDto(triple: SubstreamTriple) {
  return {
    entityId: triple.entity.id,
    entityName: triple.entity.name,
    attributeId: triple.attribute.id,
    attributeName: triple.attribute.name,
    value: extractValue(triple),
    space: triple.space.id,
  };
}

export function SpaceMetadataDto(spaceId: string, metadata: SubstreamEntity | undefined | null) {
  const spaceConfigTriples = (metadata?.triples.nodes ?? []).map(TripleDto);

  const spaceConfigWithImage: SpaceConfigEntity = metadata
    ? {
        spaceId: spaceId,
        image: Entities.avatar(spaceConfigTriples) ?? Entities.cover(spaceConfigTriples) ?? PLACEHOLDER_SPACE_IMAGE,
        ...EntityDto(metadata),
      }
    : {
        id: '',
        spaceId: spaceId,
        name: null,
        description: null,
        image: PLACEHOLDER_SPACE_IMAGE,
        triples: [],
        types: [],
        nameTripleSpaces: [],
        relationsOut: [],
      };

  return spaceConfigWithImage;
}

/**
 * 
 * function isImageEntity(types: readonly SubstreamType[]): boolean {
  return types.some(t => t.id === SYSTEM_IDS.IMAGE);
}
 * 
 *       // We render certain types of Entities differently as a triple value than others.
      // For example, for a "regular" Entity we render the name in a chip, but for an
      // "image" Entity we want to render a specific triple's value which contains the
      // image resource url.
      if (isImageEntity(networkTriple.entityValue.types.nodes)) {
        // Image values are stored in the data model as an entity with triple with
        // a "IMAGE_COMPOUND_TYPE_SOURCE_ATTRIBUTE" attribute. The value of this triple should
        // be a URL pointing to the resource location of the image contents,
        // usually an IPFS hash.
        return {
          type: 'IMAGE',
          value: networkTriple.entityValue.id,
          // image: getImageUrlFromImageEntity(networkTriple.entityValue.triples.nodes) ?? '',
          image: '',
        };
      }
 */
