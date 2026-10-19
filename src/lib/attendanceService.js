
import { ID, Query } from 'appwrite'
import {
  tablesDB,
  DATABASE_ID,
  SERVICES_TABLE_ID,
  ATTENDANCE_TABLE_ID,
} from './appwrite'

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

  const start = new Date(`${serviceDate}T00:00:00`)
  const end = new Date(`${serviceDate}T00:00:00`)
  end.setDate(end.getDate() + 1)

  const response = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: SERVICES_TABLE_ID,
    queries: [
      Query.greaterThanEqual('service_date', start.toISOString()),
      Query.lessThan('service_date', end.toISOString()),
      Query.limit(100),
    ],
  })

  const serviceData = {
    service_date: new Date(`${serviceDate}T12:00:00`).toISOString(),
    preacher_name: preacherName.trim(),
    sermon_title: sermonTitle.trim(),
    sermon_key_points: (keyPoints ?? '').trim(),
  }

  if (response.rows.length > 0) {
    const existingService = response.rows[0]

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

// Create an attendance record only if the member
// is not already recorded for this service.
export async function createAttendance({
  serviceId,
  memberId,
  presenceType,
}) {
  if (!serviceId || !memberId) {
    throw new Error('A service and a member must be selected.')
  }

  if (!['In person', 'Online'].includes(presenceType)) {
    throw new Error('Invalid attendance type.')
  }

  const existing = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: ATTENDANCE_TABLE_ID,
    queries: [
      Query.equal('service', serviceId),
      Query.equal('member', memberId),
      Query.limit(1),
    ],
  })

  if (existing.rows.length > 0) {
    return {
      created: false,
      row: existing.rows[0],
    }
  }

  const row = await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: ATTENDANCE_TABLE_ID,
    rowId: ID.unique(),
    data: {
      service: serviceId,
      member: memberId,
      presence_type: presenceType,
    },
  })

  return {
    created: true,
    row,
  }
}
