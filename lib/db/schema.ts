import type { InferSelectModel } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  timestamp,
  json,
  uuid,
  text,
  primaryKey,
  foreignKey,
  boolean,
  uniqueIndex,
  integer,
} from 'drizzle-orm/pg-core';

export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable('Chat', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('createdAt').notNull(),
  title: text('title').notNull(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable('Message', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  content: json('content').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable('Message_v2', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  parts: json('parts').notNull(),
  attachments: json('attachments').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
  'Vote',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

// Integrations: AI configuration stored server-side per user
export const aiIntegration = pgTable(
  'AIIntegration',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    provider: varchar('provider', { length: 64 }).notNull(),
    model: varchar('model', { length: 128 }).notNull(),
    apiKeyEncrypted: text('apiKeyEncrypted').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    lastUsedAt: timestamp('lastUsedAt'),
  },
  (table) => {
    return {
      // One config per (user, provider)
      userProviderUnique: uniqueIndex('AIIntegration_user_provider_unique').on(
        table.userId,
        table.provider,
      ),
    };
  },
);

export type AIIntegration = InferSelectModel<typeof aiIntegration>;

// Integrations: WordPress connection (site URL + JWT) per user
export const wordpressConnection = pgTable(
  'WordPressConnection',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    siteUrl: text('siteUrl').notNull(),
    jwtEncrypted: text('jwtEncrypted').notNull(),
    writeMode: boolean('writeMode').notNull().default(false),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    lastUsedAt: timestamp('lastUsedAt'),
    lastValidatedAt: timestamp('lastValidatedAt'),
    expiresAt: timestamp('expiresAt'),
    status: varchar('status', { enum: ['active', 'invalid', 'revoked'] })
      .notNull()
      .default('active'),
    fingerprint: text('fingerprint'),
  },
  (table) => {
    return {
      // A user can have multiple sites; enforce uniqueness per (user, siteUrl)
      userSiteUnique: uniqueIndex('WordPressConnection_user_site_unique').on(
        table.userId,
        table.siteUrl,
      ),
    };
  },
);

export type WordPressConnection = InferSelectModel<typeof wordpressConnection>;

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  'Vote_v2',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  'Document',
  {
    id: uuid('id').notNull().defaultRandom(),
    createdAt: timestamp('createdAt').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    kind: varchar('text', { enum: ['text', 'code', 'image', 'sheet'] })
      .notNull()
      .default('text'),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  },
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  'Suggestion',
  {
    id: uuid('id').notNull().defaultRandom(),
    documentId: uuid('documentId').notNull(),
    documentCreatedAt: timestamp('documentCreatedAt').notNull(),
    originalText: text('originalText').notNull(),
    suggestedText: text('suggestedText').notNull(),
    description: text('description'),
    isResolved: boolean('isResolved').notNull().default(false),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  }),
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  'Stream',
  {
    id: uuid('id').notNull().defaultRandom(),
    chatId: uuid('chatId').notNull(),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  }),
);

export type Stream = InferSelectModel<typeof stream>;

// Action log for WordPress operations
export const wpActionLog = pgTable('WPActionLog', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  siteUrl: text('siteUrl').notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  requestMeta: json('requestMeta').notNull(),
  responseMeta: json('responseMeta').notNull(),
  status: varchar('status', { enum: ['success', 'error'] })
    .notNull()
    .default('success'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export type WPActionLog = InferSelectModel<typeof wpActionLog>;

// Background tasks (uploads, bulk operations)
export const task = pgTable('Task', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  kind: varchar('kind', { length: 64 }).notNull(),
  params: json('params').notNull(),
  status: varchar('status', {
    enum: ['queued', 'running', 'failed', 'completed'],
  })
    .notNull()
    .default('queued'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('lastError'),
  runAt: timestamp('runAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export type Task = InferSelectModel<typeof task>;

// Subscriptions (Premium entitlements)
export const subscription = pgTable(
  'Subscription',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    stripeCustomerId: text('stripeCustomerId'),
    stripeSubscriptionId: text('stripeSubscriptionId'),
    status: varchar('status', { length: 32 }).notNull().default('inactive'),
    currentPeriodEnd: timestamp('currentPeriodEnd'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => {
    return {
      customerUnique: uniqueIndex('Subscription_customer_unique').on(
        table.stripeCustomerId,
      ),
      subUnique: uniqueIndex('Subscription_subscription_unique').on(
        table.stripeSubscriptionId,
      ),
    };
  },
);

export type Subscription = InferSelectModel<typeof subscription>;

// Multitenancy: Organizations, Members, Sites, Scopes, Tokens, Approvals, Jobs
export const organization = pgTable('Organization', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  name: varchar('name', { length: 128 }).notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export type Organization = InferSelectModel<typeof organization>;

export const organizationMember = pgTable(
  'OrganizationMember',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    orgId: uuid('orgId')
      .notNull()
      .references(() => organization.id),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    // owner | admin | editor | viewer
    role: varchar('role', { length: 24 }).notNull().default('viewer'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => {
    return {
      orgUserUnique: uniqueIndex('OrganizationMember_org_user_unique').on(
        table.orgId,
        table.userId,
      ),
    };
  },
);

export type OrganizationMember = InferSelectModel<typeof organizationMember>;

export const site = pgTable(
  'Site',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    orgId: uuid('orgId')
      .notNull()
      .references(() => organization.id),
    name: varchar('name', { length: 128 }).notNull(),
    baseUrl: text('baseUrl').notNull(),
    status: varchar('status', { enum: ['active', 'inactive', 'pending'] })
      .notNull()
      .default('active'),
    plan: varchar('plan', { length: 32 }).notNull().default('free'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => {
    return {
      orgUrlUnique: uniqueIndex('Site_org_url_unique').on(
        table.orgId,
        table.baseUrl,
      ),
    };
  },
);

export type Site = InferSelectModel<typeof site>;

export const siteScope = pgTable(
  'SiteScope',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    siteId: uuid('siteId')
      .notNull()
      .references(() => site.id),
    scope: varchar('scope', { length: 64 }).notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => {
    return {
      siteScopeUnique: uniqueIndex('SiteScope_site_scope_unique').on(
        table.siteId,
        table.scope,
      ),
    };
  },
);

export type SiteScope = InferSelectModel<typeof siteScope>;

export const siteToken = pgTable(
  'SiteToken',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    siteId: uuid('siteId')
      .notNull()
      .references(() => site.id),
    kid: varchar('kid', { length: 64 }).notNull(),
    publicKey: text('publicKey').notNull(),
    expiresAt: timestamp('expiresAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => {
    return {
      siteKidUnique: uniqueIndex('SiteToken_site_kid_unique').on(
        table.siteId,
        table.kid,
      ),
    };
  },
);

export type SiteToken = InferSelectModel<typeof siteToken>;

export const approval = pgTable(
  'Approval',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    siteId: uuid('siteId')
      .notNull()
      .references(() => site.id),
    type: varchar('type', { length: 64 }).notNull(),
    payloadHash: varchar('payloadHash', { length: 128 }).notNull(),
    status: varchar('status', { enum: ['pending', 'approved', 'rejected'] })
      .notNull()
      .default('pending'),
    approvedBy: uuid('approvedBy').references(() => user.id),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => {
    return {
      sitePayloadUnique: uniqueIndex('Approval_site_payload_unique').on(
        table.siteId,
        table.payloadHash,
      ),
    };
  },
);

export type Approval = InferSelectModel<typeof approval>;

export const job = pgTable(
  'Job',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    siteId: uuid('siteId')
      .notNull()
      .references(() => site.id),
    type: varchar('type', { length: 64 }).notNull(),
    status: varchar('status', {
      enum: ['queued', 'running', 'failed', 'completed'],
    })
      .notNull()
      .default('queued'),
    progress: integer('progress').notNull().default(0),
    meta: json('meta').notNull().default({}),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => {
    return {
      siteTypeIdx: uniqueIndex('Job_site_type_id_unique').on(table.id),
    };
  },
);

export type Job = InferSelectModel<typeof job>;

// Global Admin AI configuration (provider + model). API keys remain in env vars.
export const globalAIConfig = pgTable('GlobalAIConfig', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  provider: varchar('provider', { length: 64 }).notNull(),
  // Legacy single-model field (kept for backward compatibility/migrations)
  model: varchar('model', { length: 128 }).notNull(),
  // Admin-configured models
  chatModel: varchar('chatModel', { length: 128 }),
  reasoningModel: varchar('reasoningModel', { length: 128 }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export type GlobalAIConfig = InferSelectModel<typeof globalAIConfig>;
