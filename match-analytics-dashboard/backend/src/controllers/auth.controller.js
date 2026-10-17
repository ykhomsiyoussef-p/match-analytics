import { asyncHandler } from '../utils/asyncHandler.js'
import * as authService from '../services/auth.service.js'
import * as userService from '../services/user.service.js'

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  res.json(await authService.login(email, password, req.ip))
})

export const me = (req, res) => {
  res.json({ user: req.user })
}

export const changePassword = asyncHandler(async (req, res) => {
  res.json(await userService.changeOwnPassword(req.user, req.body, req.ip))
})
