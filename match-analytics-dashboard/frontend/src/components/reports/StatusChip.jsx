import { STATUS } from '../../data/reportSections.js'

export default function StatusChip({ status }) {
  const s = STATUS[status] || STATUS.brouillon
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.className}`}>{s.label}</span>
}
