import { createGeoId } from './id';
import { SYSTEM_IDS } from './system-ids';

type CreateImageEntityOpsReturnType = [
  {
    type: 'SET_TRIPLE',
    triple: {
      entityId: string;
      attributeId: typeof SYSTEM_IDS.TYPES;
      value: {
        type: 'ENTITY';
        value: typeof SYSTEM_IDS.IMAGE;
      }
    }
  },
  {
    type: 'SET_TRIPLE',
    triple: {
      entityId: string;
      attributeId: typeof SYSTEM_IDS.IMAGE_URL_ATTRIBUTE;
      value: {
        type: 'URL';
        value: string;
      }
    }
  },
]

/**
 * Creates an entity representing an Image.
 * 
 * @returns ops: The SET_TRIPLE ops for an Image entity
 */
export function createImageEntityOps(src: string): CreateImageEntityOpsReturnType {
  const entityId = createGeoId();

  return [
    {
      type: 'SET_TRIPLE',
      triple: {
        entityId,
        attributeId: SYSTEM_IDS.TYPES,
        value: {
          type: 'ENTITY',
          value: SYSTEM_IDS.IMAGE
        }
      }
    },
    {
      type: 'SET_TRIPLE',
      triple: {
        entityId,
        attributeId: SYSTEM_IDS.IMAGE_URL_ATTRIBUTE,
        value: {
          type: 'URL',
          value: src
        }
      }
    }
  ]
}