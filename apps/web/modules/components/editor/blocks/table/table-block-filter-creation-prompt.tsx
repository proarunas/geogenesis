import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Content, Root, Trigger, Portal } from '@radix-ui/react-popover';

import { SYSTEM_IDS } from '@geogenesis/ids';
import { TableBlockFilter } from './table-block-store';
import { TripleValueType, Entity, Space } from '~/modules/types';
import { TextButton } from '~/modules/design-system/text-button';
import { Spacer } from '~/modules/design-system/spacer';
import { Select } from '~/modules/design-system/select';
import { Input } from '~/modules/design-system/input';
import { ResizableContainer } from '~/modules/design-system/resizable-container';
import { ResultContent, ResultsList } from '~/modules/components/entity/autocomplete/results-list';
import { useAutocomplete } from '~/modules/search';
import { useSpaces } from '~/modules/spaces/use-spaces';
import { Text } from '~/modules/design-system/text';
import { ResultItem } from '~/modules/components/entity/autocomplete/results-list';
import { Breadcrumb } from '~/modules/design-system/breadcrumb';
import { ChevronDownSmall } from '~/modules/design-system/icons/chevron-down-small';
import { Tag } from '~/modules/design-system/tag';

interface TableBlockFilterPromptProps {
  trigger: React.ReactNode;
  options: (TableBlockFilter & { columnName: string })[];
  onCreate: (filter: { columnId: string; value: string; valueType: TripleValueType; valueName: string | null }) => void;
}

const TableBlockFilterPromptContent = motion(Content);

/**
 * There are several types of columns we might be filtering on, some of which aren't actually columns, so have
 * special handling when creating the graphql string.
 * 1. Name
 * 2. Space
 * 3. Any entity or string column
 *
 * Name and Space are treated specially. The complexity comes in when setting the filter for the Space, since the
 * id of the Space entity and address of the Space contract aren't the same.
 */

type InterfaceFilterValue =
  | { type: 'string'; value: string }
  | {
      type: 'entity';
      entityId: string;
      entityName: string | null;
    }
  | { type: 'space'; spaceId: string; spaceName: string | null };

function getFilterValue(interfaceFilterValue: InterfaceFilterValue) {
  switch (interfaceFilterValue.type) {
    case 'string':
      return interfaceFilterValue.value;
    case 'entity':
      return interfaceFilterValue.entityId;
    case 'space':
      return interfaceFilterValue.spaceId;
  }
}

function getFilterValueName(interfaceFilterValue: InterfaceFilterValue) {
  switch (interfaceFilterValue.type) {
    case 'string':
      return interfaceFilterValue.value;
    case 'entity':
      return interfaceFilterValue.entityName;
    case 'space':
      return interfaceFilterValue.spaceName;
  }
}

// function getFilterDefaultValueForType(type: InterfaceFilterValue['type']) {
//   switch (type) {
//     case 'string':
//       return {
//         type: 'string',
//         value: '',
//       };
//     case 'entity':
//       return {
//         type: 'entity',
//         entityId: '',
//         entityName: null,
//       };
//     case 'space':
//       return {
//         type: 'space',
//         spaceId: '',
//         spaceName: null,
//       };
//   }
// }

export function TableBlockFilterPrompt({ trigger, onCreate, options }: TableBlockFilterPromptProps) {
  const [open, setOpen] = React.useState(false);

  const [selectedColumn, setSelectedColumn] = React.useState<string>(SYSTEM_IDS.NAME);
  const [value, setValue] = React.useState<InterfaceFilterValue>({ type: 'string', value: '' });

  const onOpenChange = (open: boolean) => {
    setSelectedColumn(SYSTEM_IDS.NAME);
    setValue({ type: 'string', value: '' });
    setOpen(open);
  };

  const onDone = () => {
    onCreate({
      columnId: selectedColumn,
      value: getFilterValue(value),
      valueType: options.find(o => o.columnId === selectedColumn)?.valueType ?? 'string',
      valueName: getFilterValueName(value),
    });
    setOpen(false);
    setSelectedColumn(SYSTEM_IDS.NAME);
    setValue({ type: 'string', value: '' });
  };

  const onSelectColumnToFilter = (columnId: string) => {
    setSelectedColumn(columnId);

    // @TODO: The value should be based on the selected column value type
    setValue({ type: 'string', value: '' });
  };

  const onSelectEntityValue = (entity: { id: string; name: string | null }) => {
    setValue({
      type: 'entity',
      entityId: entity.id,
      entityName: entity.name,
    });
  };

  const onSelectSpaceValue = (space: { id: string; name: string | null }) => {
    setValue({
      type: 'space',
      spaceId: space.id,
      spaceName: space.name,
    });
  };

  return (
    <Root open={open} onOpenChange={onOpenChange}>
      <Trigger>{trigger}</Trigger>
      <Portal>
        <AnimatePresence>
          {open && (
            <TableBlockFilterPromptContent
              forceMount={true}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.1,
                ease: 'easeInOut',
              }}
              avoidCollisions={true}
              className="z-10 w-[472px] origin-top-left rounded border border-grey-02 bg-white p-2 shadow-lg"
              sideOffset={8}
              align="start"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-smallButton">New filter</span>
                  <TextButton onClick={onDone}>Done</TextButton>
                </div>

                <Spacer height={12} />

                <div className="flex items-center justify-center gap-3">
                  <div className="flex flex-1">
                    <Select
                      options={options.map(o => ({ value: o.columnId, label: o.columnName }))}
                      value={selectedColumn}
                      onChange={onSelectColumnToFilter}
                    />
                  </div>
                  <span className="rounded bg-divider px-3 py-[8.5px] text-button">Is</span>
                  <div className="relative flex flex-1">
                    {selectedColumn === SYSTEM_IDS.SPACE ? (
                      <TableBlockSpaceFilterInput
                        selectedValue={getFilterValueName(value) ?? ''}
                        onSelect={onSelectSpaceValue}
                      />
                    ) : options.find(o => o.columnId === selectedColumn)?.valueType === 'entity' ? (
                      <TableBlockEntityFilterInput
                        selectedValue={getFilterValueName(value) ?? ''}
                        onSelect={onSelectEntityValue}
                      />
                    ) : (
                      <Input
                        value={typeof value === 'string' ? value : ''}
                        onChange={e => setValue({ type: 'string', value: e.currentTarget.value })}
                      />
                    )}
                  </div>
                </div>
              </div>
            </TableBlockFilterPromptContent>
          )}
        </AnimatePresence>
      </Portal>
    </Root>
  );
}

interface TableBlockEntityFilterInputProps {
  onSelect: (result: Entity) => void;
  selectedValue: string;
}

function TableBlockEntityFilterInput({ onSelect, selectedValue }: TableBlockEntityFilterInputProps) {
  const autocomplete = useAutocomplete();
  const { spaces } = useSpaces();

  return (
    <div className="relative w-full">
      <Input
        value={autocomplete.query === '' ? selectedValue : autocomplete.query}
        onChange={e => autocomplete.onQueryChange(e.target.value)}
      />
      {autocomplete.query && (
        <div className="absolute top-10 z-[1] flex max-h-[340px] w-[254px] flex-col overflow-hidden rounded bg-white shadow-inner-grey-02">
          <ResizableContainer duration={0.125}>
            <ResultsList>
              {autocomplete.results.map((result, i) => (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.02 * i }}
                  key={result.id}
                >
                  <ResultContent
                    key={result.id}
                    onClick={() => {
                      autocomplete.onQueryChange('');
                      onSelect(result);
                    }}
                    spaces={spaces}
                    alreadySelected={false}
                    result={result}
                  />
                </motion.div>
              ))}
            </ResultsList>
          </ResizableContainer>
        </div>
      )}
    </div>
  );
}

interface TableBlockSpaceFilterInputProps {
  onSelect: (result: { id: string; name: string | null }) => void;
  selectedValue: string;
}

function TableBlockSpaceFilterInput({ onSelect, selectedValue }: TableBlockSpaceFilterInputProps) {
  const [query, onQueryChange] = React.useState('');
  const { spaces } = useSpaces();

  const results = spaces.filter(s => s.attributes[SYSTEM_IDS.NAME]?.toLowerCase().includes(query.toLowerCase()));

  const onSelectSpace = (space: Space) => {
    onQueryChange('');

    onSelect({
      id: space.id,
      name: space.attributes[SYSTEM_IDS.NAME] ?? null,
    });
  };

  return (
    <div className="relative w-full">
      <Input value={query === '' ? selectedValue : query} onChange={e => onQueryChange(e.target.value)} />
      {query && (
        <div className="absolute top-10 z-[1] flex max-h-[340px] w-[254px] flex-col overflow-hidden rounded bg-white shadow-inner-grey-02">
          <ResizableContainer duration={0.125}>
            <ResultsList>
              {results.map((result, i) => (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.02 * i }}
                  key={result.id}
                >
                  <ResultItem onClick={() => onSelectSpace(result)}>
                    <div className="flex w-full items-center justify-between leading-[1rem]">
                      <Text as="li" variant="metadataMedium" ellipsize className="leading-[1.125rem]">
                        {result.attributes[SYSTEM_IDS.NAME] ?? result.id}
                      </Text>
                    </div>
                    <Spacer height={4} />
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {(result.attributes[SYSTEM_IDS.NAME] ?? null) && (
                        <Breadcrumb img={result.attributes[SYSTEM_IDS.IMAGE_ATTRIBUTE] ?? ''}>
                          {result.attributes[SYSTEM_IDS.NAME] ?? result.id}
                        </Breadcrumb>
                      )}
                      <span style={{ rotate: '270deg' }}>
                        <ChevronDownSmall color="grey-04" />
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Tag>Space</Tag>
                      </div>
                    </div>
                  </ResultItem>
                </motion.div>
              ))}
            </ResultsList>
          </ResizableContainer>
        </div>
      )}
    </div>
  );
}
