export type OmitStrict<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export type TripleOp = 'SET_TRIPLE' | 'DELETE_TRIPLE';

export interface BlockEvent {
  cursor: string;
  blockNumber: number;
  timestamp: number;
}

export interface GeoBlock extends BlockEvent {
  hash: string;
  network: string;
}

export type ValueType = 'TEXT' | 'NUMBER' | 'ENTITY' | 'COLLECTION' | 'CHECKBOX' | 'URI' | 'TIME' | 'GEO_LOCATION';

// We hardcode our Op type instead of deriving it from the Zod types.
// This is due to zod having issues generating disciminate types from
// discriminate unions. See `ZodEditDeleteTriplePayload` and `ZodEditDeleteTriplePayload`
// above.
//
// For now we cast the value depending on the op type during decoding and
// trust that it is constructed into the correct ormat once it's decoded.
export type Op =
  | {
      type: 'SET_TRIPLE';
      triple: {
        entity: string;
        attribute: string;
        value: {
          type: ValueType;
          value: string;
        };
      };
    }
  | {
      type: 'DELETE_TRIPLE';
      triple: {
        entity: string;
        attribute: string;
        value: Record<string, never>;
      };
    };

export type Edit = {
  name: string;
  version: string;
  ops: Op[];
  authors: string[];
  proposalId: string;
};
