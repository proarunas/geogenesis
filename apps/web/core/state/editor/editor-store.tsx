'use client';

import { Relation as R, SYSTEM_IDS } from '@geogenesis/sdk';
import { generateJSON as generateServerJSON } from '@tiptap/html';
import { JSONContent, generateJSON } from '@tiptap/react';
import { Array } from 'effect';

import * as React from 'react';

import { tiptapExtensions } from '~/partials/editor/extensions';

import { useRelations } from '../../database/relations';
import { getTriples } from '../../database/triples';
import { DB } from '../../database/write';
import { ID } from '../../id';
import { EntityId, TypeId } from '../../io/schema';
import { Relation, RenderableEntityType } from '../../types';
import { Values } from '../../utils/value';
import { getRelationForBlockType } from './block-types';
import { makeInitialDataEntityRelations } from './data-entity';
import { useEditorInstance } from './editor-provider';
import * as Parser from './parser';
import * as TextEntity from './text-entity';
import { Content } from './types';
import { getNodeId } from './utils';

/**
 * Blocks are defined via relations with relation type of {@link SYSTEM_IDS.BLOCKS}.
 * These relations point to entities which are renderable by the content editor. The
 * currently renderable block types are:
 * 1) Text
 * 2) Data
 * 3) Image
 *
 * @TODO:
 * - Move all data block view properties to live on the relation instead of the data
 *   entity. i.e., view, placeholder, filter
 * - Move shown columns to live on the filter string. This is defined by the filter
 *   spec for data entities.
 * - Flatten collection items to point at the data block directly instead of an
 *   intermediate collection entity
 */

interface RelationWithBlock {
  relationId: EntityId;
  typeOfId: TypeId;
  index: string;
  block: {
    id: EntityId;
    type: RenderableEntityType;
    value: string;
  };
}

function relationToRelationWithBlock(r: Relation): RelationWithBlock {
  return {
    typeOfId: TypeId(r.typeOf.id),
    index: r.index,
    block: {
      id: r.toEntity.id,
      type: r.toEntity.renderableType,
      value: r.toEntity.value,
    },
    relationId: r.id,
  };
}

function sortByIndex(a: RelationWithBlock, z: RelationWithBlock) {
  if (a.index < z.index) {
    return -1;
  }
  if (a.index > z.index) {
    return 1;
  }
  return 0;
}

interface UpsertBlocksRelationsArgs {
  nextBlocks: { id: string; type: Content['type'] }[];
  addedBlockIds: string[];
  removedBlockIds: string[];
  blockRelations: RelationWithBlock[];
  spaceId: string;
  entityPageId: string;
}

// Helper function to create or update the block IDs on an entity
// Since we don't currently support array value types, we store all ordered blocks as a single stringified array
const makeBlocksRelations = async ({
  nextBlocks,
  blockRelations,
  spaceId,
  entityPageId,
  addedBlockIds,
  removedBlockIds,
}: UpsertBlocksRelationsArgs) => {
  if (nextBlocks.length > 0) {
    // We store the new collection items being created so we can check if the new
    // ordering for a block is dependent on other blocks being created at the same time.
    //
    // @TODO Ideally this isn't needed as ordering should be updated as the users are making
    // changes, but right now that would require updating the actions store for every keystroke
    // which could cause performance problems in the app. We need more granular reactive state
    // from our store to prevent potentially re-rendering _everything_ that depends on the store
    // when changes are made anywhere.
    const newBlocks: Relation[] = [];
    const nextBlockIds = nextBlocks.map(b => b.id);

    for (const addedBlock of addedBlockIds) {
      const newRelationId = ID.createEntityId();
      const block = nextBlocks.find(b => b.id === addedBlock)!;

      const position = nextBlockIds.indexOf(addedBlock);
      // @TODO: noUncheckedIndexAccess
      const beforeBlockIndex = nextBlockIds[position - 1] as string | undefined;
      const afterBlockIndex = nextBlockIds[position + 1] as string | undefined;

      // Check both the existing blocks and any that are created as part of this update
      // tick. This is necessary as right now we don't update the Geo state until the
      // user blurs the editor. See the comment earlier in this function.
      const beforeCollectionItemIndex =
        blockRelations.find(c => c.block.id === beforeBlockIndex)?.index ??
        newBlocks.find(c => c.id === beforeBlockIndex)?.index;
      const afterCollectionItemIndex =
        blockRelations.find(c => c.block.id === afterBlockIndex)?.index ??
        newBlocks.find(c => c.id === afterBlockIndex)?.index;

      const newTripleOrdering = R.reorder({
        relationId: newRelationId,
        beforeIndex: beforeCollectionItemIndex,
        afterIndex: afterCollectionItemIndex,
      });

      const renderableType = ((): RenderableEntityType => {
        switch (block.type) {
          case 'paragraph':
          case 'text':
          case 'heading':
          case 'listItem':
          case 'bulletList':
          case 'orderedList':
            return 'TEXT';
          case 'tableNode':
            return 'DATA';
          case 'image':
            return 'IMAGE';
        }
      })();

      const newRelation: Relation = {
        id: newRelationId,
        index: newTripleOrdering.triple.value.value,
        typeOf: {
          id: EntityId(SYSTEM_IDS.BLOCKS),
          name: 'Blocks',
        },
        toEntity: {
          id: EntityId(addedBlock),
          renderableType,
          name: null,
          value: addedBlock,
        },
        fromEntity: {
          id: EntityId(entityPageId),
          name: null,
        },
      };

      DB.upsertRelation({ relation: newRelation, spaceId });
      newBlocks.push(newRelation);
    }

    const relationIdsForRemovedBlocks = blockRelations.filter(r => removedBlockIds.includes(r.block.id));
    for (const relation of relationIdsForRemovedBlocks) {
      // @TODO(performance) removeMany
      DB.removeRelation({
        relationId: relation.relationId,
        spaceId,
      });
    }
  }
};

export function useEditorStore() {
  const { id: entityId, spaceId, initialBlockRelations, initialBlocks } = useEditorInstance();

  const blockRelations = useRelations(
    React.useMemo(() => {
      return {
        mergeWith: initialBlockRelations,
        selector: r => r.fromEntity.id === entityId && r.typeOf.id === EntityId(SYSTEM_IDS.BLOCKS),
      };
    }, [initialBlockRelations, entityId])
  )
    .map(relationToRelationWithBlock)
    .sort(sortByIndex);

  const blockIds = React.useMemo(() => {
    return blockRelations.map(b => b.block.id);
  }, [blockRelations]);

  /**
   * Tiptap expects a JSON representation of the editor state, but we store our block state
   * in a Knowledge Graph-specific data model. We need to map from our KG representation
   * back to the Tiptap representation whenever the KG data changes.
   */
  const editorJson = React.useMemo(() => {
    const json = {
      type: 'doc',
      content: blockIds.map(blockId => {
        const markdownTriplesForBlockId = getTriples({
          mergeWith: initialBlocks.flatMap(b => b.triples),
          selector: triple => triple.entityId === blockId && triple.attributeId === SYSTEM_IDS.MARKDOWN_CONTENT,
        });

        const markdownTripleForBlockId = markdownTriplesForBlockId[0];
        const relationForBlockId = blockRelations.find(r => r.block.id === blockId);

        const toEntity = relationForBlockId?.block;

        // if (value?.type === 'IMAGE') {
        //   return {
        //     type: 'image',
        //     attrs: {
        //       spaceId,
        //       id: blockId,
        //       src: getImagePath(value.value),
        //       alt: '',
        //       title: '',
        //     },
        //   };
        // }

        if (toEntity?.type === 'DATA') {
          return {
            type: 'tableNode',
            attrs: {
              id: blockId,
            },
          };
        }

        const html = markdownTripleForBlockId
          ? Parser.markdownToHtml(Values.stringValue(markdownTripleForBlockId) || '')
          : '';
        /* SSR on custom react nodes doesn't seem to work out of the box at the moment */
        const isSSR = typeof window === 'undefined';
        const json = isSSR ? generateServerJSON(html, tiptapExtensions) : generateJSON(html, tiptapExtensions);
        const nodeData = json.content[0];

        return {
          ...nodeData,
          attrs: {
            id: blockId,
          },
        };
      }),
    };

    if (json.content.length === 0) {
      json.content.push({
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: '',
          },
        ],
      });
    }

    return json;
  }, [blockIds, blockRelations, initialBlocks]);

  const upsertEditorState = React.useCallback(
    (json: JSONContent) => {
      const { content = [] } = json;

      const populatedContent = content.filter(node => {
        const isNonParagraph = node.type !== 'paragraph';
        const isParagraphWithContent =
          node.type === 'paragraph' &&
          node.content &&
          node.content.length > 0 &&
          node.content[0].text &&
          !node.content[0].text.startsWith('/'); // Do not create a block if the text node starts with a slash command

        return isNonParagraph || isParagraphWithContent;
      });

      const newBlocks = populatedContent.map(node => {
        return {
          id: getNodeId(node),
          type: node.type as Content['type'],
        };
      });

      const newBlockIds = newBlocks.map(b => b.id);

      const addedBlockIds = Array.difference(newBlockIds, blockIds);
      const addedBlocks = newBlocks.filter(b => addedBlockIds.includes(b.id));

      // Updating all of the Geo state as the editor state changes is complex. There are
      // many relations and entities created to create the graph of different block types
      // and any relations they have for themselves or with the entity from which they're
      // being consumed.
      //
      // To make modeling this easier, we should follow this pattern:
      // 1. Create and delete entities as they are added/removed (?)
      // 2. Create and remove relations consuming these entities as they are added/removed
      // 3. Update any individual relations, triples, or blocks as they are changed.
      //
      // One consideration is that we may want to consume already-existing entities
      // in a block, so we may not want to delete them.
      //
      // @TODO we can probably write all of these changes at once by aggregating the
      // "actions" then performing them. See our migrate module for this pattern.
      for (const node of addedBlocks) {
        const blockType = (() => {
          switch (node.type) {
            case 'tableNode':
              return SYSTEM_IDS.DATA_BLOCK;
            case 'bulletList':
            case 'paragraph':
              return SYSTEM_IDS.TEXT_BLOCK;
            case 'image':
              return SYSTEM_IDS.IMAGE_BLOCK;
            default:
              return SYSTEM_IDS.TEXT_BLOCK;
          }
        })();

        // Create an entity with Types -> XBlock
        // @TODO: ImageBlock
        switch (blockType) {
          case SYSTEM_IDS.TEXT_BLOCK:
            DB.upsertRelation({ relation: getRelationForBlockType(node.id, SYSTEM_IDS.TEXT_BLOCK), spaceId });
            break;
          case SYSTEM_IDS.IMAGE_BLOCK:
            break;
          case SYSTEM_IDS.DATA_BLOCK: {
            // @TODO(performance): upsertMany
            for (const relation of makeInitialDataEntityRelations(EntityId(node.id))) {
              DB.upsertRelation({ relation, spaceId });
            }

            break;
          }
        }
      }

      const removedBlockIds = Array.difference(blockIds, newBlockIds);

      for (const removedBlockId of removedBlockIds) {
        // @TODO(performance) removeMany
        DB.removeEntity(removedBlockId, spaceId);
      }

      makeBlocksRelations({
        nextBlocks: newBlocks,
        addedBlockIds,
        removedBlockIds,
        spaceId,
        blockRelations: blockRelations,
        entityPageId: entityId,
      });

      /**
       * After creating/deleting any blocks and relations we set any updated
       * ops for the current set of blocks. e.g., updating a text block's name.
       */
      for (const node of populatedContent) {
        switch (node.type) {
          case 'tableNode':
            // createTableBlockMetadata(node);
            break;
          case 'bulletList':
          case 'paragraph': {
            const ops = TextEntity.getTextEntityOps(node);
            DB.upsertMany(ops, spaceId);
            break;
          }

          case 'image':
            // createBlockImageTriple(node);
            break;
          default:
            break;
        }
      }
    },
    [spaceId, blockRelations, blockIds, entityId]
  );

  return {
    upsertEditorState,
    editorJson,
    blockIds,
  };
}
