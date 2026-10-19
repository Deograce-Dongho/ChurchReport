import { ID, Query } from 'appwrite'
import {
  tablesDB,
  DATABASE_ID,
  SERVICES_TABLE_ID,
  ATTENDANCE_TABLE_ID,
} from './appwrite'

const PAGE_SIZE = 100

// Start (inclusive) and end (exclusive) of the selected local day.
function dayRange(serviceDate) {
  const start = new Date(`${serviceDate}T00:00:00`)
  const end = new Date(`${serviceDate}T00:00:00`)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

// Find the service of the selected date, or return null.
export async function getServiceByDate(serviceDate) {
  const { start, end } = dayRange(serviceDate)

  const response = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: SERVICES_TABLE_ID,
    queries: [
      Query.greaterThanEqual('service_date', start.toISOString()),
      Query.lessThan('service_date', end.toISOString()),
      Query.limit(1),
    ],
  })

  return response.rows[0] ?? null
}

// Find an existing service for the selected date,
// or create it if it does not exist.
export async function getOrCreateService({
  serviceDate,
  preacherName,
  sermonTitle,
  keyPoints,
}) {
  if (!serviceDate || !preacherName.trim() || !sermonTitle.trim()) {
    throw new Error(
      'Please provide the service date, preacher name and sermon title.'
    )
  }

  const existingService = await getServiceByDate(serviceDate)

  const serviceData = {
    service_date: new Date(`${serviceDate}T12:00:00`).toISOString(),
    preacher_name: preacherName.trim(),
    sermon_title: sermonTitle.trim(),
    sermon_key_points: (keyPoints ?? '').trim(),
  }

  if (existingService) {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: SERVICES_TABLE_ID,
      rowId: existingService.$id,
      data: serviceData,
    })

    return existingService.$id
  }

  const createdService = await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: SERVICES_TABLE_ID,
    rowId: ID.unique(),
    data: serviceData,
  })

  return createdService.$id
}

// All attendance records of one service, as
// [{ rowId, memberId, presenceType }].
// The member id is read from unique_key (serviceId_memberId),
// so no relationship query is needed.
export async function getAttendanceForService(serviceId) {
  const prefix = `${serviceId}_`
  const records = []
  let cursor = null

  while (true) {
    const queries = [
      Query.startsWith('unique_key', prefix),
      Query.limit(PAGE_SIZE),
    ]
    if (cursor) queries.push(Query.cursorAfter(cursor))

    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: ATTENDANCE_TABLE_ID,
      queries,
    })

    for (const row of response.rows) {
      records.push({
        rowId: row.$id,
        memberId: row.unique_key.slice(prefix.length),
        presenceType: row.presence_type,
      })
    }

    if (response.rows.length < PAGE_SIZE) break
    cursor = response.rows[response.rows.length - 1].$id
  }

  return records
}

// Create the attendance record, or update its type if it already exists.
// Returns { status: 'created' | 'updated' | 'unchanged', row }
export async function saveAttendance({ serviceId, memberId, presenceType }) {
  if (!serviceId || !memberId) {
    throw new Error('A service and a member must be selected.')
  }

  if (!['In person', 'Online'].includes(presenceType)) {
    throw new Error('Invalid attendance type.')
  }

  const uniqueKey = `${serviceId}_${memberId}`

  async function findExisting() {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: ATTENDANCE_TABLE_ID,
      queries: [Query.equal('unique_key', uniqueKey), Query.limit(1)],
    })
    return res.rows[0] ?? null
  }

  async function updateIfNeeded(existing) {
    if (existing.presence_type === presenceType) {
      return { status: 'unchanged', row: existing }
    }

    const row = await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: ATTENDANCE_TABLE_ID,
      rowId: existing.$id,
      data: { presence_type: presenceType },
    })

    return { status: 'updated', row }
  }

  const existing = await findExisting()
  if (existing) return updateIfNeeded(existing)

  try {
    const row = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: ATTENDANCE_TABLE_ID,
      rowId: ID.unique(),
      data: {
        service: serviceId,
        member: memberId,
        presence_type: presenceType,
        unique_key: uniqueKey,
      },
    })

    return { status: 'created', row }
  } catch (error) {
    // 409: a simultaneous request created the same record (unique index)
    if (error.code !== 409) throw error

    const winner = await findExisting()
    if (!winner) throw error

    return updateIfNeeded(winner)
  }
}

// Delete the attendance records of this service whose member
// is no longer ticked. Returns { removed, failed } (counts).
export async function removeUncheckedAttendance(serviceId, keepMemberIds) {
  const keep = new Set(keepMemberIds)
  const records = await getAttendanceForService(serviceId)
  const toDelete = records.filter((record) => !keep.has(record.memberId))

  let removed = 0
  let failed = 0

  for (const record of toDelete) {
    try {
      await tablesDB.deleteRow({
        databaseId: DATABASE_ID,
        tableId: ATTENDANCE_TABLE_ID,
        rowId: record.rowId,
      })
      removed++
    } catch (error) {
      console.error('Could not remove attendance record:', error)
      failed++
    }
  }

  return { removed, failed }
}