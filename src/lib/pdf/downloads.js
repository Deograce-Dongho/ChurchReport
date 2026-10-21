// Entry points used by the pages: build a report and save the file.
// Loaded on demand (`await import('../lib/pdf/downloads')`) so that jsPDF
// and the logo are only downloaded when somebody asks for a PDF.

import { formatShortDate } from '../periods'
import { buildMembersPdf } from './membersPdf'
import { buildServiceReportPdf } from './serviceReportPdf'
import { buildStatisticsPdf } from './statisticsPdf'

function today() {
  return formatShortDate(new Date())
}

export async function downloadMembersPdf(data, filename) {
  const doc = await buildMembersPdf({ ...data, generatedOn: today() })
  doc.save(filename)
}

export async function downloadStatisticsPdf(data, filename) {
  const doc = await buildStatisticsPdf({
    ...data,
    formatDate: formatShortDate,
    generatedOn: today(),
  })
  doc.save(filename)
}

export async function downloadServiceReportPdf(data, filename) {
  const doc = await buildServiceReportPdf({ ...data, generatedOn: today() })
  doc.save(filename)
}
