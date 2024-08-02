import { Schema } from '@effect/schema';
import { Effect, Either } from 'effect';
import { cookies } from 'next/headers';
import Link from 'next/link';

import React from 'react';

import { WALLET_ADDRESS } from '~/core/cookie';
import { Environment } from '~/core/environment';
import { Space } from '~/core/io/dto/spaces';
import {
  type SubstreamVote as ISubstreamVote,
  ProposalStatus,
  ProposalType,
  SubstreamProposal,
  SubstreamVote,
} from '~/core/io/schema';
import { fetchProfile } from '~/core/io/subgraph';
import { fetchProfilesByAddresses } from '~/core/io/subgraph/fetch-profiles-by-ids';
import { graphql } from '~/core/io/subgraph/graphql';
import { OmitStrict, Profile, Vote } from '~/core/types';

import { Avatar } from '~/design-system/avatar';

import { GovernanceProposalVoteState } from './governance-proposal-vote-state';
import { GovernanceStatusChip } from './governance-status-chip';

interface Props {
  spaceId: string;
  page: number;
}

export async function GovernanceProposalsList({ spaceId, page }: Props) {
  const connectedAddress = cookies().get(WALLET_ADDRESS)?.value;
  const [proposals, profile] = await Promise.all([
    fetchActiveProposals({ spaceId, first: 5, page, connectedAddress }),
    connectedAddress ? fetchProfile({ address: connectedAddress }) : null,
  ]);

  const userVotesByProposalId = proposals.reduce((acc, p) => {
    if (p.userVotes.length === 0) return acc;

    return acc.set(p.id, p.userVotes[0].vote);
  }, new Map<string, Vote['vote']>());

  return (
    <div className="flex flex-col divide-y divide-grey-01">
      {proposals.map(p => {
        return (
          <Link
            key={p.id}
            href={`/space/${spaceId}/governance?proposalId=${p.id}`}
            className="flex w-full flex-col gap-4 py-6"
          >
            <div className="flex flex-col gap-2">
              <h3 className="text-smallTitle">{p.name}</h3>
              <div className="flex items-center gap-2 text-breadcrumb text-grey-04">
                <div className="relative h-3 w-3 overflow-hidden rounded-full">
                  <Avatar avatarUrl={p.createdBy.avatarUrl} value={p.createdBy.address} />
                </div>
                <p>{p.createdBy.name ?? p.createdBy.id}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="inline-flex flex-[3] items-center gap-8">
                <GovernanceProposalVoteState
                  votes={{
                    totalCount: p.proposalVotes.totalCount,
                    votes: p.proposalVotes.votes,
                  }}
                  userVote={userVotesByProposalId.get(p.id)}
                  user={
                    profile || connectedAddress
                      ? {
                          address: connectedAddress,
                          avatarUrl: profile?.avatarUrl ?? null,
                        }
                      : undefined
                  }
                />
              </div>

              <GovernanceStatusChip
                endTime={p.endTime}
                status={p.status}
                yesVotesCount={p.proposalVotes.totalCount}
                noVotesCount={p.proposalVotes.totalCount}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export interface FetchActiveProposalsOptions {
  spaceId: string;
  page?: number;
  first?: number;
}

const SubstreamActiveProposal = Schema.extend(
  SubstreamProposal.omit('space'),
  Schema.Struct({ userVotes: Schema.Struct({ nodes: Schema.Array(SubstreamVote) }) })
);

type SubstreamActiveProposal = Schema.Schema.Type<typeof SubstreamActiveProposal>;

interface NetworkResult {
  proposals: {
    nodes: SubstreamActiveProposal[];
  };
}

type ActiveProposal = {
  id: string;
  name: string | null;
  type: ProposalType;
  onchainProposalId: string;
  createdBy: Profile;
  createdAt: number;
  createdAtBlock: string;
  startTime: number;
  endTime: number;
  status: ProposalStatus;
  proposalVotes: {
    totalCount: number;
    votes: ISubstreamVote[];
  };
  userVotes: ISubstreamVote[];
};

function ActiveProposalsDto(activeProposal: SubstreamActiveProposal, maybeProfile?: Profile): ActiveProposal {
  const profile = maybeProfile ?? {
    id: activeProposal.createdBy.id,
    name: null,
    avatarUrl: null,
    coverUrl: null,
    address: activeProposal.createdBy.id as `0x${string}`,
    profileLink: null,
  };

  return {
    ...activeProposal,
    createdBy: profile,
    userVotes: activeProposal.userVotes.nodes.map(v => v), // remove readonly
    proposalVotes: {
      totalCount: activeProposal.proposalVotes.totalCount,
      votes: activeProposal.proposalVotes.nodes.map(v => v), // remove readonly
    },
  };
}

const getFetchSpaceProposalsQuery = (
  spaceId: string,
  first: number,
  skip: number,
  connectedAddress: string | undefined
) => `query {
  proposals(
    first: ${first}
    offset: ${skip}
    orderBy: CREATED_AT_DESC
    filter: {
      spaceId: { equalTo: "${spaceId}" }
      or: [
        { type: { equalTo: ADD_EDIT } }
        { type: { equalTo: ADD_SUBSPACE } }
        { type: { equalTo: REMOVE_SUBSPACE } }
      ]
    }
  ) {
    nodes {
      id
      name
      type
      onchainProposalId

      createdAtBlock

      createdBy {
        id
      }

      createdAt
      startTime
      endTime
      status

      proposalVotes {
        totalCount
        nodes {
          vote
          accountId
        }
      }

      userVotes: proposalVotes(
        filter: {
          accountId: { equalTo: "${connectedAddress ?? ''}" }
        }
      ) {
        nodes {
          vote
          accountId
        }
      }
    }
  }
}`;

async function fetchActiveProposals({
  spaceId,
  connectedAddress,
  first = 5,
  page = 0,
}: {
  spaceId: string;
  first: number;
  page: number;
  connectedAddress: string | undefined;
}) {
  const offset = page * first;

  const graphqlFetchEffect = graphql<NetworkResult>({
    endpoint: Environment.getConfig().api,
    query: getFetchSpaceProposalsQuery(spaceId, first, offset, connectedAddress),
  });

  const graphqlFetchWithErrorFallbacks = Effect.gen(function* (awaited) {
    const resultOrError = yield* awaited(Effect.either(graphqlFetchEffect));

    if (Either.isLeft(resultOrError)) {
      const error = resultOrError.left;

      switch (error._tag) {
        case 'AbortError':
          // Right now we re-throw AbortErrors and let the callers handle it. Eventually we want
          // the caller to consume the error channel as an effect. We throw here the typical JS
          // way so we don't infect more of the codebase with the effect runtime.
          throw error;
        case 'GraphqlRuntimeError':
          console.error(
            `Encountered runtime graphql error in governance proposals list. spaceId: ${spaceId} page: ${page}
            
            queryString: ${getFetchSpaceProposalsQuery(spaceId, first, offset, connectedAddress)}
            `,
            error.message
          );
          return {
            proposals: {
              nodes: [],
            },
          };
        default:
          console.error(`${error._tag}: Unable to fetch proposals, spaceId: ${spaceId} page: ${page}`);
          return {
            proposals: {
              nodes: [],
            },
          };
      }
    }

    return resultOrError.right;
  });

  const result = await Effect.runPromise(graphqlFetchWithErrorFallbacks);
  const proposals = result.proposals.nodes;
  const profilesForProposals = await fetchProfilesByAddresses(proposals.map(p => p.createdBy.id));

  return proposals.map(p => {
    const maybeProfile = profilesForProposals.find(profile => profile.address === p.createdBy.id);

    return ActiveProposalsDto(p, maybeProfile);
  });
}
