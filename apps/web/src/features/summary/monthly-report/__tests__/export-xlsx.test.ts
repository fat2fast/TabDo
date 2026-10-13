import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import * as fflate from 'fflate'
import { generateReportXlsx, SharedStringsTable } from '../export-xlsx'
import type { ReportData } from '../types'

describe('export-xlsx', () => {
  const templatePath = path.resolve(
    process.cwd(),
    'public/report-templates/monthly-work-report-v1.xlsx'
  )
  const templateBytes = new Uint8Array(fs.readFileSync(templatePath))

  describe('SharedStringsTable', () => {
    it('manages and deduplicates strings', () => {
      const sst = new SharedStringsTable('<sst count="1" uniqueCount="1"><si><t>Header</t></si></sst>')
      const idx1 = sst.add('Header')
      expect(idx1).toBe(0)

      const idx2 = sst.add('New String')
      expect(idx2).toBe(1)

      const idx3 = sst.add('New String')
      expect(idx3).toBe(1) // Dedup

      const serialized = sst.serialize()
      expect(serialized).toContain('<si><t>Header</t></si>')
      expect(serialized).toContain('<si><t>New String</t></si>')
    })

    it('escapes xml characters properly and preserves spaces', () => {
      const sst = new SharedStringsTable()
      sst.add('Formula-like: =SUM(A1:A10)')
      sst.add('Special: < & > " \'')
      sst.add(' Leading space')

      const serialized = sst.serialize()
      expect(serialized).toContain('Formula-like: =SUM(A1:A10)')
      expect(serialized).toContain('Special: &lt; &amp; &gt; &quot; &apos;')
      expect(serialized).toContain('xml:space="preserve"')
    })
  })

  describe('generateReportXlsx', () => {
    it('generates valid XLSX with 0 tasks and 0 categories', () => {
      const data: ReportData = {
        departmentText: '',
        reporterName: 'Nguyen Van A',
        reportDateText: '13/10/2026',
        jobTitleText: '',
        periodText: 'Tháng 10/2026',
        items: [],
        categories: [],
      }

      const outputBytes = generateReportXlsx(data, templateBytes)
      expect(outputBytes.length).toBeGreaterThan(0)

      const unzipped = fflate.unzipSync(outputBytes)
      expect(unzipped['xl/worksheets/sheet1.xml']).toBeDefined()
      expect(unzipped['xl/worksheets/sheet2.xml']).toBeDefined()
      expect(unzipped['xl/calcChain.xml']).toBeUndefined() // Clean recalculation

      const textDecoder = new TextDecoder()
      const sheet1Xml = textDecoder.decode(unzipped['xl/worksheets/sheet1.xml'])

      // Dimension remains A1:I25
      expect(sheet1Xml).toContain('<dimension ref="A1:I25"/>')
      // Formula in C14 uses B10:B10
      expect(sheet1Xml).toContain('<f>COUNTIF(B10:B10,"?*")</f>')
      // Conditional formatting on F10
      expect(sheet1Xml).toContain('<conditionalFormatting sqref="F10:F10">')
      // No #REF!
      expect(sheet1Xml).not.toContain('#REF!')
    })

    it('generates valid XLSX with 1 task and 1 category', () => {
      const data: ReportData = {
        departmentText: '',
        reporterName: 'Hoàng Mai',
        reportDateText: '13/10/2026',
        jobTitleText: '',
        periodText: 'Tháng 10/2026',
        items: [
          {
            taskId: 't-1',
            categoryName: 'Hành chính',
            title: 'Mua sắm thiết bị',
            dueAtDateSerial: 46310,
            dueAtDisplay: '15/10/2026',
            statusText: 'Hoàn thành',
          },
        ],
        categories: ['Hành chính'],
      }

      const outputBytes = generateReportXlsx(data, templateBytes)
      const unzipped = fflate.unzipSync(outputBytes)
      const textDecoder = new TextDecoder()
      const sheet1Xml = textDecoder.decode(unzipped['xl/worksheets/sheet1.xml'])
      const sheet2Xml = textDecoder.decode(unzipped['xl/worksheets/sheet2.xml'])
      const sstXml = textDecoder.decode(unzipped['xl/sharedStrings.xml'])

      expect(sstXml).toContain('Hoàng Mai')
      expect(sstXml).toContain('Mua sắm thiết bị')
      expect(sstXml).toContain('Hành chính')

      // Date serial placed in D10
      expect(sheet1Xml).toContain('<c r="D10" s="9"><v>46310</v></c>')
      // Category filled in Sheet2 A2
      expect(sheet2Xml).toContain('<c r="A2" s="7" t="s">')
      // Dimension sheet2
      expect(sheet2Xml).toContain('<dimension ref="A1:C5"/>')
    })

    it('generates valid XLSX with 25 tasks and 8 categories (row expansion & shifts)', () => {
      const categories = [
        'Nhóm 1',
        'Nhóm 2',
        'Nhóm 3',
        'Nhóm 4',
        'Nhóm 5',
        'Nhóm 6',
        'Nhóm 7',
        'Nhóm 8',
      ]

      const items = Array.from({ length: 25 }, (_, i) => ({
        taskId: `task-${i + 1}`,
        categoryName: categories[i % categories.length],
        title: `Công việc số ${i + 1} = test formula prefix`,
        dueAtDateSerial: 46300 + i,
        dueAtDisplay: `${i + 1}/10/2026`,
        statusText: (i % 3 === 0
          ? 'Hoàn thành'
          : i % 3 === 1
          ? 'Đang thực hiện'
          : 'Chưa thực hiện') as 'Hoàn thành' | 'Đang thực hiện' | 'Chưa thực hiện',
      }))

      const data: ReportData = {
        departmentText: '',
        reporterName: 'Trần Văn B',
        reportDateText: '13/10/2026',
        jobTitleText: '',
        periodText: 'Từ 01/10/2026 đến 31/10/2026',
        items,
        categories,
      }

      const outputBytes = generateReportXlsx(data, templateBytes)
      const unzipped = fflate.unzipSync(outputBytes)
      const textDecoder = new TextDecoder()
      const sheet1Xml = textDecoder.decode(unzipped['xl/worksheets/sheet1.xml'])
      const sheet2Xml = textDecoder.decode(unzipped['xl/worksheets/sheet2.xml'])

      // Task count: 25 -> rows 10..34 (deltaTask = 24)
      // Extra groups: 8 - 4 = 4 extra rows (deltaTotal = 24 + 4 = 28)
      // Total rows: 25 + 28 = 53
      expect(sheet1Xml).toContain('<dimension ref="A1:I53"/>')

      // Check task range in formulas: B10:B34 and F10:F34
      expect(sheet1Xml).toContain('<f>COUNTIF(B10:B34,"?*")</f>')
      expect(sheet1Xml).toContain('<f>COUNTIF(F10:F34,"Hoàn thành")</f>')
      expect(sheet1Xml).toContain('<f>COUNTIF(F10:F34,"Đang thực hiện")</f>')
      expect(sheet1Xml).toContain('<f>COUNTIF($B$10:$B$34,E')

      // Conditional formatting on F10:F34
      expect(sheet1Xml).toContain('<conditionalFormatting sqref="F10:F34">')

      // Sheet 2 dimension: A1:C9 (1 + 8 categories)
      expect(sheet2Xml).toContain('<dimension ref="A1:C9"/>')

      // Check no #REF! anywhere
      expect(sheet1Xml).not.toContain('#REF!')
      expect(sheet2Xml).not.toContain('#REF!')
    })
  })
})
