import test from 'node:test'
import assert from 'node:assert/strict'
import { reportPermissions, nextStatus, TRANSITIONS } from '../src/reports/workflow.js'

const admin = { id: 1, role: 'admin' }
const author = { id: 2, role: 'analyste' }
const other = { id: 3, role: 'analyste' }
const coach = { id: 4, role: 'entraineur' }
const report = (status) => ({ authorId: 2, status })
const perms = (user, status, extra = {}) => reportPermissions({ user, report: report(status), ...extra })

test('un brouillon n\'est visible que par son auteur, le propriétaire du match et l\'administrateur', () => {
  assert.ok(perms(author, 'brouillon').canView)
  assert.ok(perms(admin, 'brouillon').canView)
  assert.ok(perms(other, 'brouillon', { isMatchOwner: true }).canView)
  assert.ok(!perms(other, 'brouillon').canView)
  assert.ok(!perms(coach, 'brouillon', { share: { canComment: true } }).canView, 'un partage n\'ouvre rien tant que le rapport n\'est pas partagé')
})

test('un destinataire voit le rapport seulement une fois partagé', () => {
  assert.ok(!perms(coach, 'valide', { share: { canComment: false } }).canView)
  assert.ok(perms(coach, 'partage', { share: { canComment: false } }).canView)
  assert.ok(!perms(coach, 'partage').canView, 'pas de partage pour cette personne')
})

test('modifiable avant validation, verrouillé ensuite', () => {
  assert.ok(perms(author, 'brouillon').canEdit)
  assert.ok(perms(author, 'en_validation').canEdit)
  assert.ok(!perms(author, 'valide').canEdit)
  assert.ok(!perms(author, 'partage').canEdit)
  assert.ok(!perms(coach, 'brouillon', { isMatchOwner: false }).canEdit)
  assert.ok(!perms(other, 'brouillon', { isMatchOwner: true }).canEdit, 'le propriétaire du match n\'est pas l\'auteur')
})

test('seul l\'administrateur valide ou rejette', () => {
  assert.ok(perms(admin, 'en_validation').canValidate)
  assert.ok(perms(admin, 'en_validation').canReject)
  assert.ok(!perms(author, 'en_validation').canValidate)
  assert.ok(!perms(admin, 'brouillon').canValidate)
})

test('partage : auteur ou administrateur, depuis l\'état validé', () => {
  assert.ok(perms(author, 'valide').canShare)
  assert.ok(!perms(author, 'brouillon').canShare)
  assert.ok(perms(author, 'partage').canUnshare)
  assert.ok(perms(author, 'valide').canManageShares)
  assert.ok(!perms(author, 'brouillon').canManageShares)
  assert.ok(!perms(coach, 'partage', { share: { canComment: true } }).canManageShares)
})

test('commentaires : seulement sur un rapport partagé, et avec le droit de commenter', () => {
  assert.ok(perms(coach, 'partage', { share: { canComment: true } }).canComment)
  assert.ok(!perms(coach, 'partage', { share: { canComment: false } }).canComment)
  assert.ok(!perms(coach, 'valide', { share: { canComment: true } }).canComment)
  assert.ok(perms(author, 'partage').canComment)
})

test('un auteur devenu entraîneur perd la gestion du rapport', () => {
  const demoted = { id: 2, role: 'entraineur' }
  assert.ok(!perms(demoted, 'brouillon').canEdit)
})

test('machine d\'états : transitions autorisées et refus', () => {
  const step = (action, status, user = admin) => nextStatus(action, status, perms(user, status))
  assert.equal(step('submit', 'brouillon', author).status, 'en_validation')
  assert.equal(step('validate', 'en_validation').status, 'valide')
  assert.equal(step('reject', 'en_validation').status, 'brouillon')
  assert.equal(step('share', 'valide', author).status, 'partage')
  assert.equal(step('unshare', 'partage', author).status, 'valide')
  assert.equal(step('reopen', 'partage', author).status, 'brouillon')
  assert.equal(step('validate', 'brouillon').error.code, 409, 'mauvais état')
  assert.equal(step('validate', 'en_validation', author).error.code, 403, 'pas administrateur')
  assert.equal(step('inconnue', 'brouillon').error.code, 400)
  assert.equal(Object.keys(TRANSITIONS).length, 6)
})

test('on ne peut jamais sauter une étape vers « partagé »', () => {
  for (const status of ['brouillon', 'en_validation']) {
    assert.ok(nextStatus('share', status, perms(admin, status)).error)
  }
})
