import {open, rename, unlink} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'

export type AtomicWriteStage = 'allocate' | 'write' | 'sync' | 'close' | 'rename'

export interface AtomicFileHandle {
    write(buffer: Uint8Array): Promise<{readonly bytesWritten: number}>
    sync(): Promise<void>
    close(): Promise<void>
}

export interface AtomicFileSystem {
    open(filePath: string, flags: 'wx', mode: number): Promise<AtomicFileHandle>
    rename(source: string, target: string): Promise<void>
    unlink(filePath: string): Promise<void>
}

export type AtomicWriteSource = string | Uint8Array | AsyncIterable<Uint8Array>

export type AtomicWriteOptions = {
    readonly maxBytes: number
    readonly fileSystem?: AtomicFileSystem
    readonly createId?: () => string
}

const nodeFileSystem: AtomicFileSystem = {open, rename, unlink}

export class AtomicWriteError extends Error {
    readonly name = 'AtomicWriteError'

    constructor(
        readonly stage: AtomicWriteStage,
        readonly targetPath: string,
        readonly tempPath: string,
        readonly originalError: Error,
        readonly cleanupErrors: readonly Error[] = []
    ) {
        super(`Atomic replacement failed during ${stage}`)
    }
}

function isAsyncSource(source: AtomicWriteSource): source is AsyncIterable<Uint8Array> {
    return typeof source !== 'string' && !(source instanceof Uint8Array)
}

async function* sourceChunks(source: AtomicWriteSource): AsyncGenerator<Uint8Array> {
    if (typeof source === 'string') {
        yield Buffer.from(source)
        return
    }
    if (source instanceof Uint8Array) {
        yield source
        return
    }
    if (isAsyncSource(source)) {
        yield* source
    }
}

async function writeCompletely(handle: AtomicFileHandle, chunk: Uint8Array): Promise<void> {
    let offset = 0
    while (offset < chunk.byteLength) {
        const {bytesWritten} = await handle.write(chunk.subarray(offset))
        if (bytesWritten <= 0) throw new AtomicProgressError()
        offset += bytesWritten
    }
}

class AtomicProgressError extends Error {
    readonly name = 'AtomicProgressError'
    constructor() {
        super('Atomic file write made no progress')
    }
}

export async function atomicWriteFile(
    targetPath: string,
    source: AtomicWriteSource,
    options: AtomicWriteOptions
): Promise<void> {
    if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 0) {
        throw new RangeError('maxBytes must be a non-negative safe integer')
    }
    const fileSystem = options.fileSystem ?? nodeFileSystem
    const tempPath = `${targetPath}.${(options.createId ?? randomUUID)()}.tmp`
    let stage: AtomicWriteStage = 'allocate'
    let handle: AtomicFileHandle | undefined
    let closed = false

    try {
        handle = await fileSystem.open(tempPath, 'wx', 0o600)
        stage = 'write'
        let bytesWritten = 0
        for await (const chunk of sourceChunks(source)) {
            bytesWritten += chunk.byteLength
            if (bytesWritten > options.maxBytes) throw new AtomicCapacityError(options.maxBytes)
            await writeCompletely(handle, chunk)
        }
        stage = 'sync'
        await handle.sync()
        stage = 'close'
        await handle.close()
        closed = true
        stage = 'rename'
        await fileSystem.rename(tempPath, targetPath)
    } catch (error) {
        if (!(error instanceof Error)) throw error
        const cleanupErrors: Error[] = []
        if (handle !== undefined && !closed) {
            try {
                await handle.close()
            } catch (closeError) {
                if (!(closeError instanceof Error)) throw closeError
                cleanupErrors.push(closeError)
            }
        }
        if (handle !== undefined) {
            try {
                await fileSystem.unlink(tempPath)
            } catch (unlinkError) {
                if (!(unlinkError instanceof Error)) throw unlinkError
                cleanupErrors.push(unlinkError)
            }
        }
        throw new AtomicWriteError(stage, targetPath, tempPath, error, cleanupErrors)
    }
}

export class AtomicCapacityError extends Error {
    readonly name = 'AtomicCapacityError'
    constructor(readonly maxBytes: number) {
        super(`Atomic file content exceeds ${maxBytes} bytes`)
    }
}
