// ---------------------------------------------------------------------------
// Shared API-key encryption helpers for main-process services.
// Uses Electron safeStorage (OS keyring) when available, falls back to
// AES-256-GCM with a machine-derived key on systems without a keyring.
// ---------------------------------------------------------------------------

import * as crypto from 'crypto'
import * as os from 'os'
import * as fs from 'fs'
import {safeStorage} from 'electron'

// ---------------------------------------------------------------------------
// Machine-derived key (AES fallback for Linux without a keyring)
// ---------------------------------------------------------------------------

const AES_ALGORITHM = 'aes-256-gcm'
const PBKDF2_ITERATIONS = 100_000
const PBKDF2_KEY_LEN = 32 // 256-bit
const PBKDF2_DIGEST = 'sha512'
const FIXED_SALT = Buffer.from('hoarses-html-editor-api-key-salt', 'utf-8')

/**
 * Build a seed string from machine-specific data.
 * On Linux this reads /etc/machine-id; elsewhere it falls back to
 * hostname + username which is less unique but still per-machine.
 */
function getMachineSeed(): string {
    // Prefer /etc/machine-id (standard on systemd-based Linux distros)
    try {
        const machineId = fs.readFileSync('/etc/machine-id', 'utf-8').trim()
        if (machineId) return machineId
    } catch {
        // Not available — expected on Windows/macOS or minimal Linux installs
    }

    // Fallback: hostname + username
    const hostname = os.hostname() || 'unknown-host'
    const username = os.userInfo().username || 'unknown-user'
    return `${hostname}:${username}`
}

/** Derive a 256-bit AES key from machine-specific data. Cached after first call. */
let _derivedKey: Buffer | null = null
function getDerivedKey(): Buffer {
    if (_derivedKey) return _derivedKey
    const seed = getMachineSeed()
    _derivedKey = crypto.pbkdf2Sync(seed, FIXED_SALT, PBKDF2_ITERATIONS, PBKDF2_KEY_LEN, PBKDF2_DIGEST)
    return _derivedKey
}

// ---------------------------------------------------------------------------
// AES-256-GCM encrypt / decrypt
// ---------------------------------------------------------------------------

function aesEncrypt(plaintext: string): string {
    const key = getDerivedKey()
    const iv = crypto.randomBytes(12) // 96-bit IV for GCM
    const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
    const authTag = cipher.getAuthTag() // 128-bit tag
    // Pack as:  __AES__<iv>:<authTag>:<ciphertext>  (all hex)
    return `__AES__${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

function aesDecrypt(packed: string): string {
    const key = getDerivedKey()
    const body = packed.slice(7) // strip "__AES__"
    const [ivHex, tagHex, ctHex] = body.split(':')
    if (!ivHex || !tagHex || !ctHex) return ''
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(tagHex, 'hex')
    const ciphertext = Buffer.from(ctHex, 'hex')
    const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the OS-level keyring (Electron safeStorage) is in use.
 * `false` means we fall back to machine-derived AES — still encrypted, but
 * tied to the machine identity rather than a user keyring.
 */
export function isEncryptionSecure(): boolean {
    return safeStorage.isEncryptionAvailable()
}

/**
 * Encrypt a plaintext API key.
 * - Primary: Electron safeStorage (DPAPI / Keychain / libsecret)
 * - Fallback: AES-256-GCM with a machine-derived key
 */
export function encryptApiKey(plaintext: string): string {
    if (!plaintext) return ''
    if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.encryptString(plaintext).toString('base64')
    }
    // Fallback: AES-256-GCM with machine-derived key
    console.warn('[CryptoHelpers] OS-level keyring unavailable. Using AES-256-GCM with machine-derived key.')
    return Buffer.from(aesEncrypt(plaintext)).toString('base64')
}

/**
 * Decrypt a stored API key. Handles three formats:
 * 1. safeStorage-encrypted (binary blob)
 * 2. AES-256-GCM fallback (`__AES__` prefix after base64 decode)
 * 3. Legacy base64-obfuscated (`__PLAIN__` prefix after base64 decode)
 */
export function decryptApiKey(encoded: string): string {
    if (!encoded) return ''
    const buffer = Buffer.from(encoded, 'base64')

    // Try safeStorage first
    if (safeStorage.isEncryptionAvailable()) {
        try {
            return safeStorage.decryptString(buffer)
        } catch {
            // Fall through — may have been stored with a fallback encoder
        }
    }

    const text = buffer.toString('utf-8')

    // AES-256-GCM fallback
    if (text.startsWith('__AES__')) {
        try {
            return aesDecrypt(text)
        } catch {
            return ''
        }
    }

    // Legacy plain-text obfuscation (auto-migrated on next save)
    if (text.startsWith('__PLAIN__')) return text.slice(9)

    return ''
}

/**
 * Mask an API key for display in the renderer (e.g. "••••sk12").
 */
export const MASKED_KEY_PREFIX = '\u2022\u2022\u2022\u2022'

export function maskApiKey(apiKey: string): string {
    if (!apiKey) return ''
    if (apiKey.length <= 4) return MASKED_KEY_PREFIX
    return MASKED_KEY_PREFIX + apiKey.slice(-4)
}
