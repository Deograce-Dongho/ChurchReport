// Creates (or removes) test people in the Appwrite "members" table.
//
// Setup (once):
//   pnpm add -D node-appwrite
//   Appwrite console > Overview > Integrations > API keys > create a key
//   with the scopes to read and write database rows.
//
// Usage (PowerShell, Node 20.6 or newer):
//   $env:APPWRITE_API_KEY = "<your key>"
//   node --env-file=.env scripts/seed-members.mjs           # create test people
//   node --env-file=.env scripts/seed-members.mjs --clean   # remove them again
//   Remove-Item Env:APPWRITE_API_KEY
//
// The API key is a SERVER secret: never put it in .env with a VITE_ prefix,
// never commit it, and delete the key in the console when you are done.
//
// Test people get fixed ids (seed_001, seed_002, ...), so running the script
// twice does not create duplicates, and --clean removes exactly these people
// together with their attendance records.

import { Client, Query, TablesDB } from 'node-appwrite'

const {
  VITE_APPWRITE_ENDPOINT: endpoint,
  VITE_APPWRITE_PROJECT_ID: projectId,
  VITE_APPWRITE_DATABASE_ID: databaseId,
  VITE_APPWRITE_MEMBERS_TABLE_ID: membersTableId,
  VITE_APPWRITE_ATTENDANCE_TABLE_ID: attendanceTableId,
  APPWRITE_API_KEY: apiKey,
} = process.env

const missing = Object.entries({
  VITE_APPWRITE_ENDPOINT: endpoint,
  VITE_APPWRITE_PROJECT_ID: projectId,
  VITE_APPWRITE_DATABASE_ID: databaseId,
  VITE_APPWRITE_MEMBERS_TABLE_ID: membersTableId,
  VITE_APPWRITE_ATTENDANCE_TABLE_ID: attendanceTableId,
  APPWRITE_API_KEY: apiKey,
})
  .filter(([, value]) => !value)
  .map(([name]) => name)

if (missing.length > 0) {
  console.error(`Missing environment variable(s): ${missing.join(', ')}`)
  console.error(
    'Run with: node --env-file=.env scripts/seed-members.mjs (and set APPWRITE_API_KEY first).'
  )
  process.exit(1)
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey)

const tablesDB = new TablesDB(client)

// 32 members (including a duplicated name and a very long one) and 4 visitors
const MEMBER_NAMES = [
  'Marie Dupont',
  'Jean-Baptiste Nkurunziza',
  'Esther Mukamana',
  'David Habimana',
  'Grace Uwimana',
  'Samuel Ndayisenga',
  'Ruth Niyonzima',
  'Paul Bizimana',
  'Sarah Ndikumana',
  'Daniel Hakizimana',
  'Naomi Irakoze',
  'Joseph Nsabimana',
  'Rebecca Uwase',
  'Emmanuel Kamanzi',
  'Lydia Mbarushimana',
  'Joël Ntahomvukiye',
  'Élodie Mugisha',
  'François Ndabaneze',
  'Priscille Nzeyimana',
  'Gabriel Ruhamya',
  'Béatrice Iradukunda',
  'Thomas Habonimana',
  'Judith Kwizera',
  'Marc Niyibizi',
  'Salomé Ndayishimiye',
  'Timothée Barakamfitiye',
  'Débora Nahimana',
  'Michel Havyarimana',
  'Marie Dupont', // same name as the first one, on purpose
  'Anne-Claire Maria Fernanda de la Cruz Santos-Oliveira', // very long name
  'Pierre Karenzo',
  'Claire Manirakiza',
]

const VISITOR_NAMES = [
  'Alice Weber',
  'Markus Schneider',
  'Fatima Benali',
  'Peter Okafor',
]

function slug(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '')
}

function buildPeople() {
  const all = [
    ...MEMBER_NAMES.map((name) => ({ name, person_type: 'member' })),
    ...VISITOR_NAMES.map((name) => ({ name, person_type: 'visitor' })),
  ]

  return all.map((person, index) => {
    const id = `seed_${String(index + 1).padStart(3, '0')}`
    const data = { name: person.name, person_type: person.person_type, status: 'active' }

    // Vary the contact details: none / email + phone / phone only.
    // Visitors never get an email (empty email is a case to test).
    const pattern = index % 3
    if (pattern === 1 && person.person_type === 'member') {
      data.email = `${slug(person.name)}.${index + 1}@example.com`
      data.phone = `+49 151 000${String(index).padStart(4, '0')}`
    }
    if (pattern === 2) {
      data.phone = `+257 79 00${String(index).padStart(4, '0')}`
    }

    return { id, data }
  })
}

async function seed() {
  const people = buildPeople()
  let created = 0
  let skipped = 0

  for (const { id, data } of people) {
    try {
      await tablesDB.createRow({
        databaseId,
        tableId: membersTableId,
        rowId: id,
        data,
      })
      created++
    } catch (error) {
      // 409 = this test person already exists
      if (error.code === 409) {
        skipped++
      } else {
        throw error
      }
    }
  }

  console.log(
    `Done: ${created} created, ${skipped} already existed (${people.length} test people in total).`
  )
}

// All attendance rows, read page by page.
async function listAllAttendance() {
  const rows = []
  let cursor = null

  while (true) {
    const queries = [Query.limit(100)]
    if (cursor) queries.push(Query.cursorAfter(cursor))

    const response = await tablesDB.listRows({
      databaseId,
      tableId: attendanceTableId,
      queries,
    })

    rows.push(...response.rows)

    if (response.rows.length < 100) break
    cursor = response.rows[response.rows.length - 1].$id
  }

  return rows
}

async function clean() {
  const people = buildPeople()
  const ids = people.map((person) => person.id)

  // unique_key is "serviceId_memberId": find the attendance of test people
  const attendance = await listAllAttendance()
  const attendanceToDelete = attendance.filter((row) =>
    ids.some((id) => String(row.unique_key ?? '').endsWith(`_${id}`))
  )

  let attendanceRemoved = 0
  for (const row of attendanceToDelete) {
    await tablesDB.deleteRow({
      databaseId,
      tableId: attendanceTableId,
      rowId: row.$id,
    })
    attendanceRemoved++
  }

  let removed = 0
  for (const id of ids) {
    try {
      await tablesDB.deleteRow({
        databaseId,
        tableId: membersTableId,
        rowId: id,
      })
      removed++
    } catch (error) {
      // 404 = already gone
      if (error.code !== 404) throw error
    }
  }

  console.log(
    `Done: ${removed} test people and ${attendanceRemoved} attendance record(s) removed.`
  )
}

const action = process.argv.includes('--clean') ? clean : seed

action().catch((error) => {
  console.error('Failed:', error.message ?? error)
  process.exit(1)
})
