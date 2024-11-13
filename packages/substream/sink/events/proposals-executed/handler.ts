import { Effect, Either } from 'effect';

import type { ProposalExecuted } from './parser';
import { Proposals } from '~/sink/db';
import { Telemetry } from '~/sink/telemetry';
import { getChecksumAddress } from '~/sink/utils/get-checksum-address';

class CouldNotWriteExecutedProposalError extends Error {
  _tag: 'CouldNotWriteExecutedProposalError' = 'CouldNotWriteExecutedProposalError';
}

export function handleProposalsExecuted(proposalsExecuted: ProposalExecuted[]) {
  return Effect.gen(function* (_) {
    const telemetry = yield* _(Telemetry);
    yield* _(Effect.logInfo('Handling proposals executed'));
    yield* _(Effect.logDebug(`Updating proposal statuses for ${proposalsExecuted.length} proposals`));

    // @TODO: Batch update proposals in one insert instead of iteratively
    const writtenExecutedProposals = yield* _(
      Effect.all(
        proposalsExecuted.map(proposal => {
          return Effect.tryPromise({
            try: async () => {
              // There might be executed proposals coming from both the member access plugin
              // and the voting plugin, so we need to handle both cases. Each plugin contract keeps
              // of its own onchain ids, so there might be clashes between onchain ids for proposals
              // created in different plugins.
              //
              // A proposal stores the plugin address that created the proposal so we can disambiguate
              // when we update the proposals here.
              const [isContentProposal, isAddSubspaceProposal, isAddEditorProposal] = await Promise.all([
                Proposals.getOne({
                  onchainProposalId: proposal.proposalId,
                  pluginAddress: getChecksumAddress(proposal.pluginAddress),
                  type: 'ADD_EDIT',
                }),
                Proposals.getOne({
                  onchainProposalId: proposal.proposalId,
                  pluginAddress: getChecksumAddress(proposal.pluginAddress),
                  type: 'ADD_SUBSPACE',
                }),
                Proposals.getOne({
                  onchainProposalId: proposal.proposalId,
                  pluginAddress: getChecksumAddress(proposal.pluginAddress),
                  type: 'ADD_EDITOR',
                }),
              ]);

              if (isContentProposal) {
                return await Proposals.setAccepted({
                  onchainProposalId: proposal.proposalId,
                  pluginAddress: getChecksumAddress(proposal.pluginAddress),
                  type: 'ADD_EDIT',
                });
              }

              if (isAddSubspaceProposal) {
                return await Proposals.setAccepted({
                  onchainProposalId: proposal.proposalId,
                  pluginAddress: getChecksumAddress(proposal.pluginAddress),
                  type: 'ADD_SUBSPACE',
                });
              }

              if (isAddEditorProposal) {
                return await Proposals.setAccepted({
                  onchainProposalId: proposal.proposalId,
                  pluginAddress: getChecksumAddress(proposal.pluginAddress),
                  type: 'ADD_EDITOR',
                });
              }

              const isAddMemberProposal = await Proposals.getOne({
                onchainProposalId: proposal.proposalId,
                pluginAddress: getChecksumAddress(proposal.pluginAddress),
                type: 'ADD_MEMBER',
              });

              if (isAddMemberProposal) {
                return await Proposals.setAccepted({
                  onchainProposalId: proposal.proposalId,
                  pluginAddress: getChecksumAddress(proposal.pluginAddress),
                  type: 'ADD_MEMBER',
                });
              }
            },
            catch: error => {
              return new CouldNotWriteExecutedProposalError(String(error));
            },
          });
        }),
        {
          mode: 'either',
        }
      )
    );

    // @TODO: Batch update proposals in one insert instead of iteratively
    for (const writtenExecutedProposal of writtenExecutedProposals) {
      if (Either.isLeft(writtenExecutedProposal)) {
        const error = writtenExecutedProposal.left;
        telemetry.captureException(error);
        yield* _(
          Effect.logError(`Could not write executed proposal
          Cause: ${error.cause}
          Message: ${error.message}
        `)
        );

        continue;
      }
    }
  });
}
