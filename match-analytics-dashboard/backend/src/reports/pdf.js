import { PDFDocument, StandardFonts, rgb, PDFName, PDFString } from 'pdf-lib'
import { computeStats, availability, filterEvents } from './analytics.js'

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 40
const CONTENT_W = PAGE_W - MARGIN * 2

const C = {
  ink: rgb(0.1, 0.13, 0.12),
  muted: rgb(0.4, 0.45, 0.43),
  line: rgb(0.82, 0.86, 0.84),
  home: rgb(0.1, 0.55, 0.34),
  away: rgb(0.85, 0.47, 0.04),
  pitch: rgb(0.94, 0.97, 0.95),
  pitchLine: rgb(0.5, 0.65, 0.57),
  band: rgb(0.93, 0.96, 0.94),
}

const SECTIONS = [
  { key: 'summary', link: 'resume', label: 'Résumé du match' },
  { key: 'strengths', link: 'points_forts', label: "Points forts de l'équipe" },
  { key: 'weaknesses', link: 'faiblesses', label: 'Faiblesses observées' },
  { key: 'tacticalIssues', link: 'problemes_tactiques', label: 'Problèmes tactiques' },
  { key: 'individualPerformances', link: 'performances_individuelles', label: 'Performances individuelles' },
  { key: 'recommendations', link: 'recommandations', label: 'Recommandations pour les prochaines séances' },
]

const STATUS_LABEL = {
  brouillon: 'Brouillon',
  en_validation: 'En cours de validation',
  valide: 'Validé',
  partage: 'Partagé',
}
const ANALYSIS_LABEL = {
  globale: 'Analyse globale',
  offensive: 'Phase offensive',
  defensive: 'Phase défensive',
  coups_arretes: 'Coups de pied arrêtés',
  individuelle: 'Analyse individuelle',
}
const CATEGORY_LABEL = {
  but: 'But', tir: 'Tir', passe_cle: 'Passe clé', organisation_offensive: 'Organisation offensive',
  organisation_defensive: 'Organisation défensive', transition_offensive: 'Transition offensive',
  transition_defensive: 'Transition défensive', coup_de_pied_arrete: 'Coup de pied arrêté',
  erreur_individuelle: 'Erreur individuelle', point_fort: 'Point fort', point_a_ameliorer: 'Point à améliorer',
  commentaire_libre: 'Commentaire libre',
}

export function formatClock(seconds) {
  const total = Math.floor(Number.isFinite(seconds) && seconds > 0 ? seconds : 0)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

// Polices standard : seul l'alphabet latin d'Europe de l'Ouest (WinAnsi) est géré.
// Tout autre caractère est remplacé par « ? » plutôt que de faire échouer la génération.
function makeSanitizer(font) {
  const cache = new Map()
  const okChar = (ch) => {
    if (!cache.has(ch)) {
      let ok = true
      try {
        font.encodeText(ch)
      } catch {
        ok = false
      }
      cache.set(ch, ok)
    }
    return cache.get(ch)
  }
  return (text) => {
    let out = ''
    for (const ch of String(text ?? '').replace(/\r\n?/g, '\n')) {
      if (ch === '\n' || okChar(ch)) {
        out += ch
        continue
      }
      // Essaie de retirer l'accent (« ő » -> « o »), sinon « ? ».
      const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      out += base !== ch && [...base].every(okChar) ? base : '?'
    }
    return out
  }
}

class Writer {
  constructor(doc, fonts) {
    this.doc = doc
    this.fonts = fonts
    this.safe = makeSanitizer(fonts.regular)
    this.newPage()
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H])
    this.y = PAGE_H - MARGIN
  }

  ensure(height) {
    if (this.y - height < MARGIN + 20) this.newPage()
  }

  wrap(text, font, size, maxWidth) {
    const lines = []
    for (const paragraph of this.safe(text).split('\n')) {
      if (paragraph.trim() === '') {
        lines.push('')
        continue
      }
      let line = ''
      for (const word of paragraph.split(/\s+/)) {
        let w = word
        // Mot plus long que la ligne : on le coupe.
        while (font.widthOfTextAtSize(w, size) > maxWidth) {
          let cut = w.length - 1
          while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxWidth) cut--
          if (line) {
            lines.push(line)
            line = ''
          }
          lines.push(w.slice(0, cut))
          w = w.slice(cut)
        }
        const candidate = line ? `${line} ${w}` : w
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate
        else {
          lines.push(line)
          line = w
        }
      }
      lines.push(line)
    }
    return lines
  }

  // Écrit un paragraphe avec retour à la ligne et saut de page automatiques.
  text(str, { size = 10, font = this.fonts.regular, color = C.ink, x = MARGIN, width = CONTENT_W, lineGap = 3 } = {}) {
    const lh = size + lineGap
    for (const line of this.wrap(str, font, size, width)) {
      this.ensure(lh)
      if (line) this.page.drawText(line, { x, y: this.y - size, size, font, color })
      this.y -= lh
    }
  }

  // keep : hauteur du contenu qui suit, pour ne pas laisser un titre seul en bas de page.
  heading(str, size = 14, keep = 0) {
    this.ensure(size + 30 + keep)
    this.y -= 10
    this.page.drawText(this.safe(str), { x: MARGIN, y: this.y - size, size, font: this.fonts.bold, color: C.ink })
    this.y -= size + 4
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness: 0.8, color: C.line })
    this.y -= 8
  }

  link(x, y, w, h, url) {
    const ref = this.doc.context.register(
      this.doc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [x, y, x + w, y + h],
        Border: [0, 0, 0],
        A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
      })
    )
    const existing = this.page.node.Annots()
    if (existing) existing.push(ref)
    else this.page.node.set(PDFName.of('Annots'), this.doc.context.obj([ref]))
  }
}

// ---------- terrain et cartes (vectoriel, couleurs adaptées à l'impression) ----------
function drawPitch(page, x0, yTop, width) {
  const k = width / 105
  const height = 68 * k
  const px = (xm) => x0 + xm * k
  const py = (ym) => yTop - ym * k
  const line = (a, b, c, d) =>
    page.drawLine({ start: { x: px(a), y: py(b) }, end: { x: px(c), y: py(d) }, thickness: 0.6, color: C.pitchLine })
  const rect = (a, b, w, h) =>
    page.drawRectangle({ x: px(a), y: py(b + h), width: w * k, height: h * k, borderColor: C.pitchLine, borderWidth: 0.6 })
  const arc = (cx, cy, r, from, to) => {
    const steps = 24
    let prev = null
    for (let i = 0; i <= steps; i++) {
      const a = ((from + ((to - from) * i) / steps) * Math.PI) / 180
      const p = [cx + r * Math.cos(a), cy + r * Math.sin(a)]
      if (prev) line(prev[0], prev[1], p[0], p[1])
      prev = p
    }
  }

  page.drawRectangle({ x: x0, y: py(68), width, height, color: C.pitch })
  rect(0, 0, 105, 68)
  line(52.5, 0, 52.5, 68)
  arc(52.5, 34, 9.15, 0, 360)
  rect(0, 13.84, 16.5, 40.32)
  rect(88.5, 13.84, 16.5, 40.32)
  rect(0, 24.84, 5.5, 18.32)
  rect(99.5, 24.84, 5.5, 18.32)
  arc(11, 34, 9.15, -52.4, 52.4)
  arc(94, 34, 9.15, 127.6, 232.4)
  return { height, to: (xp, yp) => [px(xp * 1.05), py(yp * 0.68)] }
}

function drawShotMap(w, shots) {
  const drawn = shots.filter((s) => s.x !== null && s.y !== null)
  w.ensure(CONTENT_W * (68 / 105) + 10)
  const pitch = drawPitch(w.page, MARGIN, w.y, CONTENT_W)
  const colorOf = (side) => (side === 'home' ? C.home : C.away)
  for (const s of drawn) {
    const [cx, cy] = pitch.to(s.x, s.y)
    const r = s.xg === null ? 3.6 : 2 + s.xg * 7
    const color = colorOf(s.side)
    if (s.endX !== null && s.endY !== null && s.onTarget) {
      const [ex, ey] = pitch.to(s.endX, s.endY)
      w.page.drawLine({ start: { x: cx, y: cy }, end: { x: ex, y: ey }, thickness: 0.4, color, opacity: 0.5 })
    }
    if (s.outcome === 'goal') w.page.drawCircle({ x: cx, y: cy, size: r + 2.2, borderColor: C.ink, borderWidth: 0.8 })
    w.page.drawCircle({
      x: cx,
      y: cy,
      size: r,
      color: s.onTarget ? color : undefined,
      opacity: 0.9,
      borderColor: color,
      borderWidth: s.onTarget ? 0.4 : 1.2,
    })
  }
  w.y -= pitch.height + 8
  return drawn.length
}

function drawArrow(page, x1, y1, x2, y2, color, thickness, dashed) {
  const opts = { start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color, opacity: dashed ? 0.9 : 0.6 }
  if (dashed) opts.dashArray = [2.5, 2]
  page.drawLine(opts)
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const head = 3.2
  for (const sign of [-1, 1]) {
    const a = angle + Math.PI + sign * 0.45
    page.drawLine({ start: { x: x2, y: y2 }, end: { x: x2 + head * Math.cos(a), y: y2 + head * Math.sin(a) }, thickness, color, opacity: 0.8 })
  }
}

function drawPassMaps(w, passes, teamNames) {
  const gap = 15
  const width = (CONTENT_W - gap) / 2
  const height = width * (68 / 105)
  w.ensure(height + 22)
  let total = 0
  for (const [i, side] of ['home', 'away'].entries()) {
    const x0 = MARGIN + i * (width + gap)
    w.page.drawText(w.safe(teamNames[side]), { x: x0, y: w.y - 10, size: 9, font: w.fonts.bold, color: side === 'home' ? C.home : C.away })
    const pitch = drawPitch(w.page, x0, w.y - 14, width)
    const list = passes.filter((p) => p.side === side && p.x !== null && p.endX !== null)
    total += list.length
    for (const p of list) {
      const [x1, y1] = pitch.to(p.x, p.y)
      const [x2, y2] = pitch.to(p.endX, p.endY)
      const key = p.keyPass === true
      drawArrow(w.page, x1, y1, x2, y2, side === 'home' ? C.home : C.away, key ? 1.2 : 0.4, p.passSuccess === false)
    }
  }
  w.y -= height + 22
  return total
}

// ---------- tableau de statistiques et graphique ----------
const STAT_ROWS = [
  ['shots', 'Tirs', 'shots'], ['shotsOnTarget', 'Tirs cadrés', 'shots'], ['goals', 'Buts', 'shots'],
  ['xg', 'xG', 'xg'], ['passes', 'Passes', 'passes'], ['passesOk', 'Passes réussies', 'passes'],
  ['passAccuracy', 'Précision des passes', 'passes', '%'], ['keyPasses', 'Passes clés', 'passes'],
  ['corners', 'Corners', 'corners'], ['interceptions', 'Interceptions', 'interceptions'],
  ['duels', 'Duels', 'duels'], ['duelsWon', 'Duels gagnés', 'duels'],
]

function drawStatsTable(w, events, names) {
  const home = computeStats(events.filter((e) => e.side === 'home'))
  const away = computeStats(events.filter((e) => e.side === 'away'))
  const has = availability(events)
  const colX = [MARGIN, MARGIN + 290, MARGIN + 400]
  const rowH = 17

  w.ensure(rowH * (STAT_ROWS.length + 2))
  w.page.drawRectangle({ x: MARGIN, y: w.y - rowH, width: CONTENT_W, height: rowH, color: C.band })
  w.page.drawText('Statistique', { x: colX[0] + 6, y: w.y - 12, size: 9, font: w.fonts.bold, color: C.muted })
  w.page.drawText(w.safe(names.home), { x: colX[1], y: w.y - 12, size: 9, font: w.fonts.bold, color: C.home })
  w.page.drawText(w.safe(names.away), { x: colX[2], y: w.y - 12, size: 9, font: w.fonts.bold, color: C.away })
  w.y -= rowH

  for (const [key, label, need, suffix = ''] of STAT_ROWS) {
    const show = (v) => (!has[need] || v === null || v === undefined ? '—' : `${v}${suffix}`)
    w.page.drawText(w.safe(label), { x: colX[0] + 6, y: w.y - 12, size: 9, font: w.fonts.regular, color: C.ink })
    w.page.drawText(w.safe(show(home[key])), { x: colX[1], y: w.y - 12, size: 9, font: w.fonts.regular, color: C.ink })
    w.page.drawText(w.safe(show(away[key])), { x: colX[2], y: w.y - 12, size: 9, font: w.fonts.regular, color: C.ink })
    w.page.drawLine({ start: { x: MARGIN, y: w.y - rowH }, end: { x: PAGE_W - MARGIN, y: w.y - rowH }, thickness: 0.4, color: C.line })
    w.y -= rowH
  }
  w.y -= 4
  w.text("« — » : aucune donnée de ce type dans les fichiers importés. La possession n'est pas calculée (aucune source).", { size: 8, color: C.muted })
  return { home, away, has }
}

function drawBarChart(w, stats, names) {
  const metrics = [
    ['shots', 'Tirs', 'shots'], ['shotsOnTarget', 'Cadrés', 'shots'], ['corners', 'Corners', 'corners'],
    ['interceptions', 'Interceptions', 'interceptions'],
  ].filter(([, , need]) => stats.has[need])
  if (metrics.length === 0) return
  const maxValue = Math.max(1, ...metrics.flatMap(([k]) => [stats.home[k], stats.away[k]]))
  const chartH = 90
  const groupW = CONTENT_W / metrics.length
  const barW = Math.min(34, groupW / 3)
  w.ensure(chartH + 40)
  const base = w.y - chartH - 6
  w.page.drawLine({ start: { x: MARGIN, y: base }, end: { x: PAGE_W - MARGIN, y: base }, thickness: 0.6, color: C.line })
  metrics.forEach(([key, label], i) => {
    const gx = MARGIN + i * groupW + groupW / 2
    ;[['home', stats.home[key], C.home, -barW - 2], ['away', stats.away[key], C.away, 2]].forEach(([, value, color, dx]) => {
      const h = (value / maxValue) * (chartH - 14)
      w.page.drawRectangle({ x: gx + dx, y: base, width: barW, height: Math.max(h, 0.5), color })
      const label = String(value)
      w.page.drawText(label, { x: gx + dx + barW / 2 - w.fonts.regular.widthOfTextAtSize(label, 8) / 2, y: base + h + 3, size: 8, font: w.fonts.regular, color: C.ink })
    })
    const lw = w.fonts.regular.widthOfTextAtSize(label, 8.5)
    w.page.drawText(w.safe(label), { x: gx - lw / 2, y: base - 12, size: 8.5, font: w.fonts.regular, color: C.muted })
  })
  w.y = base - 32
  const legend = (x, color, text) => {
    w.page.drawRectangle({ x, y: w.y - 1, width: 8, height: 8, color })
    w.page.drawText(w.safe(text), { x: x + 12, y: w.y, size: 8.5, font: w.fonts.regular, color: C.ink })
  }
  legend(MARGIN, C.home, names.home)
  legend(MARGIN + 160, C.away, names.away)
  w.y -= 16
}

// ---------- document complet ----------
// data : { report, match, events, publicUrl, generatedAt }
// report.links : éléments liés [{ section, annotation?, clip? }] déjà chargés par le service.
export async function buildReportPdf({ report, match, events, publicUrl, generatedAt = new Date() }) {
  const doc = await PDFDocument.create()
  doc.setTitle(`Rapport d'analyse : ${match.home.name} contre ${match.away.name}`)
  doc.setCreator('Match Analytics Dashboard')
  doc.setProducer('Match Analytics Dashboard')
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  }
  const w = new Writer(doc, fonts)
  const names = { home: match.home.name, away: match.away.name }

  // En-tête
  w.page.drawText("RAPPORT D'ANALYSE", { x: MARGIN, y: w.y - 9, size: 9, font: fonts.bold, color: C.muted })
  w.y -= 18
  const title = `${names.home}  ${match.homeScore} : ${match.awayScore}  ${names.away}`
  w.text(title, { size: 20, font: fonts.bold })
  w.y -= 2
  const meta = [
    ['Date du match', match.matchDate],
    ['Compétition', match.competition || 'Non renseignée'],
    ["Type d'analyse", ANALYSIS_LABEL[match.analysisType] || match.analysisType],
    ['Auteur', report.authorName],
    ['Statut du rapport', STATUS_LABEL[report.status] || report.status],
    ['Généré le', generatedAt.toISOString().slice(0, 10)],
  ]
  for (const [label, value] of meta) {
    w.ensure(14)
    w.page.drawText(w.safe(label), { x: MARGIN, y: w.y - 9, size: 9, font: fonts.regular, color: C.muted })
    w.page.drawText(w.safe(value), { x: MARGIN + 110, y: w.y - 9, size: 9, font: fonts.bold, color: C.ink })
    w.y -= 14
  }

  // Statistiques
  w.heading('Statistiques principales', 14, 120)
  const stats = drawStatsTable(w, events, names)
  w.y -= 6
  drawBarChart(w, stats, names)

  // Cartes
  w.heading('Carte des tirs', 14, CONTENT_W * (68 / 105) + 30)
  const shots = filterEvents(events, { type: 'shot' })
  if (shots.some((s) => s.x !== null)) {
    const drawn = drawShotMap(w, shots)
    w.text(`${drawn} tirs placés sur ${shots.length}. Plein : cadré, anneau : but, vide : non cadré ou contré. Vert : ${names.home}. Orange : ${names.away}.`, { size: 8, color: C.muted })
  } else {
    w.text('Aucun tir avec coordonnées dans les données importées.', { size: 9, color: C.muted })
  }

  w.heading('Cartes des passes', 14, ((CONTENT_W - 15) / 2) * (68 / 105) + 50)
  const passes = filterEvents(events, { type: 'pass' })
  if (passes.some((p) => p.x !== null && p.endX !== null)) {
    const total = drawPassMaps(w, passes, names)
    w.text(`${total} passes affichées. Trait plein : réussie, pointillés : ratée, trait épais : passe clé.`, { size: 8, color: C.muted })
  } else {
    w.text('Aucune passe avec coordonnées de départ et d\'arrivée dans les données importées.', { size: 9, color: C.muted })
  }

  // Observations de l'analyste
  w.heading("Observations de l'analyste")
  for (const section of SECTIONS) {
    const content = (report[section.key] || '').trim()
    w.ensure(40)
    w.text(section.label, { size: 11, font: fonts.bold })
    if (content) w.text(content, { size: 10 })
    else w.text('Non renseigné.', { size: 9.5, font: fonts.italic, color: C.muted })
    for (const item of report.links.filter((l) => l.section === section.link)) {
      if (item.clip) {
        w.text(`Clip : ${item.clip.title} (${formatClock(item.clip.startTimeSeconds)} à ${formatClock(item.clip.endTimeSeconds)})`, { size: 9, color: C.muted, x: MARGIN + 12, width: CONTENT_W - 12 })
      } else if (item.annotation) {
        w.text(`Annotation : ${item.annotation.title} (vidéo à ${formatClock(item.annotation.startTimeSeconds)})`, { size: 9, color: C.muted, x: MARGIN + 12, width: CONTENT_W - 12 })
      }
    }
    w.y -= 6
  }

  // Clips
  w.heading('Clips associés')
  const clips = report.links.filter((l) => l.clip).map((l) => l.clip)
  const seen = new Set()
  const uniqueClips = clips.filter((c) => (seen.has(c.id) ? false : seen.add(c.id)))
  if (uniqueClips.length === 0) {
    w.text('Aucun clip associé à ce rapport.', { size: 9.5, color: C.muted })
  } else {
    const reportUrl = `${publicUrl.replace(/\/$/, '')}/rapports/${report.id}`
    w.text('Les clips se regardent dans l\'application, après connexion : seules les personnes autorisées y ont accès.', { size: 9, color: C.muted })
    w.y -= 4
    for (const c of uniqueClips) {
      w.ensure(30)
      const category = CATEGORY_LABEL[c.category] || c.category
      w.text(c.title, { size: 10, font: fonts.bold })
      w.text(`${formatClock(c.startTimeSeconds)} à ${formatClock(c.endTimeSeconds)} (${Math.round(c.endTimeSeconds - c.startTimeSeconds)} s), ${category}`, { size: 9, color: C.muted })
      const label = `Ouvrir dans l'application : ${reportUrl}`
      const safeLabel = w.safe(label)
      const tw = fonts.regular.widthOfTextAtSize(safeLabel, 9)
      w.ensure(14)
      w.page.drawText(safeLabel, { x: MARGIN, y: w.y - 9, size: 9, font: fonts.regular, color: rgb(0.05, 0.35, 0.7) })
      w.link(MARGIN, w.y - 11, Math.min(tw, CONTENT_W), 12, reportUrl)
      w.y -= 20
    }
  }

  // Pieds de page
  const pages = doc.getPages()
  pages.forEach((page, i) => {
    const text = w.safe(`Match Analytics Dashboard, rapport n° ${report.id}, document confidentiel`)
    page.drawText(text, { x: MARGIN, y: 22, size: 8, font: fonts.regular, color: C.muted })
    const num = `Page ${i + 1} sur ${pages.length}`
    page.drawText(num, { x: PAGE_W - MARGIN - fonts.regular.widthOfTextAtSize(num, 8), y: 22, size: 8, font: fonts.regular, color: C.muted })
  })

  return doc.save()
}
