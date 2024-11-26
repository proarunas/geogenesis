import { SYSTEM_IDS } from '@geogenesis/sdk';

import { mergeEntityAsync } from '../database/entities';
import { useWriteOps } from '../database/write';
import { EntityId } from '../io/schema';
import { Source } from '../state/editor/types';
import { FilterableValueType } from '../value-types';

export function upsertName({
  newName,
  entityId,
  spaceId,
  api,
}: {
  newName: string;
  entityId: string;
  spaceId: string;
  api: {
    upsert: ReturnType<typeof useWriteOps>['upsert'];
  };
}) {
  return api.upsert(
    {
      attributeId: SYSTEM_IDS.NAME,
      entityId: entityId,
      entityName: newName,
      attributeName: 'Name',
      value: { type: 'TEXT', value: newName },
    },
    spaceId
  );
}

/**
 * Takes the table filters and converts them to the GraphQL string used to
 * query the table using the filters. We include the typeId from the table
 * in the graphql string to make sure we're filtering by the correct type.
 *
 * We treat Name and Space as special filters.
 *
 * e.g. these filters
 * ```ts
 * const filters = [{
 *   columnId: 'type',
 *   value: 'd73a9e43-923e-4102-87da-5d3176ac9df2', // entity ID for 'Blockchain'
 *   valueType: 'entity',
 *  },
 *  {
 *   columnId: 'type',
 *   value: '48a331d1-a6d6-49ca-bc23-78f3378eb959', // entity ID for 'Layer 1'
 *   valueType: 'entity',
 * }]
 * ```
 *
 * would output to
 * ```ts
 * `{
 *    and: [
 *      {entityOf_: {attribute: "type", entityValue: "d73a9e43-923e-4102-87da-5d3176ac9df2"}},
 *      {entityOf_: {attribute: "type", entityValue: "48a331d1-a6d6-49ca-bc23-78f3378eb959"}},
 *      name: "Bitcoin"
 *    ]
 * }`
 * ```
 */
export function createGraphQLStringFromFilters(
  filters: {
    columnId: string;
    valueType: FilterableValueType;
    value: string;
  }[]
): string {
  const filtersAsStrings = filters
    .map(filter => {
      if (filter.columnId === SYSTEM_IDS.TYPES && filter.valueType === 'RELATION') {
        return `typeIds_contains_nocase: ["${filter.value}"]`;
      }

      // We treat Name and Space as special filters even though they are not always
      // columns on the type schema for a table. We allow users to be able to filter
      // by name and space.
      if (filter.columnId === SYSTEM_IDS.NAME && filter.valueType === 'TEXT') {
        // For the name we can just search for the name based on the indexed GeoEntity name
        return `name_starts_with_nocase: "${filter.value}"`;
      }

      if (filter.columnId === SYSTEM_IDS.SPACE_FILTER && filter.valueType === 'TEXT') {
        return `entityOf_: { space: "${filter.value}" }`;
      }

      if (filter.valueType === 'TEXT') {
        // value is just the stringValue of the triple
        return `entityOf_: {attribute: "${filter.columnId}", stringValue_starts_with_nocase: "${filter.value}"}`;
      }

      // We don't support other value types yet
      return null;
    })
    .flatMap(f => (f ? [f] : []));

  if (filtersAsStrings.length === 1) {
    return `{ ${filtersAsStrings[0]} }`;
  }

  // Wrap each filter expression in curly brackets
  const multiFilterQuery = filtersAsStrings.map(f => `{${f}}`).join(', ');

  return `{ and: [${multiFilterQuery}] }`;
}

/**
 * Takes the graphQL string representing the TableBlock filters and maps them to the
 * application/UI representation of the filters.
 *
 * Turns this:
 * ```ts
 * {
 *    and: [
 *     {
 *       typeIds_contains_nocase: ["type-id"]
 *     },
 *     {
 *       entityOf_: {attribute: "type", stringValue_starts_with_nocase: "Value 1"}
 *     },
 *     {
 *       entityOf_: {attribute: "type", entityValue: "id 1"}
 *     },
 *     {
 *       name_starts_with_nocase: "id 1"
 *     }
 *   ]
 * }
 * ```
 *
 * into this:
 *```ts
 * [
 *  {
 *     columnId: 'type',
 *     columnName: 'Type',
 *     valueType: 'string',
 *     value: 'Value 1'
 *   },
 *   {
 *     columnId: 'type',
 *     columnName: 'Type',
 *     valueType: 'entity',
 *     value: 'id 1'
 *   },
 *   {
 *     columnId: 'name',
 *     columnName: 'Name',
 *     valueType: 'string',
 *     value: 'id 1'
 *   }
 * ]
 * ```
 */
export async function createFiltersFromGraphQLStringAndSource(
  graphQLString: string | null,
  source: Source
): Promise<
  {
    columnId: string;
    valueType: FilterableValueType;
    value: string;
    valueName: string | null;
  }[]
> {
  const filters: {
    columnId: string;
    valueType: FilterableValueType;
    value: string;
    valueName: string | null;
  }[] = [];

  if (graphQLString) {
    const typeRegex = /typeIds_contains_nocase:\s*\[(.*?)\]/;
    const typeMatch = graphQLString.match(typeRegex);
    const typeValue = typeMatch ? typeMatch[1] : null;

    if (typeValue) {
      // @TODO: fix json parsing requirements. Why do we need this?
      const parsedTypeValue = JSON.parse(typeValue);
      const maybeType = await mergeEntityAsync(EntityId(parsedTypeValue));

      if (maybeType) {
        filters.push({
          columnId: SYSTEM_IDS.TYPES,
          valueType: 'RELATION',
          value: parsedTypeValue,
          valueName: maybeType.name,
        });
      }
    }

    // Parse a name query from the filter
    const nameRegex = /name_starts_with_nocase\s*:\s*"([^"]*)"/;
    const nameMatch = graphQLString.match(nameRegex);
    const nameValue = nameMatch ? nameMatch[1] : null;

    if (nameValue) {
      filters.push({
        columnId: SYSTEM_IDS.NAME,
        valueType: 'TEXT',
        value: nameValue,
        valueName: null,
      });
    }

    // Parse all entity relationship queries from the filter
    const entityValueRegex = /entityOf_\s*:\s*{\s*attribute\s*:\s*"([^"]*)"\s*,\s*entityValue\s*:\s*"([^"]*)"\s*}/g;

    for (const match of graphQLString.matchAll(entityValueRegex)) {
      const attribute = match[1];
      const entityValue = match[2];

      if (attribute && entityValue) {
        console.log('value', entityValue);
        const maybeEntity = await mergeEntityAsync(EntityId(entityValue));

        if (maybeEntity) {
          filters.push({
            columnId: attribute,
            valueType: 'RELATION',
            value: entityValue,
            valueName: maybeEntity.name,
          });
        }
      }
    }

    // Parse all string queries from the filter
    const stringValueRegex =
      /entityOf_\s*:\s*{\s*attribute\s*:\s*"([^"]*)"\s*,\s*stringValue_starts_with_nocase\s*:\s*"([^"]*)"\s*}/g;

    for (const match of graphQLString.matchAll(stringValueRegex)) {
      const attribute = match[1];
      const stringValue = match[2];

      if (attribute && stringValue) {
        filters.push({
          columnId: attribute,
          valueType: 'TEXT',
          value: stringValue,
          valueName: null,
        });
      }
    }
  }

  if (source.type === 'SPACES') {
    for (const spaceId of source.value) {
      filters.push({
        columnId: SYSTEM_IDS.SPACE_FILTER,
        valueType: 'TEXT',
        value: spaceId,
        valueName: null,
      });
    }
  }

  return filters;
}

export function createGraphQLStringFromFiltersV2(
  filters: {
    columnId: string;
    valueType: FilterableValueType;
    value: string;
  }[]
): string {
  if (filters.length === 0) return '';

  const filtersAsStrings = filters
    .map(filter => {
      // Assume we can only filter by one type at a time for now
      if (filter.columnId === SYSTEM_IDS.TYPES && filter.valueType === 'RELATION') {
        return `versionTypes: { some: { type: { entityId: {equalTo: "${filter.value}" } } } }`;
      }

      // We treat Name and Space as special filters even though they are not always
      // columns on the type schema for a table. We allow users to be able to filter
      // by name and space.
      if (filter.columnId === SYSTEM_IDS.NAME && filter.valueType === 'TEXT') {
        // For the name we can just search for the name based on the indexed GeoEntity name
        return `name: { startsWithInsensitive: "${filter.value}" }`;
      }

      if (filter.columnId === SYSTEM_IDS.SPACE_FILTER && filter.valueType === 'TEXT') {
        return `versionSpaces: {
          some: {
            spaceId: { equalTo: "${filter.value}" }
          }
        }`;
      }

      if (filter.valueType === 'TEXT') {
        // value is just the stringValue of the triple
        return `triples: { some: { attributeId: { equalTo: "${filter.columnId}" }, stringValue: { equalToInsensitive: "${filter.value}"} } }`;
      }

      // We don't support other value types yet
      return null;
    })
    .flatMap(f => (f ? [f] : []));

  if (filtersAsStrings.length === 1) {
    return `${filtersAsStrings[0]}`;
  }

  // Wrap each filter expression in curly brackets
  const multiFilterQuery = filtersAsStrings.map(f => `{ ${f} }`).join(', ');

  return `and: [${multiFilterQuery}]`;
}
