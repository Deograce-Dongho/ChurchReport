import { Account, Client, TablesDB } from 'appwrite'

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID

if (!endpoint || !projectId) {
  throw new Error(
    'Missing Appwrite configuration. Check your .env file.'
  )
}

export const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)

export const account = new Account(client)
export const tablesDB = new TablesDB(client)

export const DATABASE_ID =
  import.meta.env.VITE_APPWRITE_DATABASE_ID

export const MEMBERS_TABLE_ID =
  import.meta.env.VITE_APPWRITE_MEMBERS_TABLE_ID

export const SERVICES_TABLE_ID =
  import.meta.env.VITE_APPWRITE_SERVICES_TABLE_ID

export const ATTENDANCE_TABLE_ID =
  import.meta.env.VITE_APPWRITE_ATTENDANCE_TABLE_ID