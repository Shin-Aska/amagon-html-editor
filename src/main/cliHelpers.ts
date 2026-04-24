import {execFile} from 'child_process'
import * as syncFs from 'fs'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

type CliProvider = 'claude-cli' | 'codex-cli' | 'gemini-cli' | 'github-cli' | 'junie-cli' | 'opencode-cli'
type CliBinary = 'claude' | 'codex' | 'gemini' | 'copilot' | 'junie' | 'opencode'

const LOOKUP_TIMEOUT_MS = 10_000
const OPENCODE_LOOKUP_TIMEOUT_MS = 45_000
const DEFAULT_CHAT_TIMEOUT_MS = 120_000
const MAX_CLI_MODELS = 80
const JUNIE_MODEL_PROBE_ID = '__amagon_model_probe__'
const CLI_VERSION_ARGS: Partial<Record<CliBinary, string[]>> = {
    junie: ['--skip-update-check', '--version']
}
const CLI_VERSION_TIMEOUTS: Partial<Record<CliBinary, number>> = {
    opencode: OPENCODE_LOOKUP_TIMEOUT_MS
}
const JUNIE_BUILT_IN_MODEL_IDS = [
    'default',
    'claude-opus-4-6',
    'claude-opus-4-7',
    'claude-sonnet-4-6',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-3.1-pro-preview',
    'gemini-flash',
    'gemini-pro',
    'gpt',
    'gpt-5-2025-08-07',
    'gpt-5.2-2025-12-11',
    'gpt-5.3-codex',
    'gpt-5.4',
    'gpt-codex',
    'grok',
    'grok-4-1-fast-reasoning',
    'opus',
    'sonnet'
]

export const CLI_BINARY_NAMES: Record<CliProvider, CliBinary> = {
    'claude-cli': 'claude',
    'codex-cli': 'codex',
    'gemini-cli': 'gemini',
    'github-cli': 'copilot',
    'junie-cli': 'junie',
    'opencode-cli': 'opencode'
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

function normalizeCliVersionLine(binary: CliBinary, line: string | undefined): string | undefined {
    if (!line) return undefined
    if (binary === 'junie') {
        const match = line.match(/Junie version:\s*(.+)$/i)
        return match?.[1]?.trim() || line
    }
    return line
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

async function listJsonFiles(dirPath: string): Promise<string[]> {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })
        return entries
            .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.json')
            .map((entry) => path.join(dirPath, entry.name))
    } catch {
        return []
    }
}

function getArrayStrings(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string')
    }
    if (typeof value === 'string') {
        return value
            .split(path.delimiter)
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
    }
    return []
}

function getConfigArrayStrings(config: any, keys: string[]): string[] {
    for (const key of keys) {
        const values = getArrayStrings(config?.[key])
        if (values.length > 0) return values
    }
    return []
}

function getConfigBoolean(config: any, keys: string[]): boolean | undefined {
    for (const key of keys) {
        const value = config?.[key]
        if (typeof value === 'boolean') return value
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase()
            if (normalized === 'true') return true
            if (normalized === 'false') return false
        }
    }
    return undefined
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

function parseOpencodeModels(stdout: string): string[] {
    return uniqueNonEmpty(
        getNonEmptyLines(stdout).filter((line) => /^[a-zA-Z0-9_-]+\//.test(line))
    )
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

function parseJunieAvailableModels(output: string): string[] {
    const models: string[] = []
    let inModelList = false

    for (const rawLine of output.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (line === 'Available models:') {
            inModelList = true
            continue
        }
        if (!inModelList) continue

        const match = line.match(/^-\s+(.+)$/)
        if (match) {
            models.push(match[1])
            continue
        }
        if (models.length > 0 && line.length > 0) break
    }

    return uniqueNonEmpty(models)
}

function normalizeJunieModelId(model: string | undefined): string | undefined {
    const normalized = getTrimmedString(model)
    if (!normalized) return undefined

    const lower = normalized.toLowerCase()
    const aliases: Record<string, string> = {
        'default': 'default',
        'gemini 3 flash': 'gemini-3-flash-preview',
        'gemini-3-0-flash': 'gemini-3-flash-preview',
        'gemini_3_0_flash': 'gemini-3-flash-preview',
        'gemini 3.1 flash lite': 'gemini-3.1-flash-lite-preview',
        'gemini-3-1-flash-lite-preview': 'gemini-3.1-flash-lite-preview',
        'gemini_3_1_flash_lite': 'gemini-3.1-flash-lite-preview',
        'gemini 3.1 pro preview': 'gemini-3.1-pro-preview',
        'gemini-3-1-pro-preview': 'gemini-3.1-pro-preview',
        'gemini_3_1_pro': 'gemini-3.1-pro-preview',
        'claude opus 4.6': 'claude-opus-4-6',
        'opus-4.6': 'claude-opus-4-6',
        'opus_4_6': 'claude-opus-4-6',
        'claude opus 4.7': 'claude-opus-4-7',
        'opus-4.7': 'claude-opus-4-7',
        'opus_4_7': 'claude-opus-4-7',
        'claude sonnet 4.6': 'claude-sonnet-4-6',
        'sonnet-4.6': 'claude-sonnet-4-6',
        'sonnet_4_6': 'claude-sonnet-4-6',
        'gpt5': 'gpt-5-2025-08-07',
        'gpt-5': 'gpt-5-2025-08-07',
        'gpt5_2': 'gpt-5.2-2025-12-11',
        'gpt-5.2': 'gpt-5.2-2025-12-11',
        'gpt5_3_codex': 'gpt-5.3-codex',
        'gpt5-3-codex': 'gpt-5.3-codex',
        'gpt5_4': 'gpt-5.4',
        'grok 4.1 fast reasoning': 'grok-4-1-fast-reasoning',
        'grok-4.1-fast-reasoning': 'grok-4-1-fast-reasoning',
        'grok_4_1_fast_reasoning': 'grok-4-1-fast-reasoning'
    }

    return aliases[lower] ?? normalized
}

function pickWindowsBinaryPath(paths: string[]): string | undefined {
    const preferredExtensions = ['.exe', '.cmd', '.bat', '.ps1']
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

function isWindowsPowerShellShim(binary: string): boolean {
    return process.platform === 'win32' && path.extname(binary).toLowerCase() === '.ps1'
}

function resolveWindowsNodeShim(binary: string): { binary: string; argsPrefix: string[] } | undefined {
    if (process.platform !== 'win32' || path.extname(binary).toLowerCase() !== '.cmd') return undefined

    let content = ''
    try {
        content = syncFs.readFileSync(binary, 'utf-8')
    } catch {
        return undefined
    }

    const shimDir = path.dirname(binary)
    const localNode = path.join(shimDir, 'node.exe')
    const nodeBinary = syncFs.existsSync(localNode) ? localNode : 'node.exe'

    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!/%\*/.test(line) || !/\bnode(?:\.exe)?\b/i.test(line)) continue

        const quotedTokens = [...line.matchAll(/"([^"]+)"/g)].map((match) => match[1])
        const scriptToken = quotedTokens.find((token) => {
            const normalized = token.replace(/%~?dp0\\?/ig, '')
            const basename = path.basename(normalized)
            return !/^%.*%$/.test(normalized)
                && !/^(?:node|node\.exe)$/i.test(basename)
                && /\.(?:[cm]?js)$/i.test(basename)
        })
        if (!scriptToken) continue

        const scriptPath = scriptToken
            .replace(/%~dp0\\?/ig, `${shimDir}${path.sep}`)
            .replace(/%dp0%\\?/ig, `${shimDir}${path.sep}`)

        return { binary: nodeBinary, argsPrefix: [path.normalize(scriptPath)] }
    }

    return undefined
}

function validateWindowsCommandShimArgs(args: string[]): void {
    const unsafe = /["&|<>^%!\r\n]/
    const unsafeArg = args.find((arg) => unsafe.test(arg))
    if (unsafeArg !== undefined) {
        throw new Error(`Unsafe CLI argument for Windows command shim: ${unsafeArg}`)
    }
}

function getProcessInvocation(binary: string, args: string[]): { binary: string; args: string[] } {
    if (isWindowsPowerShellShim(binary)) {
        return {
            binary: 'powershell.exe',
            args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', binary, ...args]
        }
    }

    if (!isWindowsCommandShim(binary)) {
        return { binary, args }
    }

    const nodeShim = resolveWindowsNodeShim(binary)
    if (nodeShim) {
        return {
            binary: nodeShim.binary,
            args: [...nodeShim.argsPrefix, ...args]
        }
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
            child = execFile(invocation.binary, invocation.args, { env: getCliChildEnv(), maxBuffer: 10 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
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
                if (err.code === 'ENOENT') {
                    reject(error)
                    return
                }

                if (typeof err.code === 'number') {
                    resolve({ stdout: normalizedStdout, stderr: normalizedStderr, exitCode: err.code })
                    return
                }

                resolve({
                    stdout: normalizedStdout,
                    stderr: normalizedStderr || err.message,
                    exitCode: 1
                })
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
    const matches = found?.exitCode === 0 ? getNonEmptyLines(found.stdout) : []
    const located = process.platform === 'win32' ? pickWindowsBinaryPath(matches) : matches[0]
    return located ?? findBinaryInCommonLocations(name)
}

export async function detectCli(
    name: CliBinary
): Promise<{ available: boolean; path?: string; version?: string }> {
    const path = await findBinaryPath(name)
    if (!path) return { available: false }

    const versionArgs = CLI_VERSION_ARGS[name] ?? ['--version']
    const versionResult = await runProcess(path, versionArgs, undefined, CLI_VERSION_TIMEOUTS[name] ?? LOOKUP_TIMEOUT_MS).catch(() => null)
    const versionLine = versionResult
        ? getFirstNonEmptyLine(versionResult.stdout) ?? getFirstNonEmptyLine(versionResult.stderr)
        : undefined
    const version = normalizeCliVersionLine(name, versionLine)

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

function getWindowsSearchDirs(): string[] {
    return uniqueNonEmpty([
        process.env.APPDATA ? path.join(process.env.APPDATA, 'npm') : undefined,
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'pnpm') : undefined,
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'npm') : undefined,
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps') : undefined,
        process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.local', 'bin') : undefined,
        process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.bun', 'bin') : undefined,
        process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.cargo', 'bin') : undefined,
        process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.volta', 'bin') : undefined,
        process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'scoop', 'shims') : undefined,
        process.env.ProgramData ? path.join(process.env.ProgramData, 'chocolatey', 'bin') : undefined
    ])
}

function getUnixSearchDirs(): string[] {
    return uniqueNonEmpty([
        path.join(os.homedir(), '.local', 'bin'),
        path.join(os.homedir(), '.bun', 'bin'),
        path.join(os.homedir(), '.cargo', 'bin'),
        path.join(os.homedir(), '.volta', 'bin'),
        path.join(os.homedir(), '.asdf', 'shims'),
        path.join(os.homedir(), '.local', 'share', 'mise', 'shims'),
        path.join(os.homedir(), '.local', 'share', 'pnpm'),
        path.join(os.homedir(), '.npm-global', 'bin'),
        process.env.PNPM_HOME,
        '/opt/homebrew/bin',
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        '/snap/bin'
    ])
}

function findBinaryInCommonLocations(name: string): string | undefined {
    const dirs = process.platform === 'win32' ? getWindowsSearchDirs() : getUnixSearchDirs()
    const names = process.platform === 'win32'
        ? [`${name}.exe`, `${name}.cmd`, `${name}.bat`, `${name}.ps1`, name]
        : [name]

    for (const dir of dirs) {
        for (const candidateName of names) {
            const candidate = path.join(dir, candidateName)
            if (syncFs.existsSync(candidate)) return candidate
        }
    }

    return undefined
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
    const junieHome = process.env.JUNIE_HOME?.trim() || path.join(os.homedir(), '.junie')
    const junieBinary = await findBinaryPath('junie') ?? 'junie'

    // Junie resolves model precedence as environment -> user settings -> project config -> user config.
    const [settings, projectConfig, userConfig] = await Promise.all([
        readJsonFile(path.join(junieHome, 'settings.json')),
        readJsonFile(path.join(process.cwd(), '.junie', 'config.json')),
        readJsonFile(path.join(junieHome, 'config.json'))
    ])

    const configuredModel = uniqueNonEmpty([
        normalizeJunieModelId(process.env.JUNIE_MODEL),
        normalizeJunieModelId(settings?.model),
        normalizeJunieModelId(projectConfig?.model),
        normalizeJunieModelId(userConfig?.model)
    ])[0]

    const probeResult = await runProcess(
        junieBinary,
        ['--task', 'model probe', '--output-format', 'text', '--skip-update-check', '--timeout', '1', '--model', JUNIE_MODEL_PROBE_ID],
        undefined,
        LOOKUP_TIMEOUT_MS
    ).catch(() => null)
    const availableModels = probeResult
        ? parseJunieAvailableModels(`${probeResult.stdout}\n${probeResult.stderr}`)
        : []

    const configuredModelLocations = [
        ...getArrayStrings(process.env.JUNIE_MODEL_LOCATIONS),
        ...getConfigArrayStrings(projectConfig, ['modelLocations', 'modelLocation', 'model_locations', 'model-location']),
        ...getConfigArrayStrings(userConfig, ['modelLocations', 'modelLocation', 'model_locations', 'model-location'])
    ]
    const useDefaultModelLocations = getConfigBoolean(
        { value: process.env.JUNIE_MODEL_DEFAULT_LOCATIONS },
        ['value']
    ) ?? getConfigBoolean(
        projectConfig,
        ['modelDefaultLocations', 'modelDefaultLocation', 'model_default_locations', 'model-default-locations']
    ) ?? getConfigBoolean(
        userConfig,
        ['modelDefaultLocations', 'modelDefaultLocation', 'model_default_locations', 'model-default-locations']
    ) ?? true

    const defaultModelLocationLookups = useDefaultModelLocations
        ? [
            listJsonFiles(path.join(junieHome, 'models')),
            listJsonFiles(path.join(process.cwd(), '.junie', 'models'))
        ]
        : []

    const modelFiles = await Promise.all([
        ...defaultModelLocationLookups,
        ...configuredModelLocations.map((location) => listJsonFiles(path.resolve(location)))
    ])
    const customModels = uniqueNonEmpty(
        modelFiles
            .flat()
            .map((filePath) => `custom:${path.basename(filePath, '.json')}`)
    )

    return modelsWithFallback(
        [configuredModel, ...(availableModels.length > 0 ? availableModels : JUNIE_BUILT_IN_MODEL_IDS), ...customModels],
        fallbackModels
    )
}

async function fetchOpencodeCliModels(fallbackModels: string[]): Promise<string[]> {
    const configHome = process.env.XDG_CONFIG_HOME?.trim() || path.join(os.homedir(), '.config')
    const configPath = process.env.OPENCODE_CONFIG?.trim() || path.join(configHome, 'opencode', 'opencode.json')
    const opencodeBinary = await findBinaryPath('opencode') ?? 'opencode'

    const [globalConfig, projectConfig, modelsResult] = await Promise.all([
        readJsonFile(configPath),
        readJsonFile(path.join(process.cwd(), 'opencode.json')),
        runProcess(opencodeBinary, ['models'], undefined, OPENCODE_LOOKUP_TIMEOUT_MS).catch(() => null)
    ])

    const configuredModel = uniqueNonEmpty([
        getTrimmedString(process.env.OPENCODE_MODEL),
        getTrimmedString(globalConfig?.model),
        getTrimmedString(projectConfig?.model)
    ])[0]

    const availableModels = modelsResult?.exitCode === 0
        ? parseOpencodeModels(modelsResult.stdout)
        : []

    return modelsWithFallback([configuredModel, ...availableModels], fallbackModels)
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
    if (provider === 'opencode-cli') return fetchOpencodeCliModels(fallbackModels)
    return fetchGeminiCliModels(fallbackModels)
}
