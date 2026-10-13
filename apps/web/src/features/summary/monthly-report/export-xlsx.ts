import * as fflate from 'fflate'
import type { ReportData } from './types'

export class SharedStringsTable {
  private strings: string[] = []
  private stringMap = new Map<string, number>()

  constructor(existingXml?: string) {
    if (existingXml) {
      this.parse(existingXml)
    }
  }

  private parse(xml: string) {
    const siRegex = /<si>([\s\S]*?)<\/si>/g
    let match: RegExpExecArray | null

    while ((match = siRegex.exec(xml)) !== null) {
      const siContent = match[1]
      // Extract all <t> elements inside <si>
      const tRegex = /<t(?: xml:space="[^"]*")?>([\s\S]*?)<\/t>/g
      let text = ''
      let tMatch: RegExpExecArray | null
      while ((tMatch = tRegex.exec(siContent)) !== null) {
        text += this.unescapeXml(tMatch[1])
      }
      const idx = this.strings.length
      this.strings.push(text)
      if (!this.stringMap.has(text)) {
        this.stringMap.set(text, idx)
      }
    }
  }

  public add(str: string): number {
    const existing = this.stringMap.get(str)
    if (existing !== undefined) {
      return existing
    }
    const idx = this.strings.length
    this.strings.push(str)
    this.stringMap.set(str, idx)
    return idx
  }

  public serialize(): string {
    const items = this.strings.map((str) => {
      const escaped = this.escapeXml(str)
      const needsPreserve =
        str.startsWith(' ') || str.endsWith(' ') || str.includes('\n') || str.includes('\t')
      const attr = needsPreserve ? ' xml:space="preserve"' : ''
      return `<si><t${attr}>${escaped}</t></si>`
    })

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${this.strings.length}" uniqueCount="${this.strings.length}">${items.join('')}</sst>`
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  private unescapeXml(text: string): string {
    return text
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&')
  }
}

export function populateSheet1(
  sheetXml: string,
  data: ReportData,
  sst: SharedStringsTable
): string {
  const taskCount = Math.max(data.items.length, 1)
  const groupCount = Math.max(data.categories.length, 1)

  const deltaTask = taskCount - 1
  const endTaskRow = 10 + taskCount - 1
  const extraGroups = Math.max(0, data.categories.length - 4)
  const deltaTotal = deltaTask + extraGroups

  // 1. Build Work Rows (Rows 10 .. endTaskRow)
  const workRowsXml: string[] = []
  for (let i = 0; i < taskCount; i++) {
    const rowNum = 10 + i
    if (data.items.length > 0) {
      const item = data.items[i]
      const catIdx = sst.add(item.categoryName)
      const titleIdx = sst.add(item.title)
      const statusIdx = sst.add(item.statusText)

      const dueCell =
        item.dueAtDateSerial !== null
          ? `<c r="D${rowNum}" s="9"><v>${item.dueAtDateSerial}</v></c>`
          : `<c r="D${rowNum}" s="9"/>`

      workRowsXml.push(
        `<row r="${rowNum}" spans="1:9" s="12" customFormat="1" ht="51" customHeight="1">` +
          `<c r="A${rowNum}" s="7"><f>IF(B${rowNum}="","",ROW()-9)</f><v>${i + 1}</v></c>` +
          `<c r="B${rowNum}" s="8" t="s"><v>${catIdx}</v></c>` +
          `<c r="C${rowNum}" s="8" t="s"><v>${titleIdx}</v></c>` +
          dueCell +
          `<c r="E${rowNum}" s="8"/>` +
          `<c r="F${rowNum}" s="7" t="s"><v>${statusIdx}</v></c>` +
          `<c r="G${rowNum}" s="8"/>` +
          `<c r="H${rowNum}" s="8"/>` +
          `<c r="I${rowNum}" s="8"/>` +
          `</row>`
      )
    } else {
      // 0 tasks: preserve single blank row 10
      workRowsXml.push(
        `<row r="10" spans="1:9" s="12" customFormat="1" ht="51" customHeight="1">` +
          `<c r="A10" s="7"><f>IF(B10="","",ROW()-9)</f><v/></c>` +
          `<c r="B10" s="8"/>` +
          `<c r="C10" s="8"/>` +
          `<c r="D10" s="9"/>` +
          `<c r="E10" s="8"/>` +
          `<c r="F10" s="7"/>` +
          `<c r="G10" s="8"/>` +
          `<c r="H10" s="8"/>` +
          `<c r="I10" s="8"/>` +
          `</row>`
      )
    }
  }

  // 2. Build Summary Rows (Indicators & Groups)
  const r1 = 14 + deltaTask
  const r2 = 15 + deltaTask
  const r3 = 16 + deltaTask
  const r4 = 17 + deltaTask

  // Helper for E..G in row
  function buildGroupCells(rowIdx: number, catIndex: number): string {
    if (catIndex < data.categories.length) {
      const catName = data.categories[catIndex]
      const cIdx = sst.add(catName)
      return (
        `<c r="E${rowIdx}" s="3" t="s"><v>${cIdx}</v></c>` +
        `<c r="F${rowIdx}" s="2"><f>COUNTIF($B$10:$B$${endTaskRow},E${rowIdx})</f><v>0</v></c>` +
        `<c r="G${rowIdx}" s="2"><f>COUNTIFS($B$10:$B$${endTaskRow},E${rowIdx},$F$10:$F$${endTaskRow},"Hoàn thành")</f><v>0</v></c>`
      )
    } else if (catIndex === 0 && data.categories.length === 0) {
      return (
        `<c r="E${rowIdx}" s="3"/>` +
        `<c r="F${rowIdx}" s="2"><f>COUNTIF($B$10:$B$${endTaskRow},E${rowIdx})</f><v>0</v></c>` +
        `<c r="G${rowIdx}" s="2"><f>COUNTIFS($B$10:$B$${endTaskRow},E${rowIdx},$F$10:$F$${endTaskRow},"Hoàn thành")</f><v>0</v></c>`
      )
    }
    return `<c r="E${rowIdx}" s="3"/>`
  }

  const indicator1Xml =
    `<row r="${r1}" spans="1:9" ht="26.45" customHeight="1">` +
    `<c r="A${r1}" s="20" t="s"><v>19</v></c><c r="B${r1}" s="20"/>` +
    `<c r="C${r1}" s="2"><f>COUNTIF(B10:B${endTaskRow},"?*")</f><v>0</v></c>` +
    `<c r="D${r1}" s="3"/>` +
    buildGroupCells(r1, 0) +
    `<c r="H${r1}" s="4"/><c r="I${r1}" s="4"/></row>`

  const indicator2Xml =
    `<row r="${r2}" spans="1:9" ht="26.45" customHeight="1">` +
    `<c r="A${r2}" s="20" t="s"><v>18</v></c><c r="B${r2}" s="20"/>` +
    `<c r="C${r2}" s="2"><f>COUNTIF(F10:F${endTaskRow},"Hoàn thành")</f><v>0</v></c>` +
    `<c r="D${r2}" s="3"/>` +
    buildGroupCells(r2, 1) +
    `<c r="H${r2}" s="4"/><c r="I${r2}" s="4"/></row>`

  const indicator3Xml =
    `<row r="${r3}" spans="1:9" ht="26.45" customHeight="1">` +
    `<c r="A${r3}" s="20" t="s"><v>20</v></c><c r="B${r3}" s="20"/>` +
    `<c r="C${r3}" s="2"><f>COUNTIF(F10:F${endTaskRow},"Đang thực hiện")</f><v>0</v></c>` +
    `<c r="D${r3}" s="3"/>` +
    buildGroupCells(r3, 2) +
    `<c r="H${r3}" s="4"/><c r="I${r3}" s="4"/></row>`

  const indicator4Xml =
    `<row r="${r4}" spans="1:9" ht="26.45" customHeight="1">` +
    `<c r="A${r4}" s="20" t="s"><v>21</v></c><c r="B${r4}" s="20"/>` +
    `<c r="C${r4}" s="2"><f>COUNTIF(F10:F${endTaskRow},"Chậm tiến độ")+COUNTIF(F10:F${endTaskRow},"Chưa thực hiện")</f><v>0</v></c>` +
    `<c r="D${r4}" s="3"/>` +
    buildGroupCells(r4, 3) +
    `<c r="H${r4}" s="4"/><c r="I${r4}" s="4"/></row>`

  // Extra group rows if categories > 4
  const extraGroupRowsXml: string[] = []
  if (data.categories.length > 4) {
    for (let k = 4; k < data.categories.length; k++) {
      const extraR = 17 + deltaTask + (k - 3)
      const catIdx = sst.add(data.categories[k])
      extraGroupRowsXml.push(
        `<row r="${extraR}" spans="1:9" ht="26.45" customHeight="1">` +
          `<c r="A${extraR}" s="20"/><c r="B${extraR}" s="20"/>` +
          `<c r="C${extraR}" s="2"/><c r="D${extraR}" s="3"/>` +
          `<c r="E${extraR}" s="3" t="s"><v>${catIdx}</v></c>` +
          `<c r="F${extraR}" s="2"><f>COUNTIF($B$10:$B$${endTaskRow},E${extraR})</f><v>0</v></c>` +
          `<c r="G${extraR}" s="2"><f>COUNTIFS($B$10:$B$${endTaskRow},E${extraR},$F$10:$F$${endTaskRow},"Hoàn thành")</f><v>0</v></c>` +
          `<c r="H${extraR}" s="4"/><c r="I${extraR}" s="4"/></row>`
      )
    }
  }

  // 3. Parse all original rows from template
  const rowRegex = /<row r="(\d+)"([^>]*)>([\s\S]*?)<\/row>/g
  const origRows = new Map<number, { attrs: string; inner: string }>()
  let match: RegExpExecArray | null

  while ((match = rowRegex.exec(sheetXml)) !== null) {
    const rNum = parseInt(match[1], 10)
    origRows.set(rNum, { attrs: match[2], inner: match[3] })
  }

  // 4. Assemble new sheetData rows
  const newRows: string[] = []

  // Helper to renumber a row's inner cells
  function shiftRow(origNum: number, targetNum: number): string {
    const rowData = origRows.get(origNum)
    if (!rowData) return ''
    const { attrs, inner } = rowData
    const newInner = inner.replace(/r="([A-Z]+)\d+"/g, `r="$1${targetNum}"`)
    return `<row r="${targetNum}"${attrs}>${newInner}</row>`
  }

  function ensureColonPrefix(val: string): string {
    const trimmed = val.trim()
    if (!trimmed) return ': '
    if (trimmed.startsWith(':')) {
      const after = trimmed.slice(1).trimStart()
      return `: ${after}`
    }
    return `: ${trimmed}`
  }

  function setRowCell(inner: string, col: string, r: number, cellXml: string): string {
    const cellRef = `${col}${r}`
    const selfClosing = new RegExp(`<c r="${cellRef}"[^>]*\\/>`)
    const paired = new RegExp(`<c r="${cellRef}"[^>]*>[\\s\\S]*?<\\/c>`)
    if (selfClosing.test(inner)) {
      return inner.replace(selfClosing, cellXml)
    }
    if (paired.test(inner)) {
      return inner.replace(paired, cellXml)
    }
    return inner + cellXml
  }

  // Rows 1..7 (Top metadata)
  for (let r = 1; r <= 7; r++) {
    const rowData = origRows.get(r)
    if (!rowData) continue
    let inner = rowData.inner

    if (r === 4 && data.periodText) {
      const periodVal = ensureColonPrefix(data.periodText)
      const idx = sst.add(periodVal)
      inner = setRowCell(inner, 'C', 4, `<c r="C4" s="19" t="s"><v>${idx}</v></c>`)
    } else if (r === 5) {
      const reporterVal = ensureColonPrefix(data.reporterName || '')
      const idx = sst.add(reporterVal)
      inner = setRowCell(inner, 'C', 5, `<c r="C5" s="19" t="s"><v>${idx}</v></c>`)
    } else if (r === 6) {
      const dateVal = ensureColonPrefix(data.reportDateText || '')
      const idx = sst.add(dateVal)
      inner = setRowCell(inner, 'C', 6, `<c r="C6" s="5" t="s"><v>${idx}</v></c>`)
    }
    newRows.push(`<row r="${r}"${rowData.attrs}>${inner}</row>`)
  }

  // Row 8: spacing
  if (origRows.has(8)) {
    newRows.push(shiftRow(8, 8))
  }
  // Row 9: Table Header
  if (origRows.has(9)) {
    newRows.push(shiftRow(9, 9))
  }

  // Work rows 10..endTaskRow
  newRows.push(...workRowsXml)

  // Separator row 11 shifted
  newRows.push(shiftRow(11, 11 + deltaTask))
  // Header row 12 shifted ("TỔNG HỢP CUỐI BÁO CÁO")
  newRows.push(shiftRow(12, 12 + deltaTask))
  // Header row 13 shifted
  newRows.push(shiftRow(13, 13 + deltaTask))

  // Indicators and groups
  newRows.push(indicator1Xml, indicator2Xml, indicator3Xml, indicator4Xml)
  if (extraGroupRowsXml.length > 0) {
    newRows.push(...extraGroupRowsXml)
  }

  // Rows 18..25 shifted by deltaTotal
  for (let r = 18; r <= 25; r++) {
    if (origRows.has(r)) {
      newRows.push(shiftRow(r, r + deltaTotal))
    }
  }

  // 5. Replace <sheetData> in XML
  const newSheetData = `<sheetData>${newRows.join('')}</sheetData>`
  let updatedXml = sheetXml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, newSheetData)

  // 6. Update <dimension>
  const totalRowsCount = 25 + deltaTotal
  updatedXml = updatedXml.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:I${totalRowsCount}"/>`)

  // 7. Update <conditionalFormatting>
  const cfReplacement =
    `<conditionalFormatting sqref="F10:F${endTaskRow}">` +
    `<cfRule type="expression" dxfId="3" priority="1"><formula>F10="Hoàn thành"</formula></cfRule>` +
    `<cfRule type="expression" dxfId="2" priority="2"><formula>F10="Đang thực hiện"</formula></cfRule>` +
    `<cfRule type="expression" dxfId="1" priority="3"><formula>F10="Chậm tiến độ"</formula></cfRule>` +
    `<cfRule type="expression" dxfId="0" priority="4"><formula>F10="Chưa thực hiện"</formula></cfRule>` +
    `</conditionalFormatting>`
  updatedXml = updatedXml.replace(
    /<conditionalFormatting[^>]*>[\s\S]*?<\/conditionalFormatting>/,
    cfReplacement
  )

  // 8. Update <mergeCells>
  const mergeCellRegex = /<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g
  const updatedMerges: string[] = []
  let mergeMatch: RegExpExecArray | null

  while ((mergeMatch = mergeCellRegex.exec(sheetXml)) !== null) {
    const col1 = mergeMatch[1]
    const r1Orig = parseInt(mergeMatch[2], 10)
    const col2 = mergeMatch[3]
    const r2Orig = parseInt(mergeMatch[4], 10)

    let shift = 0
    if (r1Orig >= 12 && r1Orig <= 17) {
      shift = deltaTask
    } else if (r1Orig >= 18) {
      shift = deltaTotal
    }

    const newR1 = r1Orig + shift
    const newR2 = r2Orig + shift
    updatedMerges.push(`<mergeCell ref="${col1}${newR1}:${col2}${newR2}"/>`)
  }

  const newMergeCellsXml = `<mergeCells count="${updatedMerges.length}">${updatedMerges.join('')}</mergeCells>`
  updatedXml = updatedXml.replace(/<mergeCells[^>]*>[\s\S]*?<\/mergeCells>/, newMergeCellsXml)

  return updatedXml
}

export function populateSheet2(
  sheetXml: string,
  categories: string[],
  sst: SharedStringsTable
): string {
  const catCount = categories.length
  const totalRows = Math.max(5, 1 + catCount)

  // Parse existing rows
  const rowRegex = /<row r="(\d+)"([^>]*)>([\s\S]*?)<\/row>/g
  const origRows = new Map<number, { attrs: string; inner: string }>()
  let match: RegExpExecArray | null

  while ((match = rowRegex.exec(sheetXml)) !== null) {
    const rNum = parseInt(match[1], 10)
    origRows.set(rNum, { attrs: match[2], inner: match[3] })
  }

  const newRows: string[] = []

  // Row 1 (Headers)
  if (origRows.has(1)) {
    const r1 = origRows.get(1)!
    newRows.push(`<row r="1"${r1.attrs}>${r1.inner}</row>`)
  }

  // Rows 2..5
  for (let r = 2; r <= 5; r++) {
    const rowData = origRows.get(r)
    if (!rowData) continue
    const catIdx = r - 2
    let inner = rowData.inner

    if (catIdx < catCount) {
      const sstIdx = sst.add(categories[catIdx])
      const cellA = `<c r="A${r}" s="7" t="s"><v>${sstIdx}</v></c>`
      if (inner.includes(`r="A${r}"`)) {
        inner = inner.replace(new RegExp(`<c r="A${r}"[^>]*(\\/>|>.*?<\\/c>)`), cellA)
      } else {
        inner = cellA + inner
      }
    } else {
      // empty cell A
      const cellA = `<c r="A${r}" s="7"/>`
      if (inner.includes(`r="A${r}"`)) {
        inner = inner.replace(new RegExp(`<c r="A${r}"[^>]*(\\/>|>.*?<\\/c>)`), cellA)
      } else {
        inner = cellA + inner
      }
    }

    newRows.push(`<row r="${r}"${rowData.attrs}>${inner}</row>`)
  }

  // Rows > 5 if more categories
  if (catCount > 4) {
    for (let i = 4; i < catCount; i++) {
      const r = 2 + i
      const sstIdx = sst.add(categories[i])
      newRows.push(
        `<row r="${r}" spans="1:3" ht="15.4"><c r="A${r}" s="7" t="s"><v>${sstIdx}</v></c></row>`
      )
    }
  }

  const newSheetData = `<sheetData>${newRows.join('')}</sheetData>`
  let updatedXml = sheetXml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, newSheetData)

  // Update dimension
  updatedXml = updatedXml.replace(
    /<dimension ref="[^"]*"\/>/,
    `<dimension ref="A1:C${totalRows}"/>`
  )

  return updatedXml
}

export function generateReportXlsx(
  data: ReportData,
  templateBytes: Uint8Array
): Uint8Array {
  const unzipped = fflate.unzipSync(templateBytes)
  const textDecoder = new TextDecoder()
  const textEncoder = new TextEncoder()

  // 1. Shared Strings Table
  const sstXml = unzipped['xl/sharedStrings.xml']
    ? textDecoder.decode(unzipped['xl/sharedStrings.xml'])
    : ''
  const sst = new SharedStringsTable(sstXml)

  // 2. Populate Sheet1
  const sheet1Raw = textDecoder.decode(unzipped['xl/worksheets/sheet1.xml'])
  const updatedSheet1 = populateSheet1(sheet1Raw, data, sst)
  unzipped['xl/worksheets/sheet1.xml'] = textEncoder.encode(updatedSheet1)

  // 3. Populate Sheet2
  const sheet2Raw = textDecoder.decode(unzipped['xl/worksheets/sheet2.xml'])
  const updatedSheet2 = populateSheet2(sheet2Raw, data.categories, sst)
  unzipped['xl/worksheets/sheet2.xml'] = textEncoder.encode(updatedSheet2)

  // 4. Save updated Shared Strings
  unzipped['xl/sharedStrings.xml'] = textEncoder.encode(sst.serialize())

  // 5. Remove calcChain.xml and relationships to allow clean recalculation
  if (unzipped['xl/calcChain.xml']) {
    delete unzipped['xl/calcChain.xml']
  }

  if (unzipped['[Content_Types].xml']) {
    let contentTypesXml = textDecoder.decode(unzipped['[Content_Types].xml'])
    contentTypesXml = contentTypesXml.replace(
      /<Override PartName="\/xl\/calcChain\.xml"[^>]*\/>/g,
      ''
    )
    unzipped['[Content_Types].xml'] = textEncoder.encode(contentTypesXml)
  }

  if (unzipped['xl/_rels/workbook.xml.rels']) {
    let relsXml = textDecoder.decode(unzipped['xl/_rels/workbook.xml.rels'])
    relsXml = relsXml.replace(
      /<Relationship[^>]*Target="calcChain\.xml"[^>]*\/>/g,
      ''
    )
    unzipped['xl/_rels/workbook.xml.rels'] = textEncoder.encode(relsXml)
  }

  // 6. Zip back
  return fflate.zipSync(unzipped, { level: 6 })
}

export function downloadReportXlsx(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
