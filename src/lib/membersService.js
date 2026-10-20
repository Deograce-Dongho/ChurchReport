import { ID, Query } from 'appwrite'

import {
  tablesDB,
  DATABASE_ID,
  MEMBERS_TABLE_ID,
} from './appwrite'

// Check whether an email address has a valid format
function validateEmail(email) {
  if (!email) return

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailPattern.test(email)) {
    throw new Error('Please enter a valid email address.')
  }
}

// Load all members, including older records
export async function getMembers() {
  const PAGE_SIZE = 100
  const allMembers = []
  let cursor = null

  while (true) {
    const queries = [
      Query.orderAsc('$createdAt'),
      Query.limit(PAGE_SIZE),
    ]

    if (cursor) {
      queries.push(Query.cursorAfter(cursor))
    }

    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: MEMBERS_TABLE_ID,
      queries,
    })

    allMembers.push(...response.rows)

    if (response.rows.length < PAGE_SIZE) {
      break
    }

    cursor = response.rows[response.rows.length - 1].$id
  }

  return allMembers
}

// Create a member or visitor
export async function createMember({
  name = '',
  email = '',
  phone = '',
  person_type = 'member',
}) {
  const cleanName = String(name ?? '').trim()
  const cleanEmail = String(email ?? '').trim()
  const cleanPhone = String(phone ?? '').trim()

  if (!cleanName) {
    throw new Error('Please enter a name.')
  }

  // Validate the email only when one is provided
  validateEmail(cleanEmail)

  const data = {
    name: cleanName,
    phone: cleanPhone,
    person_type: person_type || 'member',
    status: 'active',
  }

  // Do not send an empty email to Appwrite
  if (cleanEmail) {
    data.email = cleanEmail
  }

  return tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: MEMBERS_TABLE_ID,
    rowId: ID.unique(),
    data,
  })
}

// Update a member
export async function updateMember(rowId, data) {
  const cleanData = { ...data }

  if ('name' in cleanData) {
    cleanData.name = String(cleanData.name ?? '').trim()

    if (!cleanData.name) {
      throw new Error('The name cannot be empty.')
    }
  }

  if ('email' in cleanData) {
    const cleanEmail = String(cleanData.email ?? '').trim()

    validateEmail(cleanEmail)

    // null clears the stored email; leaving the key out would keep the old one
    cleanData.email = cleanEmail || null
  }

  if ('phone' in cleanData) {
    cleanData.phone = String(cleanData.phone ?? '').trim()
  }

  return tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: MEMBERS_TABLE_ID,
    rowId,
    data: cleanData,
  })
}

// Delete a member
export async function deleteMember(rowId) {
  return tablesDB.deleteRow({
    databaseId: DATABASE_ID,
    tableId: MEMBERS_TABLE_ID,
    rowId,
  })
}