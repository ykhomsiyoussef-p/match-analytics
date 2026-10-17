import { asyncHandler } from '../utils/asyncHandler.js'
import * as userService from '../services/user.service.js'

export const list = asyncHandler(async (req, res) => {
  res.json({ users: await userService.listUsers() })
})

export const recipients = asyncHandler(async (req, res) => {
  res.json({ users: await userService.listRecipients(req.user) })
})

export const create = asyncHandler(async (req, res) => {
  res.status(201).json({ user: await userService.createUser(req.user, req.body, req.ip) })
})

export const update = asyncHandler(async (req, res) => {
  res.json({ user: await userService.updateUser(req.user, req.params.id, req.body, req.ip) })
})
