import { Effect, Either } from 'effect';
import { v4 as uuid } from 'uuid';

import { graphql } from './graphql';

export interface FetchOnchainProfileOptions {
  endpoint: string;
  address: string;
  signal?: AbortController['signal'];
}

interface OnchainGeoProfile {
  id: string;
  homeSpace: string;
  account: string;
}

interface NetworkResult {
  geoProfiles: OnchainGeoProfile[];
}

// We fetch for geoEntities -> name because the id of the wallet entity might not be the
// same as the actual wallet address.
function getFetchProfileQuery(address: string) {
  // Have to fetch the profiles as an array as we can't query an individual profile by it's account.
  return `query {
    geoProfiles(where: {account: "${address}"} first: 1) {
      id
      homeSpace
      account
    }
  }`;
}

export async function fetchOnchainProfile(options: FetchOnchainProfileOptions): Promise<OnchainGeoProfile | null> {
  const queryId = uuid();

  const fetchWalletsGraphqlEffect = graphql<NetworkResult>({
    endpoint: options.endpoint,
    query: getFetchProfileQuery(options.address),
    signal: options?.signal,
  });

  const graphqlFetchWithErrorFallbacks = Effect.gen(function* (awaited) {
    const resultOrError = yield* awaited(Effect.either(fetchWalletsGraphqlEffect));

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
            `Encountered runtime graphql error in fetchProfile. queryId: ${queryId} endpoint: ${
              options.endpoint
            } address: ${options.address}
            
            queryString: ${getFetchProfileQuery(options.address)}
            `,
            error.message
          );

          return {
            geoProfiles: [],
          };
        default:
          console.error(
            `${error._tag}: Unable to fetch wallets to derive profile, queryId: ${queryId} endpoint: ${options.endpoint} address: ${options.address}`
          );

          return {
            geoProfiles: [],
          };
      }
    }

    return resultOrError.right;
  });

  const result = await Effect.runPromise(graphqlFetchWithErrorFallbacks);

  if (result.geoProfiles.length === 0) {
    return null;
  }

  return result.geoProfiles[0];
}
