import { Effect } from 'effect';
import type * as S from 'zapatos/schema';

import { getChecksumAddress } from '../../utils/get-checksum-address';
import { slog } from '../../utils/slog';
import type { MemberAdded } from './parser';
import { Spaces } from '~/sink/db';
import type { GeoBlock } from '~/sink/types';

export function mapMembers(membersApproved: MemberAdded[], block: GeoBlock) {
  return Effect.gen(function* (unwrap) {
    const members: S.space_members.Insertable[] = [];

    for (const member of membersApproved) {
      // @TODO: effect.all
      const maybeSpaceIdForVotingPlugin = yield* unwrap(
        Effect.promise(() => Spaces.findForVotingPlugin(member.mainVotingPluginAddress))
      );

      const maybeSpaceIdForPersonalPlugin = yield* unwrap(
        Effect.promise(() => Spaces.findForPersonalPlugin(member.mainVotingPluginAddress))
      );

      if (!maybeSpaceIdForVotingPlugin && !maybeSpaceIdForPersonalPlugin) {
        slog({
          level: 'error',
          message: `Matching space for approved member not found for plugin address ${member.mainVotingPluginAddress}`,
          requestId: block.requestId,
        });

        continue;
      }

      if (maybeSpaceIdForVotingPlugin) {
        const newMember: S.space_members.Insertable = {
          account_id: getChecksumAddress(member.memberAddress),
          space_id: getChecksumAddress(maybeSpaceIdForVotingPlugin),
          created_at: block.timestamp,
          created_at_block: block.blockNumber,
          created_at_block_network: block.hash,
          created_at_block_hash: block.network,
        };

        members.push(newMember);
      }

      if (maybeSpaceIdForPersonalPlugin) {
        const newMember: S.space_members.Insertable = {
          account_id: getChecksumAddress(member.memberAddress),
          space_id: maybeSpaceIdForPersonalPlugin.id,
          created_at: block.timestamp,
          created_at_block: block.blockNumber,
          created_at_block_network: block.hash,
          created_at_block_hash: block.network,
        };

        members.push(newMember);
      }
    }

    return members;
  });
}
