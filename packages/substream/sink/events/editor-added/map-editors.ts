import { Effect } from 'effect';
import type * as S from 'zapatos/schema';

import type { EditorAdded } from './parser';
import { Spaces } from '~/sink/db';
import type { BlockEvent } from '~/sink/types';
import { getChecksumAddress } from '~/sink/utils/get-checksum-address';
import { slog } from '~/sink/utils/slog';

export function mapEditors(editorAdded: EditorAdded[], block: BlockEvent) {
  return Effect.gen(function* (unwrap) {
    const editors: S.space_editors.Insertable[] = [];

    for (const editor of editorAdded) {
      // @TODO: effect.all
      const maybeSpaceIdForVotingPlugin = yield* unwrap(
        Effect.tryPromise({
          try: () => Spaces.findForVotingPlugin(editor.mainVotingPluginAddress),
          catch: () => new Error(),
        })
      );

      const maybeSpaceIdForPersonalPlugin = yield* unwrap(
        Effect.tryPromise({
          try: () => Spaces.findForPersonalPlugin(editor.mainVotingPluginAddress),
          catch: () => new Error(),
        })
      );

      if (!maybeSpaceIdForVotingPlugin && !maybeSpaceIdForPersonalPlugin) {
        slog({
          level: 'error',
          message: `Matching space for approved editor not found for plugin address ${editor.mainVotingPluginAddress}`,
          requestId: block.requestId,
        });

        continue;
      }

      if (maybeSpaceIdForVotingPlugin) {
        const newMember: S.space_editors.Insertable = {
          account_id: getChecksumAddress(editor.editorAddress),
          space_id: maybeSpaceIdForVotingPlugin,
          created_at: block.timestamp,
          created_at_block: block.blockNumber,
        };

        editors.push(newMember);
      }

      if (maybeSpaceIdForPersonalPlugin) {
        const newMember: S.space_editors.Insertable = {
          account_id: getChecksumAddress(editor.editorAddress),
          space_id: maybeSpaceIdForPersonalPlugin.id,
          created_at: block.timestamp,
          created_at_block: block.blockNumber,
        };

        editors.push(newMember);
      }
    }

    return editors;
  });
}
