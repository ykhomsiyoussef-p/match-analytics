import { asyncHandler } from '../utils/asyncHandler.js'
import * as matchService from '../services/match.service.js'

export const listMatches = asyncHandler(async (req, res) => {
  res.json({ matches: await matchService.listMatches(req.user) })
})

export const getMatch = asyncHandler(async (req, res) => {
  res.json({ match: await matchService.getMatch(req.user, req.params.id) })
})

export const createMatch = asyncHandler(async (req, res) => {
  const match = await matchService.createMatch(req.user, req.body, req.ip)
  res.status(201).json({ match })
})

export const getMatchDashboard = asyncHandler(async (req, res) => {
  res.json(await matchService.getMatchDashboard(req.user, req.params.id))
})

export const getRoster = asyncHandler(async (req, res) => {
  res.json({ roster: await matchService.getRoster(req.user, req.params.id) })
})

export const getMatchDataset = asyncHandler(async (req, res) => {
  res.json(await matchService.getMatchDataset(req.user, req.params.id))
})
