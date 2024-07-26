import { Effect, Either } from 'effect';

import {
  type EditProposal,
  type EditorshipProposal,
  type MembershipProposal,
  type ProposalCreated,
  type SubspaceProposal,
} from './parser';
import { Spaces } from '~/sink/db';
import type { SpaceWithPluginAddressNotFoundError } from '~/sink/errors';
import { getFetchIpfsContentEffect } from '~/sink/ipfs';
import { Decoder } from '~/sink/proto';
import type { BlockEvent, Op } from '~/sink/types';
import { getChecksumAddress } from '~/sink/utils/get-checksum-address';
import { slog } from '~/sink/utils/slog';

/**
 * We don't know the content type of the proposal until we fetch the IPFS content and parse it.
 *
 * 1. Verify that the space exists for the plugin address
 * 2. Fetch the IPFS content
 * 3. Parse the IPFS content to get the "type"
 * 4. Return an object matching the type and the expected contents.
 *
 * Later on we map this to the database schema and write the proposal to the database.
 */
export function getProposalFromIpfs(
  proposal: ProposalCreated,
  block: BlockEvent
): Effect.Effect<
  EditProposal | SubspaceProposal | MembershipProposal | EditorshipProposal | null,
  SpaceWithPluginAddressNotFoundError
> {
  return Effect.gen(function* (_) {
    // The proposal can come from either the voting plugin or the membership plugin
    // depending on which type of proposal is being processed
    const maybeSpaceIdForVotingPlugin = yield* _(
      Effect.promise(() => Spaces.findForVotingPlugin(proposal.pluginAddress))
    );
    const maybeSpaceIdForMembershipPlugin = yield* _(
      Effect.promise(() => Spaces.findForMembershipPlugin(proposal.pluginAddress))
    );

    if (!maybeSpaceIdForVotingPlugin && !maybeSpaceIdForMembershipPlugin) {
      slog({
        message: `Matching space in Proposal not found for plugin address ${proposal.pluginAddress}`,
        requestId: block.requestId,
      });

      return null;
    }

    slog({
      message: `Fetching IPFS content for proposal
        proposalId:    ${proposal.proposalId}
        pluginAddress: ${proposal.pluginAddress}
        creator:       ${proposal.creator}
        metadataUri:   ${proposal.metadataUri}
        startTime:     ${proposal.startTime}
        endTime:       ${proposal.endTime}`,
      requestId: block.requestId,
    });

    const fetchIpfsContentEffect = getFetchIpfsContentEffect(proposal.metadataUri);
    const maybeIpfsContent = yield* _(Effect.either(fetchIpfsContentEffect));

    if (Either.isLeft(maybeIpfsContent)) {
      const error = maybeIpfsContent.left;

      switch (error._tag) {
        case 'UnableToParseBase64Error':
          console.error(`Unable to parse base64 string ${proposal.metadataUri}`, error);
          break;
        case 'FailedFetchingIpfsContentError':
          console.error(`Failed fetching IPFS content from uri ${proposal.metadataUri}`, error);
          break;
        case 'UnableToParseJsonError':
          console.error(`Unable to parse JSON when reading content from uri ${proposal.metadataUri}`, error);
          break;
        case 'TimeoutException':
          console.error(`Timed out when fetching IPFS content for uri ${proposal.metadataUri}`, error);
          break;
        default:
          console.error(`Unknown error when fetching IPFS content for uri ${proposal.metadataUri}`, error);
          break;
      }

      return null;
    }

    const ipfsContent = maybeIpfsContent.right;

    if (!ipfsContent) {
      return null;
    }

    const validIpfsMetadata = yield* _(Decoder.decodeIpfsMetadata(ipfsContent));

    if (!validIpfsMetadata) {
      // @TODO: Effectify error handling
      console.error('Failed to parse IPFS metadata for proposal', proposal.metadataUri);
      return null;
    }

    switch (validIpfsMetadata.type) {
      case 'ADD_EDIT': {
        const parsedContent = yield* _(Decoder.decodeEdit(ipfsContent));

        // Subspace proposals are only emitted by the voting plugin
        if (!parsedContent || !maybeSpaceIdForVotingPlugin) {
          return null;
        }

        const mappedProposal: EditProposal = {
          ...proposal,
          type: 'ADD_EDIT',
          name: validIpfsMetadata.name ?? null,
          proposalId: parsedContent.id,
          onchainProposalId: proposal.proposalId,
          pluginAddress: getChecksumAddress(proposal.pluginAddress),
          // @TODO: Figure out these types
          ops: parsedContent.ops as unknown as Op[],
          creator: getChecksumAddress(proposal.creator),
          space: maybeSpaceIdForVotingPlugin,
        };

        return mappedProposal;
      }

      case 'ADD_SUBSPACE':
      case 'REMOVE_SUBSPACE': {
        const parsedSubspace = yield* _(Decoder.decodeSubspace(ipfsContent));

        // Subspace proposals are only emitted by the voting plugin
        if (!parsedSubspace || !maybeSpaceIdForVotingPlugin) {
          return null;
        }

        const maybeSpaceIdForSubspaceDaoAddress = yield* _(
          Effect.promise(() => Spaces.findForDaoAddress(getChecksumAddress(parsedSubspace.subspace)))
        );

        if (!maybeSpaceIdForSubspaceDaoAddress) {
          slog({
            requestId: block.requestId,
            message: `Failed to get space for subspace DAO address ${parsedSubspace.subspace}`,
            level: 'error',
          });
          return null;
        }

        const mappedProposal: SubspaceProposal = {
          ...proposal,
          type: validIpfsMetadata.type,
          name: `Add subspace: ${maybeSpaceIdForSubspaceDaoAddress.id}`,
          proposalId: parsedSubspace.id,
          onchainProposalId: proposal.proposalId,
          pluginAddress: getChecksumAddress(proposal.pluginAddress),
          subspace: maybeSpaceIdForSubspaceDaoAddress.id, // this should be the space id
          creator: getChecksumAddress(proposal.creator),
          space: maybeSpaceIdForVotingPlugin,
        };

        return mappedProposal;
      }

      case 'ADD_EDITOR':
      case 'REMOVE_EDITOR': {
        const parsedMembership = yield* _(Decoder.decodeEditorship(ipfsContent));

        if (!parsedMembership) {
          return null;
        }

        // If both of these are null then we already early exit out of this function, so it's safe to cast
        // to the correct type here.
        const spaceId = maybeSpaceIdForMembershipPlugin ?? maybeSpaceIdForVotingPlugin;

        const mappedProposal: EditorshipProposal = {
          ...proposal,
          type: validIpfsMetadata.type,
          name: `Add Editor: ${parsedMembership.user}`,
          proposalId: parsedMembership.id,
          onchainProposalId: proposal.proposalId,
          pluginAddress: getChecksumAddress(proposal.pluginAddress),
          user: getChecksumAddress(parsedMembership.user),
          creator: getChecksumAddress(proposal.creator),
          space: spaceId as string,
        };

        return mappedProposal;
      }

      case 'ADD_MEMBER':
      case 'REMOVE_MEMBER': {
        const parsedMembership = yield* _(Decoder.decodeMembership(ipfsContent));

        if (!parsedMembership) {
          return null;
        }

        // If both of these are null then we already early exit out of this function, so it's safe to cast
        // to the correct type here.
        const spaceId = maybeSpaceIdForMembershipPlugin ?? maybeSpaceIdForVotingPlugin;

        const mappedProposal: MembershipProposal = {
          ...proposal,
          type: validIpfsMetadata.type,
          name: `Add Member: ${parsedMembership.user}`,
          proposalId: parsedMembership.id,
          onchainProposalId: proposal.proposalId,
          pluginAddress: getChecksumAddress(proposal.pluginAddress),
          user: getChecksumAddress(parsedMembership.user),
          creator: getChecksumAddress(proposal.creator),
          space: spaceId as string,
        };

        return mappedProposal;
      }
      default:
        slog({
          level: 'error',
          message: `Unsupported content type ${validIpfsMetadata.type}`,
          requestId: block.requestId,
        });
        return null;
        // @TODO: Use more explicitly typed error
        throw new Error('Unsupported content type');
    }
  });
}
