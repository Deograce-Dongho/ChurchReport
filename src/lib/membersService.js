
import { ID, Query } from 'appwrite'
import {
  tablesDB,
  DATABASE_ID,
  MEMBERS_TABLE_ID,
} from './appwrite'

export async function getMembers() {
  const response = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: MEMBERS_TABLE_ID,
    queries: [Query.orderAsc('$createdAt')],
  })

  return response.rows
}


export async function createMember({
  name = '',
  email = '',
  phone = '',
  person_type = 'member',
}) {
  return tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: MEMBERS_TABLE_ID,
    rowId: ID.unique(),
    data: {
      name: String(name ?? '').trim(),
      email: String(email ?? '').trim() || null,
      phone: String(phone ?? '').trim() || null,
      person_type: person_type || 'member',
      status: 'active',
    },
  })
}

export async function deleteMember(rowId) {
  return tablesDB.deleteRow({
    databaseId: DATABASE_ID,
    tableId: MEMBERS_TABLE_ID,
    rowId,
  })
}

export async function updateMember(rowId, data) {
  return tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: MEMBERS_TABLE_ID,
    rowId,
    data,
  })
}
