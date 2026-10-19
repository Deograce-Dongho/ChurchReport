import { Query } from 'appwrite'
import { tablesDB, DATABASE_ID, SERVICES_TABLE_ID } from './appwrite'

const PAGE_SIZE = 100

// All saved services, newest first.
export async function listServices() {
  const services = []
  let cursor = null

  while (true) {
    const queries = [Query.orderDesc('service_date'), Query.limit(PAGE_SIZE)]
    if (cursor) queries.push(Query.cursorAfter(cursor))

    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: SERVICES_TABLE_ID,
      queries,
    })

    services.push(...response.rows)

    if (response.rows.length < PAGE_SIZE) break
    cursor = response.rows[response.rows.length - 1].$id
  }

  return services
}