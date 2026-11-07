// @vitest-environment node
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {Delayer} from 'monaco-editor/esm/vs/base/common/async.js'
import {errorHandler, onUnexpectedError} from 'monaco-editor/esm/vs/base/common/errors.js'
import {handleMonacoHighlightCancellation, isMonacoWordHighlighter} from './monacoCancellation'

const source = readFileSync(path.resolve('node_modules/monaco-editor/esm/vs/editor/contrib/wordHighlighter/browser/wordHighlighter.js'), 'utf8')
const originalHandler = errorHandler.unexpectedErrorHandler
let unexpected: unknown[] = []

function highlighter(run: () => Promise<void>) {
    const patched = handleMonacoHighlightCancellation(source)
    const start = patched.indexOf('let WordHighlighter = class WordHighlighter {')
    const end = patched.indexOf('WordHighlighter = WordHighlighter_1 = __decorate')
    if (start < 0 || end < start) throw new Error('Monaco highlighter class layout changed')
    // Execute the installed highlighter's real restore method and real Delayer.
    const Class = new Function('ResourceMap', 'onUnexpectedError',
        `let WordHighlighter_1; ${patched.slice(start, end)}; return WordHighlighter;`)(Map, onUnexpectedError)
    const instance = Object.create(Class.prototype)
    instance.occurrencesHighlightEnablement = 'singleFile'
    instance.runDelayer = new Delayer(0)
    instance._run = run
    return instance
}

beforeEach(() => {
    unexpected = []
    errorHandler.unexpectedErrorHandler = (error: unknown) => unexpected.push(error)
    vi.useFakeTimers()
})
afterEach(() => {
    vi.useRealTimers()
    errorHandler.unexpectedErrorHandler = originalHandler
})

describe('Monaco highlighter cancellation', () => {
    it('handles cancellation during view restoration and disposal', async () => {
        const run = vi.fn(async () => undefined)
        const instance = highlighter(run)
        instance.restore(250)
        instance.runDelayer.cancel()
        instance.restore(250)
        instance.runDelayer.dispose()
        await vi.runAllTimersAsync()
        expect(run).not.toHaveBeenCalled()
        expect(unexpected).toEqual([])
    })
    it('preserves reporting of unexpected async highlighter failures', async () => {
        const failure = new Error('highlight provider failed')
        const instance = highlighter(async () => {throw failure})
        instance.restore(0)
        await vi.runAllTimersAsync()
        expect(unexpected).toEqual([failure])
        instance.runDelayer.dispose()
    })
    it('is scoped to the installed highlighter and rejects unreviewed upstream changes', () => {
        expect(isMonacoWordHighlighter('/app/node_modules/monaco-editor/esm/vs/editor/contrib/wordHighlighter/browser/wordHighlighter.js')).toBe(true)
        expect(isMonacoWordHighlighter('C:\\app\\node_modules\\monaco-editor\\esm\\vs\\editor\\contrib\\wordHighlighter\\browser\\wordHighlighter.js?v=1')).toBe(true)
        expect(isMonacoWordHighlighter('/app/src/wordHighlighter.js')).toBe(false)
        expect(() => handleMonacoHighlightCancellation(source, '0.57.0')).toThrow('review the scoped cancellation fix')
        const patched = handleMonacoHighlightCancellation(source)
        expect(handleMonacoHighlightCancellation(patched)).toBe(patched)
    })
})
