import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const records=sqliteTable('records',{id:text('id').primaryKey(),kind:text('kind').notNull(),data:text('data').notNull(),version:integer('version').notNull().default(1),actor:text('actor').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()},t=>[index('idx_records_kind').on(t.kind)]);
