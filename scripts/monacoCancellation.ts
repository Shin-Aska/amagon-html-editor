import {readFile} from 'node:fs/promises'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname} from 'node:path'
import type {Plugin} from 'vite'

const moduleSuffix = '/node_modules/monaco-editor/esm/vs/editor/contrib/wordHighlighter/browser/wordHighlighter.js'
const marker = '// Amagon: scoped Monaco 0.54 word-highlighter cancellation fix (#5294).'
const packagePath = createRequire(import.meta.url).resolve('monaco-editor/package.json')
const installedVersion: unknown = JSON.parse(readFileSync(packagePath, 'utf8')).version

export const isMonacoWordHighlighter = (id: string): boolean =>
    id.split('?')[0].replace(/\\/g, '/').endsWith(moduleSuffix)

// https://github.com/microsoft/monaco-editor/issues/5294
// These promises are owned by the highlighter. Monaco's error handler ignores
// CancellationError and continues reporting every other unexpected error.
export function handleMonacoHighlightCancellation(source: string, version: unknown = installedVersion): string {
    if (version !== '0.54.0') {
        throw new Error('Monaco version changed; review the scoped cancellation fix before upgrading.')
    }
    if (source.includes(marker)) return source
    const delayed = /this\.runDelayer\.trigger\(([^\n]+)\);/g
    const running = /this\._run\(([^)]*)\);/g
    if (!/^import.*\bonUnexpectedError\b.*from/m.test(source)
        || [...source.matchAll(delayed)].length !== 3
        || [...source.matchAll(running)].length !== 7) {
        throw new Error('Monaco word-highlighter source changed; review the scoped cancellation fix before upgrading.')
    }
    return source
        .replace(delayed, 'this.runDelayer.trigger($1).catch(onUnexpectedError);')
        .replace(running, 'this._run($1).catch(onUnexpectedError);') + `\n${marker}\n`
}

export function monacoCancellation(): Plugin {
    return {
        name: 'monaco-highlight-cancellation',
        enforce: 'pre',
        // Development dependency prebundling uses esbuild rather than Rollup.
        config: () => ({
            optimizeDeps: {
                esbuildOptions: {
                    plugins: [{
                        name: 'monaco-highlight-cancellation',
                        setup(build) {
                            build.onLoad({filter: /wordHighlighter\.js$/}, async args => {
                                if (!isMonacoWordHighlighter(args.path)) return undefined
                                return {
                                    contents: handleMonacoHighlightCancellation(await readFile(args.path, 'utf8')),
                                    loader: 'js',
                                    resolveDir: dirname(args.path)
                                }
                            })
                        }
                    }]
                }
            }
        }),
        transform(source, id) {
            if (!isMonacoWordHighlighter(id)) return undefined
            return {code: handleMonacoHighlightCancellation(source), map: null}
        }
    }
}
