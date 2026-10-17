import test from 'node:test'
import assert from 'node:assert/strict'
import { checkPassword } from '../src/users/password.js'

test('mots de passe refusés', () => {
  assert.match(checkPassword('court'), /10 caractères/)
  assert.match(checkPassword('aaaaaaaaaaaa'), /répétitif/)
  assert.match(checkPassword('1234567890'), /courant/)
  assert.match(checkPassword('youssef.khomsi2026', 'youssef.khomsi@exemple.com'), /e-mail/)
  assert.ok(checkPassword('x'.repeat(201)))
})

test('mots de passe acceptés', () => {
  assert.equal(checkPassword('Un bon mot de passe 2026!'), null)
  assert.equal(checkPassword('t7#Kq9vLw2', 'a@b.com'), null)
})
