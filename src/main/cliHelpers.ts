import { execFile } from 'child_process'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

type CliProvider = 'claude-cli' | 'codex-cli' | 'gemini-cli' | 'github-cli' | 'junie-cli'
type CliBinary = 'claude' | 'codex' | 'gemini' | 'copilot' | 'junie'

const LOOKUP_TIMEOUT_MS = 10_000
const DEFAULT_CHAT_TIMEOUT_MS = 120_000
const MAX_CLI_MODELS = 80

export const CLI_BINARY_NAMES: Record<CliProvider, CliBinary> = {
    'claude-cli': 'claude',
    'codex-cli': 'codex',
    'gemini-cli': 'gemini',
    'github-cli': 'copilot',
    'junie-cli': 'junie'
}

function getNonEmptyLines(value: string): string[] {
    return value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
}

function getFirstNonEmptyLine(value: string): string | undefined {
    return getNonEmptyLines(value)[0]
}

function uniqueNonEmpty(values: Array<string | undefined>): string[] {
    const seen = new Set<string>()
    const result: string[] = []
    for (const value of values) {
        const model = value?.trim()
        if (!model || seen.has(model)) continue
        seen.add(model)
        result.push(model)
    }
    return result
}

function getTrimmedString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
}

async function readJsonFile(filePath: string): Promise<any | null> {
    try {
        return JSON.parse(await fs.readFile(filePath, 'utf-8'))
    } catch {
        return null
    }
}

async function readTextFile(filePath: string): Promise<string> {
    try {
        return await fs.readFile(filePath, 'utf-8')
    } catch {
        return ''
    }
}

function readTopLevelTomlString(content: string, key: string): string | undefined {
    let inTopLevel = true
    const keyPattern = new RegExp(`^${key}\\s*=\\s*["']([^"']+)["']\\s*$`)

    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        if (line.startsWith('[')) {
            inTopLevel = false
            continue
        }
        if (!inTopLevel) continue
        const match = line.match(keyPattern)
        if (match) return match[1]
    }

    return undefined
}

function modelsWithFallback(models: string[], fallbackModels: string[]): string[] {
    return uniqueNonEmpty([...models, ...fallbackModels]).slice(0, MAX_CLI_MODELS)
}

function parseCopilotHelpConfigModels(stdout: string): string[] {
    const models: string[] = []
    let inModelSection = false

    for (const rawLine of stdout.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (line.startsWith('`model`:')) {
            inModelSection = true
            continue
        }
        if (!inModelSection) continue
        if (line.startsWith('`') && !line.startsWith('`model`:')) break

        const match = line.match(/^-\s+"([^"]+)"$/)
        if (match) models.push(match[1])
    }

    return uniqueNonEmpty(models)
}

function pickWindowsBinaryPath(paths: string[]): string | undefined {
    const preferredExtensions = ['.exe', '.cmd', '.bat']
    for (const extension of preferredExtensions) {
        const found = paths.find((item) => path.extname(item).toLowerCase() === extension)
        if (found) return found
    }
    return paths[0]
}

function isWindowsCommandShim(binary: string): boolean {
    if (process.platform !== 'win32') return false
    const extension = path.extname(binary).toLowerCase()
    return extension === '.cmd' || extension === '.bat'
}

function validateWindowsCommandShimArgs(args: string[]): void {
    const unsafe = /["&|<>^%!\r\n]/
    const unsafeArg = args.find((arg) => unsafe.test(arg))
    if (unsafeArg !== undefined) {
        throw new Error(`Unsafe CLI argument for Windows command shim: ${unsafeArg}`)
    }
}

function getProcessInvocation(binary: string, args: string[]): { binary: string; args: string[] } {
    if (!isWindowsCommandShim(binary)) {
        return { binary, args }
    }

    validateWindowsCommandShimArgs(args)
    return {
        binary: process.env.ComSpec || 'cmd.exe',
        args: ['/d', '/c', binary, ...args]
    }
}

function getCliChildEnv(): NodeJS.ProcessEnv {
    const env = { ...process.env }
    env.COLUMNS = '20000'
    env.NO_COLOR = '1'
    delete env.ELECTRON_RUN_AS_NODE
    delete env.NODE_OPTIONS
    delete env.VSCODE_INSPECTOR_OPTIONS
    delete env.NODE_INSPECT_RESUME_ON_START
    return env
}

function runProcess(
    binary: string,
    args: string[],
    stdinContent?: string,
    timeoutMs = LOOKUP_TIMEOUT_MS
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
        let settled = false
        let timeout: NodeJS.Timeout | undefined
        let stdinError: Error | undefined
        const invocation = getProcessInvocation(binary, args)
        let child: ReturnType<typeof execFile>

        try {
            child = execFile(invocation.binary, invocation.args, { env: getCliChildEnv(), windowsHide: true }, (error, stdout, stderr) => {
                if (timeout) clearTimeout(timeout)
                if (settled) return
                settled = true

                const normalizedStdout = typeof stdout === 'string' ? stdout : String(stdout ?? '')
                const normalizedStderr = typeof stderr === 'string' ? stderr : String(stderr ?? '')

                if (!error) {
                    resolve({ stdout: normalizedStdout, stderr: normalizedStderr, exitCode: 0 })
                    return
                }

                const err = error as NodeJS.ErrnoException
                if (typeof err.code === 'number') {
                    resolve({ stdout: normalizedStdout, stderr: normalizedStderr, exitCode: err.code })
                    return
                }

                reject(error)
            })
        } catch (error) {
            settled = true
            reject(error)
            return
        }

        child.stdin?.on('error', (error) => {
            stdinError = error
        })

        timeout = setTimeout(() => {
            if (settled) return
            settled = true
            child.kill()
            reject(new Error(`Process timed out after ${timeoutMs}ms`))
        }, timeoutMs)

        try {
            if (stdinContent !== undefined) {
                child.stdin?.write(stdinContent, (error) => {
                    if (error) stdinError = error
                })
            }
            child.stdin?.end()
        } catch (error) {
            stdinError = error instanceof Error ? error : new Error(String(error))
        }
    })
}

async function findBinaryPath(name: string): Promise<string | undefined> {
    const locatorBinary = process.platform === 'win32' ? 'where.exe' : 'which'
    const found = await runProcess(locatorBinary, [name], undefined, LOOKUP_TIMEOUT_MS).catch(() => null)
    if (!found || found.exitCode !== 0) return undefined
    const matches = getNonEmptyLines(found.stdout)
    return process.platform === 'win32' ? pickWindowsBinaryPath(matches) : matches[0]
}

export async function detectCli(
    name: CliBinary
): Promise<{ available: boolean; path?: string; version?: string }> {
    const path = await findBinaryPath(name)
    if (!path) return { available: false }

    const versionResult = await runProcess(path, ['--version'], undefined, LOOKUP_TIMEOUT_MS).catch(() => null)
    const version = versionResult
        ? getFirstNonEmptyLine(versionResult.stdout) ?? getFirstNonEmptyLine(versionResult.stderr)
        : undefined

    return {
        available: true,
        path,
        ...(version ? { version } : {})
    }
}

export async function detectCliProvider(
    provider: CliProvider
): Promise<{ available: boolean; path?: string; version?: string }> {
    const binary = CLI_BINARY_NAMES[provider]
    return detectCli(binary)
}

export async function spawnCliChat(
    binary: string,
    args: string[],
    stdinContent: string,
    timeoutMs = DEFAULT_CHAT_TIMEOUT_MS
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const resolvedBinary = await findBinaryPath(binary)
    return runProcess(resolvedBinary ?? binary, args, stdinContent, timeoutMs)
}

async function fetchCodexCliModels(fallbackModels: string[]): Promise<string[]> {
    const codexDir = path.join(os.homedir(), '.codex')
    const cache = await readJsonFile(path.join(codexDir, 'models_cache.json'))
    const configuredModel = readTopLevelTomlString(
        await readTextFile(path.join(codexDir, 'config.toml')),
        'model'
    )

    const cachedModels = Array.isArray(cache?.models)
        ? [...cache.models]
            .sort((a: any, b: any) => {
                const left = typeof a?.priority === 'number' ? a.priority : Number.MAX_SAFE_INTEGER
                const right = typeof b?.priority === 'number' ? b.priority : Number.MAX_SAFE_INTEGER
                return left - right
            })
            .filter((model: any) => model?.visibility === 'list')
            .map((model: any) => typeof model?.slug === 'string' ? model.slug : undefined)
        : []

    return modelsWithFallback([configuredModel, ...cachedModels], fallbackModels)
}

async function fetchClaudeCliModels(fallbackModels: string[]): Promise<string[]> {
    const settings = await readJsonFile(path.join(os.homedir(), '.claude', 'settings.json'))
    const configuredModel = typeof settings?.model === 'string' ? settings.model : undefined
    const overrides = settings?.modelOverrides && typeof settings.modelOverrides === 'object'
        ? Object.values(settings.modelOverrides).filter((value): value is string => typeof value === 'string')
        : []

    return modelsWithFallback([configuredModel, ...overrides], fallbackModels)
}

async function fetchGeminiCliModels(fallbackModels: string[]): Promise<string[]> {
    const settings = await readJsonFile(path.join(os.homedir(), '.gemini', 'settings.json'))
    const configuredModel = getTrimmedString(settings?.model)

    return modelsWithFallback(uniqueNonEmpty([configuredModel]), fallbackModels)
}

async function fetchGithubCliModels(_fallbackModels: string[]): Promise<string[]> {
    const homeDir = os.homedir()
    const copilotHome = process.env.COPILOT_HOME?.trim()
    const configDir = copilotHome || path.join(homeDir, '.copilot')
    const copilotBinary = await findBinaryPath('copilot') ?? 'copilot'

    const config = await readJsonFile(path.join(configDir, 'config.json'))
    const helpConfigResult = await runProcess(copilotBinary, ['help', 'config'], undefined, LOOKUP_TIMEOUT_MS)
        .catch(() => null)
    const availableModels = helpConfigResult?.exitCode === 0
        ? parseCopilotHelpConfigModels(helpConfigResult.stdout)
        : []

    const configuredModel = uniqueNonEmpty([
        getTrimmedString(process.env.COPILOT_MODEL),
        getTrimmedString(config?.model)
    ])[0]

    return modelsWithFallback([configuredModel, ...availableModels], _fallbackModels)
}

async function fetchJunieCliModels(fallbackModels: string[]): Promise<string[]> {
    const homeDir = os.homedir()

    // Junie resolves model precedence as settings -> project config -> user config.
    const [settings, projectConfig, userConfig] = await Promise.all([
        readJsonFile(path.join(homeDir, '.junie', 'settings.json')),
        readJsonFile(path.join(process.cwd(), '.junie', 'config.json')),
        readJsonFile(path.join(homeDir, '.junie', 'config.json'))
    ])

    const configuredModel = uniqueNonEmpty([
        getTrimmedString(settings?.model),
        getTrimmedString(projectConfig?.model),
        getTrimmedString(userConfig?.model)
    ])[0]

    return modelsWithFallback([configuredModel], fallbackModels)
}

export async function fetchCliModels(
    provider: CliProvider,
    fallbackModels: string[]
): Promise<string[]> {
    const status = await detectCliProvider(provider)
    if (!status.available) return []

    if (provider === 'codex-cli') return fetchCodexCliModels(fallbackModels)
    if (provider === 'claude-cli') return fetchClaudeCliModels(fallbackModels)
    if (provider === 'github-cli') return fetchGithubCliModels(fallbackModels)
    if (provider === 'junie-cli') return fetchJunieCliModels(fallbackModels)
    return fetchGeminiCliModels(fallbackModels)
}
