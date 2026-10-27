import type { ColType, Row } from '../lib'

export interface Column {
  key: string
  label: string // matches the workbook header so Excel import/export lines up
  type: ColType
  options?: string[]
  computed?: boolean // read-only, calculated in the DB view
  cost?: boolean // admin/head only, stored in the cost table
  required?: boolean // asked for when adding a row
  poPicker?: boolean // value must be an existing PO No.
}

export interface TrackerConfig {
  id: string
  title: string
  path: string
  sheet: string // sheet name in the original workbook
  table: string
  view: string
  costTable?: { table: string; fk: string }
  columns: Column[]
  statusKey?: string
  searchKeys: string[]
  editTeams: string[]
  defaultSort: { key: string; dir: 'asc' | 'desc' }
  rowClass?: (row: Row, today: string) => string
}
