import type { Row } from '../lib'
import type { Column, TrackerConfig } from './types'

const FIRMS = ['LTN', 'MAC', 'NJE', 'PP']
const REQ = ['Required', 'Not Required', 'Done']
const text = (key: string, label: string, extra: Partial<Column> = {}): Column => ({ key, label, type: 'text', ...extra })
const num = (key: string, label: string, extra: Partial<Column> = {}): Column => ({ key, label, type: 'number', ...extra })
const money = (key: string, label: string, extra: Partial<Column> = {}): Column => ({ key, label, type: 'money', ...extra })
const date = (key: string, label: string, extra: Partial<Column> = {}): Column => ({ key, label, type: 'date', ...extra })
const select = (key: string, label: string, options: string[], extra: Partial<Column> = {}): Column => ({ key, label, type: 'select', options, ...extra })

const due = (r: Row, today: string) => typeof r.next_followup === 'string' && r.next_followup <= today
const FINISHED_PO = ['Delivered', 'Commissioned', 'Closed']

export const PO_STATUSES = ['PO Received', 'Under Negotiation', 'Vendor PO Placed', 'Material Ready', 'Dispatched', 'Delivered', 'Commissioned', 'Closed']

export const TRACKERS: TrackerConfig[] = [
  {
    cardFields: ['client', 'balance', 'days_overdue', 'next_followup'], actions: ['payment'],
    id: 'outstanding', title: 'Outstanding', path: 'outstanding', sheet: '1 Outstanding',
    table: 'outstanding', view: 'outstanding_v',
    columns: [
      text('po_no', 'PO No.'), text('client', 'Client', { required: true }), text('dept', 'Dept.'), select('firm', 'Firm', FIRMS),
      text('invoice_no', 'Invoice No.'), date('invoice_date', 'Invoice Date'),
      money('invoice_amt', 'Invoice Amt', { required: true }), money('received', 'Received'),
      money('balance', 'Balance', { computed: true }), num('days_overdue', 'Days Overdue', { computed: true }),
      text('contact', 'Contact Person & No.'), date('last_followup', 'Last Follow-up'), date('next_followup', 'Next Follow-up'),
      text('remarks', 'Remarks'),
    ],
    searchKeys: ['po_no', 'client', 'dept', 'invoice_no', 'contact', 'remarks'],
    editTeams: ['Sales / Pre-Sales', 'Accounts'],
    defaultSort: { key: 'days_overdue', dir: 'desc' },
    rowClass: (r, t) => (Number(r.balance) <= 0 ? 'row-done' : Number(r.days_overdue) > 60 ? 'row-late' : Number(r.balance) > 0 && due(r, t) ? 'row-due' : ''),
  },
  {
    cardFields: ['bid_no', 'client', 'status', 'bid_open_date'],
    id: 'tenders', title: 'Tenders', path: 'tenders', sheet: '2 Tender Tracker',
    table: 'tenders', view: 'tenders',
    columns: [
      text('bid_no', 'Tender / Bid No.', { required: true }), select('portal', 'Portal', ['GeM', 'Odisha eProc', 'District Portal', 'Other']),
      text('dept', 'Dept.'), text('client', 'Client / Office'), text('item', 'Item'), num('qty', 'Qty'),
      money('estimated_value', 'Estimated Value'), money('quoted_value', 'Quoted Value'),
      money('emd_amt', 'EMD Amt'), select('emd_status', 'EMD Status', ['Paid', 'Refunded', 'Pending', 'Exempt']),
      date('bid_submit_date', 'Bid Submit Date'), date('bid_open_date', 'Bid Open Date'),
      text('make_vendor', 'Make / Vendor'), text('quoted_by', 'Quoted By'),
      select('status', 'Status', ['To Quote', 'Quoted', 'Won', 'Lost', 'Cancelled']),
      date('result_date', 'Result Date'), date('next_followup', 'Next Follow-up'), text('remarks', 'Remarks'),
    ],
    statusKey: 'status',
    searchKeys: ['bid_no', 'dept', 'client', 'item', 'make_vendor', 'quoted_by', 'remarks'],
    editTeams: ['Sales / Pre-Sales', 'Tendering'],
    defaultSort: { key: 'bid_open_date', dir: 'asc' },
    rowClass: (r, t) => (['Won', 'Lost', 'Cancelled'].includes(String(r.status)) ? 'row-done' : due(r, t) ? 'row-due' : ''),
  },
  {
    cardFields: ['po_no', 'client', 'status', 'client_delivery_due'], actions: ['logistics'],
    id: 'pos', title: 'POs', path: 'pos', sheet: '3 PO Tracker',
    table: 'po_tracker', view: 'po_v', costTable: { table: 'po_costs', fk: 'po_id' },
    columns: [
      text('po_no', 'PO No.', { required: true }), date('po_date', 'PO Date'), text('tender_no', 'Tender No.'),
      select('firm', 'Firm', FIRMS), text('client', 'Client', { required: true }), text('dept', 'Dept.'),
      text('item', 'Item'), text('make', 'Make'), num('qty', 'Qty'), money('po_value', 'PO Value'),
      date('client_delivery_due', 'Client Delivery Due'), text('vendor', 'Vendor'),
      text('vendor_po_no', 'Vendor PO No.'), date('vendor_po_date', 'Vendor PO Date'),
      money('vendor_po_value', 'Vendor PO Value', { cost: true }), money('margin', 'Margin', { cost: true, computed: true }),
      date('vendor_delivery_date', 'Vendor Delivery Date'), text('negotiated_by', 'Negotiated By'),
      select('pbg_sd', 'PBG / SD', ['Yes', 'No', 'Required']), select('po_copy_filed', 'PO Copy Filed', ['Yes', 'No']),
      select('status', 'Status', PO_STATUSES), text('remarks', 'Remarks'),
    ],
    statusKey: 'status',
    searchKeys: ['po_no', 'tender_no', 'client', 'dept', 'item', 'vendor', 'negotiated_by', 'remarks'],
    editTeams: ['Sales / Pre-Sales', 'Tendering'],
    defaultSort: { key: 'client_delivery_due', dir: 'asc' },
    rowClass: (r, t) => (FINISHED_PO.includes(String(r.status)) ? 'row-done' : typeof r.client_delivery_due === 'string' && r.client_delivery_due < t ? 'row-late' : ''),
  },
  {
    cardFields: ['po_no', 'client', 'delivery_status', 'next_followup'],
    id: 'logistics', title: 'Logistics', path: 'logistics', sheet: '4 Logistics',
    table: 'logistics', view: 'logistics_v',
    columns: [
      text('po_no', 'PO No.', { required: true, poPicker: true }),
      text('client', 'Client', { computed: true }), text('item', 'Item', { computed: true }),
      num('qty', 'Qty', { computed: true }), text('vendor', 'Vendor', { computed: true }),
      date('vendor_delivery_date', 'Vendor Delivery Date'), date('dispatch_date', 'Dispatch Date'),
      text('transporter', 'Transporter'), text('docket_no', 'Docket / LR No.'), text('transporter_contact', 'Transporter Contact'),
      date('delivered_date', 'Delivered Date'), text('invoice_no', 'Invoice No.'), text('challan_no', 'Challan No.'),
      select('installation', 'Installation / Commissioning', REQ), select('training', 'Training', REQ),
      select('delivery_status', 'Delivery Status', ['Vendor Pending', 'Material Ready', 'In Transit', 'Delivered', 'Partial', 'Rejected', 'Held']),
      date('last_followup', 'Last Follow-up'), date('next_followup', 'Next Follow-up'), text('remarks', 'Remarks'),
    ],
    statusKey: 'delivery_status',
    searchKeys: ['po_no', 'client', 'item', 'vendor', 'transporter', 'docket_no', 'remarks'],
    editTeams: ['Logistics Follow-up', 'Sales / Pre-Sales'],
    defaultSort: { key: 'next_followup', dir: 'asc' },
    rowClass: (r, t) => (r.delivery_status === 'Delivered' ? 'row-done' : ['Rejected', 'Held', 'Partial'].includes(String(r.delivery_status)) ? 'row-late' : due(r, t) ? 'row-due' : ''),
  },
  {
    cardFields: ['po_no', 'complaint', 'status', 'under_warranty'],
    id: 'service', title: 'Service', path: 'service', sheet: '5 Service (Warranty)',
    table: 'service_calls', view: 'service_v',
    columns: [
      text('po_no', 'PO No.', { required: true, poPicker: true }),
      text('client', 'Client', { computed: true }), text('item', 'Item', { computed: true }),
      date('commissioned_date', 'Commissioned Date'), num('warranty_months', 'Warranty (months)'),
      date('warranty_ends', 'Warranty Ends', { computed: true }), text('under_warranty', 'Under Warranty?', { computed: true }),
      text('complaint', 'Complaint', { required: true }), date('complaint_date', 'Complaint Date'), text('assigned_to', 'Assigned To'),
      select('status', 'Status', ['Open', 'In Progress', 'Closed']), date('closed_date', 'Closed Date'), text('remarks', 'Remarks'),
    ],
    statusKey: 'status',
    searchKeys: ['po_no', 'client', 'item', 'complaint', 'assigned_to', 'remarks'],
    editTeams: ['Sales / Pre-Sales', 'Logistics Follow-up'],
    defaultSort: { key: 'complaint_date', dir: 'desc' },
    rowClass: r => (r.status === 'Closed' ? 'row-done' : r.under_warranty === 'Expired' ? '' : ''),
  },
  {
    cardFields: ['item_spec', 'status', 'required_by', 'next_followup'],
    id: 'sourcing', title: 'Sourcing', path: 'sourcing', sheet: '6 Sourcing',
    table: 'sourcing', view: 'sourcing_v', costTable: { table: 'sourcing_costs', fk: 'sourcing_id' },
    columns: [
      date('entry_date', 'Date'), select('category', 'Category', ['Uniform', 'Cap', 'Laptop', 'IOT', 'Other']),
      text('item_spec', 'Item / Specification', { required: true }), num('qty', 'Qty'),
      text('tender_no', 'Tender No.'), text('po_no', 'PO No.'), date('required_by', 'Required By'),
      text('vendor1', 'Vendor 1'), money('rate1', 'Rate 1', { cost: true }),
      text('vendor2', 'Vendor 2'), money('rate2', 'Rate 2', { cost: true }),
      text('vendor3', 'Vendor 3'), money('rate3', 'Rate 3', { cost: true }),
      money('best_rate', 'Best Rate', { cost: true, computed: true }), text('best_vendor', 'Best Vendor', { cost: true, computed: true }),
      money('selling_rate', 'Our Selling Rate', { cost: true }), num('margin_pct', 'Margin %', { cost: true, computed: true }),
      select('sample', 'Sample', ['Not Needed', 'Requested', 'Received', 'Approved', 'Rejected']),
      num('lead_time_days', 'Lead Time (days)'), text('warranty', 'Warranty'), text('sourced_by', 'Sourced By'),
      select('status', 'Status', ['Enquiry Sent', 'Quotes Received', 'Rate Finalised', 'Vendor Confirmed', 'Closed']),
      date('next_followup', 'Next Follow-up'), text('remarks', 'Remarks'),
    ],
    statusKey: 'status',
    searchKeys: ['item_spec', 'category', 'tender_no', 'po_no', 'vendor1', 'vendor2', 'vendor3', 'sourced_by', 'remarks'],
    editTeams: ['Sourcing', 'Tendering', 'Sales / Pre-Sales'],
    defaultSort: { key: 'next_followup', dir: 'asc' },
    rowClass: (r, t) => (r.status === 'Closed' ? 'row-done' : due(r, t) ? 'row-due' : ''),
  },
]

export const trackerById = (id: string) => TRACKERS.find(t => t.id === id)!
