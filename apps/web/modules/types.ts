export type OmitStrict<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export type NumberValue = {
  type: 'number';
  id: string;
  value: string;
};

export type StringValue = {
  type: 'string';
  id: string;
  value: string;
};

export type EntityValue = {
  type: 'entity';
  id: string;
};

export type Value = NumberValue | StringValue | EntityValue;

// id -> name
export type EntityNames = Record<string, string | null>;

export type Triple = {
  id: string;
  entityId: string;
  attributeId: string;
  value: Value;
  space: string;
};

export type Space = {
  id: string;
  isRootSpace: boolean;
  editors: string[];
  admins: string[];
  attributes: Record<string, string>;
};

export type Account = {
  id: string;
};

export type ReviewState = 'idle' | 'reviewing' | 'publishing-ipfs' | 'publishing-contract' | 'publish-complete';

export type FilterField = 'entity-id' | 'entity-name' | 'attribute-id' | 'attribute-name' | 'value';

export type FilterClause = {
  field: FilterField;
  value: string;
};

export type FilterState = FilterClause[];
