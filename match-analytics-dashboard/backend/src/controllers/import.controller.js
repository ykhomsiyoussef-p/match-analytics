import { asyncHandler } from '../utils/asyncHandler.js'
import * as importService from '../services/import.service.js'

export const preview = asyncHandler(async (req, res) => {
  res.json(await importService.previewImport(req.user, req.params.id, req.body.csv))
})

export const validate = asyncHandler(async (req, res) => {
  res.json({ report: await importService.validateImport(req.user, req.params.id, req.body) })
})

export const commit = asyncHandler(async (req, res) => {
  const result = await importService.commitImport(req.user, req.params.id, req.body, req.ip)
  res.status(201).json({ result })
})

export const list = asyncHandler(async (req, res) => {
  res.json({ imports: await importService.listImports(req.user, req.params.id) })
})

export const undo = asyncHandler(async (req, res) => {
  res.json(await importService.undoImport(req.user, req.params.id, req.params.batchId, req.ip))
})
