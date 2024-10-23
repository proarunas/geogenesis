import { Effect } from 'effect';
import { dedupeWith } from 'effect/ReadonlyArray';
import type * as Schema from 'zapatos/schema';

import { CurrentVersions, Triples, Versions } from '../db';
import type { Op } from '../types';
import type { SchemaTripleEdit } from '../write-edits/map-triples';

interface MergeOpsWithPreviousVersionArgs {
  versions: Schema.versions.Insertable[];
  opsByVersionId: Map<string, Op[]>;
  edits: Schema.edits.Insertable[];
}

export function mergeOpsWithPreviousVersions(args: MergeOpsWithPreviousVersionArgs) {
  const spaceIdByEditId = new Map<string, string>();
  const { versions, opsByVersionId } = args;

  for (const edit of args.edits) {
    spaceIdByEditId.set(edit.id.toString(), edit.space_id.toString());
  }

  return Effect.gen(function* (_) {
    const newOpsByVersionId = new Map<string, Op[]>();

    const maybeLatestVersionForEntityIds = yield* _(
      Effect.all(
        versions.map(v =>
          Effect.retry(
            Effect.promise(async () => {
              const latestVersion = await CurrentVersions.selectOne({ entity_id: v.entity_id.toString() });
              if (!latestVersion) return null;
              return [v.entity_id.toString(), latestVersion.version_id.toString()] as const;
            }),
            {
              times: 5,
              concurrency: 100,
            }
          )
        )
      )
    );

    // entity id -> version id
    const lastVersionForEntityId = Object.fromEntries(maybeLatestVersionForEntityIds.filter(v => v !== null));
    const triplesForLastVersionTuples = yield* _(
      Effect.all(
        Object.keys(lastVersionForEntityId).map(versionId =>
          Effect.promise(async () => {
            const lastVersionTriples = await Triples.select({ version_id: versionId });
            return [versionId, lastVersionTriples] as const;
          })
        )
      )
    );

    const triplesForLastVersion = Object.fromEntries(triplesForLastVersionTuples);

    for (const version of versions) {
      const editWithCreatedById: SchemaTripleEdit = {
        versonId: version.id.toString(),
        createdById: version.created_by_id.toString(),
        spaceId: spaceIdByEditId.get(version.edit_id.toString())!,
        ops: opsByVersionId.get(version.id.toString()) ?? [],
      };

      const lastVersionId = lastVersionForEntityId[version.entity_id.toString()];

      if (lastVersionId) {
        const lastVersionTriples = triplesForLastVersion[lastVersionId] ?? [];

        // Make sure that we put the last version's ops before the new version's
        // ops so that when we squash the ops later they're ordered correctly.
        newOpsByVersionId.set(version.id.toString(), [
          ...lastVersionTriples.map((t): Op => {
            return {
              type: 'SET_TRIPLE',
              triple: {
                entity: t.entity_id,
                attribute: t.attribute_id,
                value: {
                  type: t.value_type,
                  value: (t.value_type === 'ENTITY' ? t.entity_value_id : t.text_value) as string,
                },
              },
            };
          }),
          ...(editWithCreatedById.ops ?? []),
        ]);
      } else {
        newOpsByVersionId.set(version.id.toString(), editWithCreatedById.ops ?? []);
      }
    }

    return newOpsByVersionId;
  });
}
