import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { env } from '../config/env.js'

// Stockage des vidéos sur le disque. Les clés sont générées par le serveur (jamais par l'utilisateur) :
// on refuse tout autre format pour interdire les chemins du type « ../../fichier ».
// Pour passer à un stockage S3, il suffira de réimplémenter ces fonctions.
const root = env.videoStorageDir
fs.mkdirSync(root, { recursive: true })

const KEY_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(mp4|webm|mov)$/

function resolveKey(key) {
  if (!KEY_PATTERN.test(key)) throw new Error('Clé de stockage invalide')
  return path.join(root, key)
}

export async function size(key) {
  try {
    return (await fsp.stat(resolveKey(key))).size
  } catch (err) {
    if (err.code === 'ENOENT') return 0
    throw err
  }
}

export async function append(key, buffer) {
  await fsp.appendFile(resolveKey(key), buffer)
}

export function createReadStream(key, range) {
  return fs.createReadStream(resolveKey(key), range)
}

export async function remove(key) {
  await fsp.rm(resolveKey(key), { force: true })
}

export async function readHead(key, length) {
  const handle = await fsp.open(resolveKey(key), 'r')
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

// Chemin complet d'un fichier (pour FFmpeg, qui lit et écrit directement sur le disque).
export function pathOf(key) {
  return resolveKey(key)
}
