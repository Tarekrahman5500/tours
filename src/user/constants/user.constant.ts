export const statusEnum = {
  AGENT: 'agent',
  STAFF: 'staff',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super-admin',
} as const;

export type StatusEnum = (typeof statusEnum)[keyof typeof statusEnum];

// Create a tuple type from statusEnum values
export const statusEnumValues = Object.values(statusEnum) as [
  StatusEnum,
  ...StatusEnum[],
];
