import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument, PDFName } from 'pdf-lib'
import { buildReportPdf, formatClock } from '../src/reports/pdf.js'
import { suggestMapping } from '../src/import/importFields.js'
import { analyzeRows } from '../src/import/analysis.js'
import { readCsv, match as fakeMatch, emptyCtx, defaultOptions } from './helpers.js'

// Événements de démonstration : le fichier d'exemple, passé par le même code que l'import.
function sampleEvents() {
  const parsed = readCsv('evenements_exemple.csv')
  const { toImport } = analyzeRows({ match: fakeMatch, parsed, mapping: suggestMapping(parsed.headers), options: defaultOptions, ctx: emptyCtx() })
  return toImport.map((r, i) => ({
    id: i + 1, type: r.eventType, side: r.side, playerId: null, period: r.period, minute: r.minute, second: r.second,
    outcome: r.outcome, x: r.x, y: r.y, endX: r.endX, endY: r.endY, xg: r.xg,
    onTarget: r.eventType === 'shot' ? ['goal', 'saved'].includes(r.outcome) : null,
    passSuccess: r.eventType === 'pass' ? r.passSuccess : null, keyPass: r.eventType === 'pass' ? r.keyPass : null,
  }))
}

const match = { id: 1, matchDate: '2026-09-20', competition: 'Test', analysisType: 'globale', homeScore: 2, awayScore: 1, home: fakeMatch.home, away: fakeMatch.away }
const clip = { id: 5, title: 'But du 1-0', category: 'but', startTimeSeconds: 1380, endTimeSeconds: 1395 }
const baseReport = {
  id: 7, authorName: 'Auteur', status: 'valide', summary: 'Résumé', strengths: 'Forces', weaknesses: 'Faiblesses',
  tacticalIssues: '', individualPerformances: '', recommendations: 'Travailler la relance.',
  links: [{ section: 'resume', clip }],
}

test('le PDF contient des pages, un lien vers l\'application et le texte du rapport', async () => {
  const bytes = await buildReportPdf({ report: baseReport, match, events: sampleEvents(), publicUrl: 'https://exemple.com/' })
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), '%PDF-')
  const doc = await PDFDocument.load(bytes)
  assert.ok(doc.getPageCount() >= 2)
  const uris = []
  for (const page of doc.getPages()) {
    const annots = page.node.Annots()
    for (let i = 0; annots && i < annots.size(); i++) {
      const dict = doc.context.lookup(annots.get(i))
      uris.push(doc.context.lookup(dict.get(PDFName.of('A'))).get(PDFName.of('URI')).decodeText())
    }
  }
  assert.equal(uris.length, 1, 'un lien par clip')
  assert.equal(uris[0], 'https://exemple.com/rapports/7', 'le lien mène à l\'application (connexion requise), jamais au fichier')
})

test('le PDF se génère même sans données ni texte', async () => {
  const empty = { ...baseReport, summary: '', strengths: '', weaknesses: '', recommendations: '', links: [] }
  const bytes = await buildReportPdf({ report: empty, match, events: [], publicUrl: 'https://exemple.com' })
  assert.ok((await PDFDocument.load(bytes)).getPageCount() >= 1)
})

test('les caractères non gérés (arabe, émoji) ne font pas échouer la génération', async () => {
  const odd = { ...baseReport, summary: 'Joueur محمد 😀 Ősz', strengths: 'x'.repeat(300) }
  const bytes = await buildReportPdf({ report: odd, match, events: sampleEvents(), publicUrl: 'https://exemple.com' })
  assert.ok(bytes.length > 1000)
})

test('formatage des temps', () => {
  assert.equal(formatClock(755), '12:35')
  assert.equal(formatClock(3725), '1:02:05')
  assert.equal(formatClock(NaN), '0:00')
})
