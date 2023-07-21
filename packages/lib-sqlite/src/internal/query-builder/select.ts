import type { Database, Statement } from "better-sqlite3"
import { Simplify } from "type-fest"

import type {
  InferRowReadType,
  InferRowSqliteType,
  TableDescription,
} from "../../types/table"
import { createPlaceholderStore } from "./placeholders"
import { RowDeserializer } from "./serialize"
import { type Condition, generateWhereClause } from "./where"

export interface SelectQueryBuilder<TState extends SelectQueryBuilderState> {
  /**
   * Add a WHERE clause to the query.
   *
   * @remarks This method can be called multiple times in which case the conditions will be combined with AND.
   */
  where: (condition: Condition<TState["table"]>) => SelectQueryBuilder<TState>

  /**
   * Add a LIMIT clause to the query.
   *
   * If no offset is given, the offset is set to 0.
   */
  limit: (
    limit: number,
    offset?: number | undefined
  ) => SelectQueryBuilder<TState>

  /**
   * Generate the SQL for this query.
   */
  sql(): string

  /**
   * Generate the prepared SQLite Statement object for this query.
   */
  prepare(): Statement<[Record<string, unknown>]>

  /**
   * Execute the query and return all result rows.
   */
  all(): Simplify<InferRowReadType<TState["table"]>>[]

  /**
   * Execute the query and return the first result row.
   */
  first(): Simplify<InferRowReadType<TState["table"]>> | undefined

  /**
   * Delete selected rows.
   */
  delete(): void
}

export interface SelectQueryBuilderState {
  columns: TableDescription["columns"]
  table: TableDescription
}

export type NewSelectQueryBuilder<TTable extends TableDescription> =
  SelectQueryBuilder<{
    columns: TTable["columns"]
    table: TTable
  }>

export const createSelectQueryBuilder = <TTable extends TableDescription>(
  tableDescription: TTable,
  deserializeRow: RowDeserializer<TTable>,
  database: Database
): NewSelectQueryBuilder<TTable> => {
  const placeholders = createPlaceholderStore()
  const whereClauses: string[] = []
  const columns = "*"
  let limit: number | undefined
  let offset = 0

  let cachedStatement: Statement<unknown[]> | undefined

  const getWhereClause = () =>
    whereClauses.length > 0
      ? `${whereClauses.map((clause) => `(${clause})`).join(" AND ")}`
      : // Always including the WHERE clause prevents ambiguity when using ON CONFLICT.
        // See: https://www.sqlite.org/lang_upsert.html#parsing_ambiguity (2.2 Parsing Ambiguity)
        "true"

  const builder: NewSelectQueryBuilder<TTable> = {
    where(condition) {
      cachedStatement = undefined

      whereClauses.push(generateWhereClause(condition, placeholders))
      return builder
    },

    limit(newLimit: number, newOffset = 0) {
      cachedStatement = undefined

      limit = newLimit
      offset = newOffset
      return builder
    },

    sql() {
      const whereClause = getWhereClause()
      const limitClause = limit ? ` LIMIT ${limit} OFFSET ${offset}` : ""
      return `SELECT ${columns} FROM ${tableDescription.name} WHERE ${whereClause}${limitClause}`
    },

    prepare() {
      if (cachedStatement) return cachedStatement

      return (cachedStatement = database.prepare(builder.sql()))
    },

    all() {
      const query = builder.prepare()
      return (
        (query.all(placeholders.get()) as InferRowSqliteType<TTable>[])
          // eslint-disable-next-line unicorn/no-array-callback-reference
          .map(deserializeRow)
      )
    },

    first() {
      const query = builder.prepare()
      const result = query.get(placeholders.get()) as
        | InferRowSqliteType<TTable>
        | undefined

      return result === undefined ? undefined : deserializeRow(result)
    },

    delete() {
      const sql = `DELETE FROM ${
        tableDescription.name
      } WHERE ${getWhereClause()}`
      const query = database.prepare(sql)
      query.run(placeholders.get())
    },
  }

  return builder
}
