import { asyncHandler } from '../utils/asyncHandler.js'
import * as reportService from '../services/report.service.js'

export const list = asyncHandler(async (req, res) => {
  res.json({ reports: await reportService.listReports(req.user, req.query.matchId) })
})

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await reportService.createReport(req.user, req.body.matchId, req.ip))
})

export const get = asyncHandler(async (req, res) => {
  res.json(await reportService.getReport(req.user, req.params.id))
})

export const update = asyncHandler(async (req, res) => {
  res.json(await reportService.updateReport(req.user, req.params.id, req.body, req.ip))
})

export const transition = asyncHandler(async (req, res) => {
  res.json(await reportService.transitionReport(req.user, req.params.id, req.body.action, req.ip))
})

export const shares = asyncHandler(async (req, res) => {
  res.json(await reportService.setShares(req.user, req.params.id, req.body.shares, req.ip))
})

export const comment = asyncHandler(async (req, res) => {
  res.status(201).json(await reportService.addComment(req.user, req.params.id, req.body.body, req.ip))
})

export const attachables = asyncHandler(async (req, res) => {
  res.json(await reportService.listAttachables(req.user, req.params.id))
})

export const clipPlayback = asyncHandler(async (req, res) => {
  res.json(await reportService.createReportClipPlaybackUrl(req.user, req.params.id, req.params.clipId))
})

export const pdf = asyncHandler(async (req, res) => {
  const { bytes, filename } = await reportService.buildPdf(req.user, req.params.id, req.ip)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Cache-Control', 'private, no-store')
  res.send(Buffer.from(bytes))
})
