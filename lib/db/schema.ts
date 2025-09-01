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
  status: varchar('status', { enum: ['queued', 'running', 'failed', 'completed'] })
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
