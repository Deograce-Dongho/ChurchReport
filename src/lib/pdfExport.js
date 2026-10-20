import html2pdf from 'html2pdf.js'

// Remove Tailwind classes from the PDF copy and apply safe inline styles.
// (Tailwind v4 uses modern color functions that html2canvas cannot parse.)
//
// The element to export must be an <article> using only these tags:
// header, h2, h3, h4, p, dl/dt/dd, table/th/td, footer, span, div.
// Inline style="" attributes written in the JSX are kept.
export function preparePDFCopy(original) {
  const clone = original.cloneNode(true)
  const nodes = [clone, ...clone.querySelectorAll('*')]

  nodes.forEach((node) => {
    // Optional font size for an element (e.g. a dense table): data-pdf-font-size="11px"
    const customFontSize = node.getAttribute('data-pdf-font-size')

    node.removeAttribute('class')
    node.removeAttribute('id')

    node.style.setProperty('box-shadow', 'none', 'important')
    node.style.setProperty('text-shadow', 'none', 'important')
    node.style.setProperty('background-image', 'none', 'important')
    node.style.setProperty('font-family', 'Arial, sans-serif', 'important')
    node.style.setProperty('box-sizing', 'border-box', 'important')

    if (node.tagName === 'ARTICLE') {
      Object.assign(node.style, {
        width: '760px',
        maxWidth: 'none',
        margin: '0',
        padding: '32px',
        border: '1px solid #e2e8f0',
        borderRadius: '0',
        backgroundColor: '#ffffff',
        color: '#111827',
        fontSize: '14px',
        lineHeight: '1.5',
      })
    }

    if (node.tagName === 'HEADER') {
      Object.assign(node.style, {
        borderBottom: '1px solid #cbd5e1',
        paddingBottom: '20px',
      })
    }

    if (node.tagName === 'H2') {
      Object.assign(node.style, {
        color: '#142D4E',
        fontSize: '24px',
        fontWeight: '700',
        margin: '0',
      })
    }

    if (node.tagName === 'H3') {
      Object.assign(node.style, {
        color: '#142D4E',
        fontSize: '16px',
        fontWeight: '700',
        margin: '0 0 8px 0',
      })
    }

    if (node.tagName === 'H4') {
      Object.assign(node.style, {
        color: '#1e293b',
        fontSize: '14px',
        fontWeight: '700',
        margin: '16px 0 8px 0',
      })
    }

    if (node.tagName === 'P') {
      Object.assign(node.style, {
        color: '#334155',
        margin: '8px 0',
        whiteSpace: 'pre-wrap',
      })
    }

    if (node.tagName === 'DL') {
      Object.assign(node.style, {
        display: 'grid',
        gridTemplateColumns: '128px 1fr',
        rowGap: '4px',
        margin: '8px 0 0 0',
      })
    }

    if (node.tagName === 'DT') {
      node.style.color = '#64748b'
    }

    if (node.tagName === 'DD') {
      node.style.color = '#111827'
      node.style.margin = '0'
    }

    if (node.tagName === 'TABLE') {
      Object.assign(node.style, {
        width: '100%',
        borderCollapse: 'collapse',
        textAlign: 'left',
        fontSize: '13px',
        marginTop: '8px',
      })
    }

    if (node.tagName === 'TH') {
      Object.assign(node.style, {
        color: '#475569',
        fontWeight: '600',
        padding: '8px 4px',
        borderBottom: '1px solid #cbd5e1',
      })
    }

    if (node.tagName === 'TD') {
      Object.assign(node.style, {
        color: '#334155',
        padding: '6px 4px',
        borderBottom: '1px solid #e2e8f0',
      })
    }

    if (node.tagName === 'FOOTER') {
      Object.assign(node.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: '24px',
        marginTop: '40px',
        paddingTop: '16px',
        borderTop: '1px solid #cbd5e1',
        color: '#64748b',
        fontSize: '11px',
        breakInside: 'avoid',
      })
    }

    if (node.tagName === 'SPAN') {
      node.style.color = '#64748b'
    }

    if (node.tagName === 'DIV') {
      node.style.backgroundColor = 'transparent'
    }

    if (customFontSize) {
      node.style.fontSize = customFontSize
    }
  })

  return clone
}

// Download a PDF from a sanitized, off-screen copy of `element`.
// Options: { pageNumbers: true } writes "Page x / y" at the bottom of each page.
// Throws if the PDF cannot be generated.
export async function downloadElementAsPDF(
  element,
  filename,
  { pageNumbers = false } = {}
) {
  if (!element) throw new Error('Nothing to export.')

  const clone = preparePDFCopy(element)

  const container = document.createElement('div')
  Object.assign(container.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: '780px',
    padding: '0',
    margin: '0',
    backgroundColor: '#ffffff',
    color: '#111827',
    zIndex: '-1',
  })

  container.appendChild(clone)
  document.body.appendChild(container)

  try {
    let worker = html2pdf()
      .set({
        margin: 10,
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
          useCORS: true,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
        },
        pagebreak: {
          mode: ['css', 'legacy'],
          avoid: ['tr', 'footer'],
        },
      })
      .from(clone)

    if (pageNumbers) {
      worker = worker
        .toPdf()
        .get('pdf')
        .then((pdf) => {
          const total = pdf.internal.getNumberOfPages()
          const width = pdf.internal.pageSize.getWidth()
          const height = pdf.internal.pageSize.getHeight()

          pdf.setFontSize(9)
          pdf.setTextColor(100)

          for (let page = 1; page <= total; page += 1) {
            pdf.setPage(page)
            pdf.text(`Page ${page} / ${total}`, width / 2, height - 5, {
              align: 'center',
            })
          }
        })
    }

    await worker.save()
  } finally {
    container.remove()
  }
}