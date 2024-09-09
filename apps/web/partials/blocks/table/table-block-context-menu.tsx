'use client';

import { SYSTEM_IDS } from '@geogenesis/sdk';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import cx from 'classnames';
import { motion } from 'framer-motion';
import { useAtom } from 'jotai';

import * as React from 'react';

import { useWriteOps } from '~/core/database/write';
import { useUserIsEditing } from '~/core/hooks/use-user-is-editing';
import { Relation } from '~/core/io/dto/entities';
import { useTableBlock } from '~/core/state/table-block-store';
import { NavUtils } from '~/core/utils/utils';

import { ChevronRight } from '~/design-system/icons/chevron-right';
import { Close } from '~/design-system/icons/close';
import { Cog } from '~/design-system/icons/cog';
import { Context } from '~/design-system/icons/context';
import { Copy } from '~/design-system/icons/copy';
import { Eye } from '~/design-system/icons/eye';
import { EyeHide } from '~/design-system/icons/eye-hide';
import { LeftArrowLong } from '~/design-system/icons/left-arrow-long';
import { MenuItem } from '~/design-system/menu';
import { PrefetchLink as Link } from '~/design-system/prefetch-link';

import { DataBlockSourceMenu } from '~/partials/blocks/table/data-block-source-menu';

import { editingColumnsAtom } from '~/atoms';

// We keep track of the attributes in local state in order to quickly render
// the changes the user has made to the schema. Otherwise there will be loading
// states for several actions which will make the UI feel slow.
// const optimisticAttributesAtom = atom<SearchResult[]>([]);

// function useOptimisticAttributes({
//   entityId,
//   entityName,
//   spaceId,
// }: {
//   entityId: string;
//   entityName: string | null;
//   spaceId: string;
// }) {
//   const [optimisticAttributes, setOptimisticAttributes] = useAtom(optimisticAttributesAtom);
//   const { upsert, remove } = useWriteOps();
//   const migrateHub = useMigrateHub();

//   const onAddAttribute = (attribute: SearchResult) => {
//     upsert(
//       {
//         entityId: entityId,
//         entityName: attribute.name,
//         attributeId: SYSTEM_IDS.ATTRIBUTES,
//         attributeName: 'Attributes',
//         value: {
//           type: 'ENTITY',
//           value: attribute.id,
//           name: attribute.name,
//         },
//       },
//       spaceId
//     );

//     setOptimisticAttributes([...optimisticAttributes, attribute]);
//   };

//   const onUpdateAttribute = (attribute: SearchResult) => {
//     const remappedOptimisticAttributes = optimisticAttributes.map(a => {
//       if (a.id === attribute.id) {
//         return attribute;
//       }

//       return a;
//     });

//     setOptimisticAttributes(remappedOptimisticAttributes);
//   };

//   const onRemoveAttribute = (attribute: Entity, nameTriple?: ITriple) => {
//     if (!nameTriple) {
//       return;
//     }

//     remove(
//       Triples.withId({
//         attributeId: SYSTEM_IDS.ATTRIBUTES,
//         attributeName: 'Attributes',
//         entityId: entityId,
//         entityName: entityName,
//         space: spaceId,
//         value: {
//           type: 'ENTITY',
//           value: nameTriple.entityId,
//           name: nameTriple.entityName,
//         },
//       }),
//       spaceId
//     );

//     setOptimisticAttributes(optimisticAttributes.filter(a => a.id !== attribute.id));
//   };

//   const onChangeAttributeValueType = (newValueTypeId: ValueTypeId, attribute: Entity) => {
//     const attributeValueTypeTriple = attribute.triples.find(t => t.attributeId === SYSTEM_IDS.VALUE_TYPE);
//     // This _should_ only be one space, but there may be a situation now where it's multiple spaces. Need to monitor this.
//     const attributeSpace = attribute.nameTripleSpaces?.[0];

//     if (attributeValueTypeTriple) {
//       if (attributeSpace) {
//         remove(attributeValueTypeTriple, attributeSpace);
//       }

//       const oldValueTypeId = attributeValueTypeTriple.value.value;

//       // We want to make sure that the ID is actually one of the value types
//       // before we run any migrations.
//       //
//       // @TODO: Is there a better way to have this encoded into the type system
//       // of `value.id`?
//       if (oldValueTypeId in valueTypes) {
//         migrateHub.dispatch({
//           type: 'CHANGE_VALUE_TYPE',
//           payload: {
//             attributeId: attribute.id,
//             oldValueType: valueTypes[oldValueTypeId as ValueTypeId],
//             newValueType: valueTypes[newValueTypeId],
//           },
//         });
//       }
//     }

//     if (attributeSpace) {
//       const newTriple = Triples.withId({
//         entityId: attribute.id,
//         entityName: attribute.name,
//         attributeId: SYSTEM_IDS.VALUE_TYPE,
//         attributeName: 'Value type',
//         space: attributeSpace,
//         value: {
//           type: 'ENTITY',
//           value: newValueTypeId,
//           name: valueTypeNames[newValueTypeId],
//         },
//       });

//       // @TODO(relations): Update the attribute in-place in the optimistic state
//       // const updatedTriples = [
//       //   ...attribute.triples.filter(t => {
//       //     return t.attributeId !== SYSTEM_IDS.VALUE_TYPE;
//       //   }),
//       //   newTriple,
//       // ];

//       // Update the attribute in-place in the optimistic state
//       onUpdateAttribute({
//         ...attribute,
//         // @TODO(database)
//         spaces: [],
//         // triples: updatedTriples,
//       });

//       // Create a new Value Type triple with the new value type
//       upsert(newTriple, newTriple.space);
//     }
//   };

//   const { data } = useSuspenseQuery({
//     queryKey: ['table-block-type-schema-configuration-attributes-list', entityId],
//     queryFn: async () => {
//       const attributes = await getSchemaFromTypeIds([entityId]);

//       // Fetch the the entities for each of the Attribute in the type
//       const maybeAttributeEntities = await Promise.all(attributes.map(t => mergeEntityAsync(t.id)));
//       return maybeAttributeEntities.filter(e => e !== null);
//     },
//   });

//   // Update the modal state with the initial data for the attributes. We update this modal state optimistically
//   // when users add or remove attributes.
//   React.useEffect(() => {
//     // @ts-expect-error @TODO(database)
//     setOptimisticAttributes(data ?? []);
//   }, [data, setOptimisticAttributes]);

//   return {
//     optimisticAttributes,
//     onAddAttribute,
//     onRemoveAttribute,
//     onChangeAttributeValueType,
//   };
// }

type Column = {
  id: string;
  name: string | null;
};

type TableBlockContextMenuProps = {
  allColumns: Array<Column>;
  shownColumnRelations: Array<Relation>;
  shownColumnIds: Array<string>;
};

export function TableBlockContextMenu({
  allColumns,
  shownColumnRelations,
  shownColumnIds,
}: TableBlockContextMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const { spaceId, entityId, name } = useTableBlock();
  const [isEditingDataSource, setIsEditingDataSource] = React.useState(false);
  const [isEditingColumns, setIsEditingColumns] = useAtom(editingColumnsAtom);

  const isEditing = useUserIsEditing(spaceId);

  if (!isEditing) {
    setIsEditingColumns(false);
  }

  const onCopyBlockId = async () => {
    try {
      await navigator.clipboard.writeText(entityId);
      setIsMenuOpen(false);
      setIsEditingDataSource(false);
      setIsEditingColumns(false);
    } catch (err) {
      console.error('Failed to copy table block entity ID for: ', entityId);
    }
  };

  const onOpenChange = () => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
      setIsEditingDataSource(false);
      setIsEditingColumns(false);
    } else {
      setIsMenuOpen(true);
    }
  };

  const isInitialState = !isEditingDataSource && !isEditingColumns;

  return (
    <Dropdown.Root open={isMenuOpen} onOpenChange={onOpenChange}>
      <Dropdown.Trigger>{isMenuOpen ? <Close color="grey-04" /> : <Context color="grey-04" />}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          sideOffset={8}
          className="z-[1001] block !w-[200px] overflow-hidden rounded-lg border border-grey-02 bg-white shadow-lg"
          align="end"
        >
          {isInitialState && (
            <>
              {isEditing && (
                <>
                  <MenuItem>
                    <button
                      onClick={() => setIsEditingDataSource(true)}
                      className="flex w-full items-center justify-between gap-2"
                    >
                      <span>Change data source</span>
                      <ChevronRight />
                    </button>
                  </MenuItem>
                  <MenuItem>
                    <button
                      onClick={() => setIsEditingColumns(true)}
                      className="flex w-full items-center justify-between gap-2"
                    >
                      <span>Edit columns</span>
                      <ChevronRight />
                    </button>
                  </MenuItem>
                  {/* <TableBlockSchemaConfigurationDialog
                    trigger={
                      <MenuItem>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-button">Edit types</span>
                          <FilteredTableView />
                        </div>
                      </MenuItem>
                    }
                    content={
                      <div className="flex flex-col gap-6 p-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <div className="relative h-4 w-4 overflow-hidden rounded-sm">
                              <Image layout="fill" objectFit="cover" src={getImagePath(spaceImage ?? '')} />
                            </div>
                            <h1 className="text-mediumTitle">{type.entityName}</h1>
                          </div>

                          <h2 className="text-metadata text-grey-04">
                            Making changes to this type it will affect everywhere that this type is referenced.
                          </h2>
                        </div>
                        <React.Suspense fallback={<AddAttributeLoading />}>
                          <AddAttribute />
                          <SchemaAttributes />
                        </React.Suspense>
                      </div>
                    }
                  /> */}
                  <MenuItem>
                    <Link
                      href={NavUtils.toEntity(spaceId, entityId)}
                      className="flex w-full items-center justify-between gap-2"
                    >
                      <span>View config</span>
                      <Cog />
                    </Link>
                  </MenuItem>
                  <MenuItem>
                    <button onClick={onCopyBlockId} className="flex w-full items-center justify-between gap-2">
                      <span>Copy block ID</span>
                      <Copy />
                    </button>
                  </MenuItem>
                </>
              )}
            </>
          )}
          {isEditingDataSource && <DataBlockSourceMenu onBack={() => setIsEditingDataSource(false)} />}
          {isEditingColumns && (
            <>
              <MenuItem className="border-b border-grey-02">
                <button
                  onClick={() => setIsEditingColumns(false)}
                  className="flex w-full items-center gap-2 text-smallButton"
                >
                  <LeftArrowLong />
                  <span>Back</span>
                </button>
              </MenuItem>
              {allColumns.map((column: Column, index: number) => {
                // do not show name column
                if (index === 0) return null;

                const shownColumnRelation = shownColumnRelations.find(r => r.toEntity.id === column.id) ?? null;

                return (
                  <ToggleColumn
                    key={column.id}
                    column={column}
                    shownColumnIds={shownColumnIds}
                    shownColumnRelation={shownColumnRelation}
                    space={spaceId}
                    entityId={entityId}
                    entityName={name ?? null}
                  />
                );
              })}
            </>
          )}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

type ToggleColumnProps = {
  column: Column;
  shownColumnIds: Array<string>;
  shownColumnRelation: Relation | null;
  space: string;
  entityId: string;
  entityName: string | null;
};

const ToggleColumn = ({
  column,
  shownColumnIds,
  shownColumnRelation,
  space,
  entityId,
  entityName,
}: ToggleColumnProps) => {
  const { upsert } = useWriteOps();

  const { id, name } = column;
  const isShown = shownColumnIds.includes(column.id);

  const onToggleColumn = React.useCallback(async () => {
    const attributeId = SYSTEM_IDS.SHOWN_COLUMNS;
    const attributeName = 'Shown Columns';

    if (!isShown) {
      // @TODO(relations): create relation
      upsert(
        {
          entityId,
          entityName,
          attributeId,
          attributeName,
          value: {
            type: 'ENTITY',
            value: id,
            name,
          },
        },
        space
      );
    } else {
      if (shownColumnRelation) {
        // @TODO(relations): remove all triples
        // remove(shownColumnRelation, space);
      }
    }
  }, [upsert, entityId, entityName, id, isShown, name, shownColumnRelation, space]);

  return (
    <MenuItem>
      <button
        onClick={onToggleColumn}
        className={cx('flex w-full items-center justify-between gap-2', !isShown && 'text-grey-03')}
      >
        <span>{column.name}</span>
        {isShown ? <Eye /> : <EyeHide />}
      </button>
    </MenuItem>
  );
};

// function AddAttributeLoading() {
//   return (
//     <div className="flex flex-col gap-1">
//       <Skeleton className="h-7 w-24" />
//       <div className="flex items-center gap-2">
//         <Skeleton className="h-9 w-14" />
//         <Skeleton className="h-9 w-[400px]" />
//         <Skeleton className="h-9 w-[76px]" />
//       </div>
//     </div>
//   );
// }

// const resultsListActionBarStyles = cva(
//   'sticky bottom-0 flex items-center justify-between gap-2 overflow-hidden bg-white p-2 text-smallButton',
//   {
//     variants: {
//       // We add some styling if the aciton bar is being rendered when results are present vs when results
//       // are not present.
//       withFullBorder: {
//         false: 'rounded shadow-inner-grey-02',
//         true: 'rounded rounded-tl-none rounded-tr-none shadow-inner-grey-02',
//       },
//     },
//     defaultVariants: {
//       withFullBorder: true,
//     },
//   }
// );

// function AddAttribute() {
//   const { type } = useTableBlock();

//   const autocomplete = useSearch({
//     filterByTypes: [SYSTEM_IDS.ATTRIBUTE],
//   });

//   const { optimisticAttributes, onAddAttribute } = useOptimisticAttributes({
//     entityId: type.entityId,
//     entityName: type.entityName,
//     spaceId: type.space,
//   });

//   const onSelect = (result: SearchResult) => {
//     autocomplete.onQueryChange('');
//     onAddAttribute(result);
//   };

//   return (
//     <div className="flex flex-col gap-1">
//       <h3 className="text-bodySemibold">Add attribute</h3>
//       <div className="relative">
//         <Input
//           placeholder="Attribute name..."
//           onChange={e => autocomplete.onQueryChange(e.currentTarget.value)}
//           value={autocomplete.query}
//         />
//         {autocomplete.query && (
//           // The max-height includes extra padding for the action bar to be stuck at the bottom of the list
//           // without overlapping results.
//           <div className="absolute top-10 z-100 flex max-h-[188px] w-full flex-col overflow-hidden rounded bg-white shadow-inner-grey-02">
//             <ResizableContainer duration={0.125}>
//               <ul className="flex max-h-40 list-none flex-col justify-start overflow-y-auto overflow-x-hidden">
//                 {autocomplete.results.map((result, i) => (
//                   <motion.li
//                     initial={{ opacity: 0, y: -5 }}
//                     animate={{ opacity: 1, y: 0 }}
//                     transition={{ delay: 0.02 * i }}
//                     key={result.id}
//                   >
//                     <ResultContent
//                       key={result.id}
//                       onClick={() => onSelect(result)}
//                       alreadySelected={optimisticAttributes.map(a => a.id).includes(result.id)}
//                       result={result}
//                     />
//                   </motion.li>
//                 ))}
//               </ul>

//               <div
//                 className={resultsListActionBarStyles({
//                   withFullBorder: !autocomplete.isEmpty && !autocomplete.isLoading,
//                 })}
//               >
//                 <AnimatePresence mode="popLayout">
//                   {autocomplete.isLoading ? (
//                     <motion.span
//                       key="dots"
//                       initial={{ opacity: 0, scale: 0.95 }}
//                       animate={{ opacity: 1, scale: 1 }}
//                       exit={{ opacity: 0 }}
//                       transition={{ duration: 0.1 }}
//                     >
//                       <Dots />
//                     </motion.span>
//                   ) : (
//                     <motion.span
//                       key="attributes-found"
//                       initial={{ opacity: 0, scale: 0.95 }}
//                       animate={{ opacity: 1, scale: 1 }}
//                       exit={{ opacity: 0 }}
//                       transition={{ duration: 0.1 }}
//                     >
//                       {autocomplete.results.length} {pluralize('attribute', autocomplete.results.length)} found
//                     </motion.span>
//                   )}
//                 </AnimatePresence>
//                 <div className="flex items-baseline gap-3">
//                   <TextButton>Create new attribute</TextButton>
//                 </div>
//               </div>
//             </ResizableContainer>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// function SchemaAttributes() {
//   const { type } = useTableBlock();

//   const {
//     optimisticAttributes: attributes,
//     // onRemoveAttribute,
//     // onChangeAttributeValueType,
//   } = useOptimisticAttributes({
//     entityId: type.entityId,
//     entityName: type.entityName,
//     spaceId: type.space,
//   });

//   // @TODO(relations)
//   // const onChangeAttributeName = (newName: string, attribute: Entity, oldNameTriple?: ITriple) => {
//   //   // This _should_ only be in one space, but it could be in multiple now. Need to monitor this.
//   //   const attributeSpace = attribute.nameTripleSpaces?.[0];

//   //   if (!attributeSpace || !oldNameTriple) {
//   //     console.error("The entity doesn't have a name triple space");
//   //     return;
//   //   }

//   //   upsert(
//   //     {
//   //       ...oldNameTriple,
//   //       entityName: newName,
//   //       value: {
//   //         type: 'TEXT',
//   //         value: newName,
//   //       },
//   //     },
//   //     attributeSpace
//   //   );
//   // };

//   return (
//     <div className="flex flex-col gap-1">
//       <h3 className="text-bodySemibold">Attributes</h3>
//       <div className="flex flex-col gap-2">
//         {attributes?.map(() => {
//           // @TODO(relations)
//           return null;
//           // const valueTypeId: ValueTypeId | undefined = attributeEntity.triples.find(
//           //   t => t.attributeId === SYSTEM_IDS.VALUE_TYPE
//           // )?.value.value as ValueTypeId;

//           // const nameTripleForAttribute = attributeEntity.triples.find(t => t.attributeId === SYSTEM_IDS.NAME);

//           // return (
//           //   <div key={attributeEntity.id} className="flex items-center gap-4">
//           //     {/* <div className="rounded bg-grey-01 px-5 py-2.5"> */}
//           //     <AttributeValueTypeDropdown
//           //       valueTypeId={valueTypeId}
//           //       onChange={valueTypeId => onChangeAttributeValueType(valueTypeId, attributeEntity)}
//           //     />
//           //     {/* </div> */}
//           //     <Input
//           //       defaultValue={attributeEntity.name ?? ''}
//           //       onBlur={e => onChangeAttributeName(e.currentTarget.value, attributeEntity, nameTripleForAttribute)}
//           //     />
//           //     {/* {valueTypeId === SYSTEM_IDS.RELATION && (
//           //       <AttributeConfigurationMenu
//           //         trigger={<Cog />}
//           //         attributeId={attributeEntity.id}
//           //         attributeName={attributeEntity.name}
//           //       />
//           //     )} */}
//           //     <AttributeRowContextMenu
//           //       onRemoveAttribute={() => onRemoveAttribute(attributeEntity, nameTripleForAttribute)}
//           //     />
//           //   </div>
//           // );
//         })}
//       </div>
//     </div>
//   );
// }

// function AttributeRowContextMenu({ onRemoveAttribute }: { onRemoveAttribute: () => void }) {
//   const [isOpen, setIsOpen] = React.useState(false);

//   return (
//     <Menu
//       open={isOpen}
//       onOpenChange={setIsOpen}
//       trigger={<Context color="grey-04" />}
//       className="max-w-[180px] bg-white"
//     >
//       <MenuItem>
//         <button onClick={onRemoveAttribute} className="inline-flex w-full items-center justify-between gap-2 px-3 py-2">
//           <Trash /> <span>Remove attribute</span>
//         </button>
//       </MenuItem>
//     </Menu>
//   );
// }

// function AttributeValueTypeDropdown({
//   valueTypeId,
//   onChange,
// }: {
//   valueTypeId?: ValueTypeId;
//   onChange: (valueTypeId: ValueTypeId) => void;
// }) {
//   const [isOpen, setIsOpen] = React.useState(false);

//   const options = [
//     {
//       label: (
//         <div className="flex items-center gap-2">
//           <Text color="grey-04" />
//           <p>Text</p>
//         </div>
//       ),
//       value: SYSTEM_IDS.TEXT,
//       onClick: () => onChange(SYSTEM_IDS.TEXT),
//     },
//     {
//       label: (
//         <div className="flex items-center gap-2">
//           <RelationIcon color="grey-04" />
//           <p>Relation</p>
//         </div>
//       ),
//       value: SYSTEM_IDS.RELATION,
//       onClick: () => onChange(SYSTEM_IDS.RELATION),
//     },
//     {
//       label: (
//         <div className="flex items-center gap-2">
//           <Date color="grey-04" />
//           <p>Date</p>
//         </div>
//       ),
//       value: SYSTEM_IDS.DATE,
//       onClick: () => onChange(SYSTEM_IDS.DATE),
//     },
//     {
//       label: (
//         <div className="flex items-center gap-2">
//           <Url color="grey-04" />
//           <p>Web URL</p>
//         </div>
//       ),
//       value: SYSTEM_IDS.WEB_URL,
//       onClick: () => onChange(SYSTEM_IDS.WEB_URL),
//     },
//   ];

//   return (
//     <Menu
//       open={isOpen}
//       onOpenChange={setIsOpen}
//       trigger={
//         <button className="shadow-button">
//           <div className=" flex flex-grow items-center justify-between whitespace-nowrap rounded bg-white px-3 py-2 text-button text-text shadow-inner-grey-02 hover:shadow-inner-text focus:shadow-inner-lg-text [&[data-placeholder]]:text-text">
//             <ActiveTypeIcon valueTypeId={valueTypeId} />
//             <Spacer width={8} />
//             <ChevronDownSmall color="ctaPrimary" />
//           </div>
//         </button>
//       }
//       align="start"
//       className="z-10 max-w-[160px] bg-white"
//     >
//       {options.map(option => (
//         <MenuItem key={option.value}>
//           <button onClick={option.onClick} className="flex w-full items-center justify-between gap-2 px-3 py-2">
//             {option.label}
//           </button>
//         </MenuItem>
//       ))}
//     </Menu>
//   );
// }

// function ActiveTypeIcon({ valueTypeId }: { valueTypeId?: ValueTypeId }) {
//   switch (valueTypeId) {
//     case SYSTEM_IDS.TEXT:
//       return <Text color="grey-04" />;
//     case SYSTEM_IDS.RELATION:
//       return <RelationIcon color="grey-04" />;
//     case SYSTEM_IDS.DATE:
//       return <Date color="grey-04" />;
//     case SYSTEM_IDS.WEB_URL:
//       return <Url color="grey-04" />;
//     default:
//       // We default to the Text type if an attribute has not set an explicit relation value
//       // type. Ideally we force users to explicitly set a type when creating an attribute,
//       // but for now we do not.
//       return <Text color="grey-04" />;
//   }
// }
