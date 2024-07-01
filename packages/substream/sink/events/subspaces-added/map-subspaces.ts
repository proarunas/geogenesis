import { Effect } from 'effect';
import type * as S from 'zapatos/schema';

import type { SubspaceAdded } from './parser';
import { Spaces } from '~/sink/db';
import { SpaceWithPluginAddressNotFoundError } from '~/sink/errors';
import type { GeoBlock } from '~/sink/types';
import { getChecksumAddress } from '~/sink/utils/get-checksum-address';

export function mapSubspaces({ subspacesAdded, block }: { subspacesAdded: SubspaceAdded[]; block: GeoBlock }) {
  return Effect.gen(function* (_) {
    // Need to get the DAO/space address for the space plugin that emits the
    // SubspaceAdded event.
    const maybeSpacesForPlugins = yield* _(
      Effect.all(
        subspacesAdded.map(p =>
          Effect.tryPromise({
            try: () => Spaces.findForSpacePlugin(p.pluginAddress),
            catch: error => new SpaceWithPluginAddressNotFoundError(String(error)),
          })
        ),
        {
          concurrency: 20,
        }
      )
    );

    const spacesForPlugins = maybeSpacesForPlugins
      .flatMap(s => (s ? [s] : []))
      // Removing any duplicates and transforming to a map for faster access speed later
      .reduce(
        (acc, s) => {
          // Can safely assert that s.main_voting_plugin_address is not null here
          // since we query using that column previously
          //
          // @TODO: There should be a way to return only not-null values using zapatos
          // maybe using `having`
          const checksumPluginAddress = getChecksumAddress(s.space_plugin_address!);

          if (!acc.has(checksumPluginAddress)) {
            acc.set(checksumPluginAddress, s.id);
          }

          return acc;
        },
        // Mapping of the plugin address to the space id (address)
        new Map<string, string>()
      );

    return subspacesAdded.map(({ subspace, pluginAddress }) => {
      const newSubspace: S.space_subspaces.Insertable = {
        // Can safely assert that spacesForPlugins.get(pluginAddress) is not null here
        // since we set up the mapping based on the plugin address previously
        //
        // @NOTE: This might break if we start indexing at a block that occurs after the
        // space was created.
        parent_space_id: spacesForPlugins.get(getChecksumAddress(pluginAddress))!,
        subspace_id: getChecksumAddress(subspace),
        created_at: block.timestamp,
        created_at_block: block.blockNumber,
        created_at_block_hash: block.hash,
        created_at_block_network: block.network,
      };

      return newSubspace;
    });
  });
}
