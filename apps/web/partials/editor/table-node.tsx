import { Node, NodeViewRendererProps, NodeViewWrapper, ReactNodeViewRenderer, mergeAttributes } from '@tiptap/react';
import { ErrorBoundary } from 'react-error-boundary';

import * as React from 'react';

import { useEditorInstance } from '~/core/state/editor/editor-provider';
import { TableBlockProvider } from '~/core/state/table-block-store';

import { TableBlock, TableBlockError } from '../blocks/table/table-block';

export const TableNode = Node.create({
  name: 'tableNode',
  group: 'block',
  atom: true,
  spanning: false,
  allowGapCursor: false,
  defining: true,
  exitable: true,

  parseHTML() {
    return [
      {
        tag: 'table-node',
      },
    ];
  },

  addAttributes() {
    return {
      spaceId: {
        default: '',
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    return ['table-node', mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TableNodeComponent);
  },
});

function TableNodeComponent({ node }: NodeViewRendererProps) {
  const { spaceId } = useEditorInstance();
  const { id } = node.attrs;

  return (
    <NodeViewWrapper>
      <div contentEditable="false">
        <TableNodeChildren spaceId={spaceId} entityId={id} />
      </div>
    </NodeViewWrapper>
  );
}

function TableNodeChildren({ spaceId, entityId }: { spaceId: string; entityId: string }) {
  return (
    <ErrorBoundary fallback={<TableBlockError spaceId={spaceId} blockId={entityId} />}>
      <TableBlockProvider spaceId={spaceId} entityId={entityId}>
        <TableBlock spaceId={spaceId} />
      </TableBlockProvider>
    </ErrorBoundary>
  );
}
