import BulletList from '@tiptap/extension-bullet-list';
import Document from '@tiptap/extension-document';
import Gapcursor from '@tiptap/extension-gapcursor';
import HardBreak from '@tiptap/extension-hard-break';
import Image from '@tiptap/extension-image';
import ListItem from '@tiptap/extension-list-item';
import Placeholder from '@tiptap/extension-placeholder';
import Text from '@tiptap/extension-text';

import { ConfiguredCommandExtension } from './command-extension';
import { HeadingNode } from './heading-node';
import { ParagraphNode } from './paragraph-node';
import { TableNode } from './table-node';
import { TrailingNode } from './trailing-node';

export const tiptapExtensions = [
  Document,
  Text,
  // StarterKit.configure({
  //   // We're probably only using the Document and Text from the starterkit. Might
  //   // save us bytes to use it directly instead of through the kit.
  //   paragraph: false,
  //   heading: false,
  //   code: false,
  //   hardBreak: false,
  //   gapcursor: false,
  //   bulletList: false,
  //   listItem: false,
  // }),
  ParagraphNode,
  HeadingNode,
  ConfiguredCommandExtension,
  HardBreak.extend({
    addKeyboardShortcuts() {
      // Make hard breaks behave like normal paragraphs
      const handleEnter = () =>
        this.editor.commands.first(({ commands }) => [
          () => commands.newlineInCode(),
          () => commands.createParagraphNear(),
          () => commands.liftEmptyBlock(),
          () => commands.splitBlock(),
        ]);

      return {
        Enter: handleEnter,
        'Mod-Enter': handleEnter,
        'Shift-Enter': handleEnter,
      };
    },
  }),
  Gapcursor,
  TrailingNode,
  BulletList,
  ListItem,
  TableNode,
  Image,
  Placeholder.configure({
    placeholder: ({ node }) => {
      const isHeading = node.type.name === 'heading';
      return isHeading ? 'Heading...' : '/ to select content block or write some content...';
    },
  }),
];
