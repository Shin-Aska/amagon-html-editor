import {beforeEach, describe, expect, it, vi} from 'vitest'
import {
    clearGoogleFontPreviewCache,
    extractLatinFontFaceBlock,
    fetchGoogleFontPreviewCss,
    getPreviewFontIdForFamily,
    rewriteGoogleFontCssWithLocalFiles,
} from '../googleFontCss'

beforeEach(() => {
    clearGoogleFontPreviewCache()
})

describe('rewriteGoogleFontCssWithLocalFiles', () => {
    it('rewrites gstatic urls to local data URIs', async () => {
        const css = `@font-face {
  font-family: 'Roboto';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2) format('woff2');
}`
        const result = await rewriteGoogleFontCssWithLocalFiles(css, {
            fetchFile: async (url) => ({
                success: true,
                dataUri: `data:font/woff2;base64,${Buffer.from(url).toString('base64')}`,
            }),
        })

        expect(result).toContain('data:font/woff2;base64,')
        expect(result).not.toContain('https://fonts.gstatic.com/')
    })

    it('only rewrites urls from the allowed gstatic origin', async () => {
        const css = `@font-face {
  src: url(https://fonts.gstatic.com/s/roboto/v30/allowed.woff2);
}
@font-face {
  src: url(https://evil.example.com/font.woff2);
}`
        const result = await rewriteGoogleFontCssWithLocalFiles(css, {
            fetchFile: async (url) => ({
                success: true,
                dataUri: `data:font/woff2;base64,${Buffer.from(url).toString('base64')}`,
            }),
        })

        expect(result).toContain('https://evil.example.com/font.woff2')
        expect(result).not.toContain('https://fonts.gstatic.com/s/roboto/v30/allowed.woff2')
    })

    it('deduplicates identical urls across multiple @font-face blocks', async () => {
        const css = `@font-face { src: url(https://fonts.gstatic.com/s/roboto/v30/font.woff2); }
@font-face { src: url(https://fonts.gstatic.com/s/roboto/v30/font.woff2); }`
        let callCount = 0
        const result = await rewriteGoogleFontCssWithLocalFiles(css, {
            fetchFile: async (url) => {
                callCount++
                return {
                    success: true,
                    dataUri: `data:font/woff2;base64,${Buffer.from(url).toString('base64')}`,
                }
            },
        })

        expect(callCount).toBe(1)
        expect((result.match(/data:font\/woff2;base64,/g) || []).length).toBe(2)
    })

    it('preserves the original quote style around urls', async () => {
        const css = `@font-face { src: url('https://fonts.gstatic.com/s/roboto/v30/font.woff2'); }`
        const result = await rewriteGoogleFontCssWithLocalFiles(css, {
            fetchFile: async (url) => ({
                success: true,
                dataUri: `data:font/woff2;base64,${Buffer.from(url).toString('base64')}`,
            }),
        })

        expect(result).toMatch(/url\('data:font\/woff2;base64,[^']+'\)/)
    })

    it('returns unchanged css when no gstatic urls are present', async () => {
        const css = `@font-face { src: local('Arial'); }`
        const result = await rewriteGoogleFontCssWithLocalFiles(css, {
            fetchFile: async () => ({success: true, dataUri: 'data:x'}),
        })

        expect(result).toBe(css)
    })

    it('rejects instead of leaving an external font URL when file IPC fails', async () => {
        const css = `@font-face { src: url(https://fonts.gstatic.com/s/roboto/v30/font.woff2); }`

        await expect(
            rewriteGoogleFontCssWithLocalFiles(css, {
                fetchFile: async () => ({success: false, error: 'Network unavailable'}),
            }),
        ).rejects.toThrow('Network unavailable')
    })
})

describe('extractLatinFontFaceBlock', () => {
    it('keeps only the latin @font-face block', () => {
        const css = `/* latin */
@font-face {
  font-family: 'Roboto';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/roboto/v30/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
/* latin-ext */
@font-face {
  font-family: 'Roboto';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/roboto/v30/latin-ext.woff2) format('woff2');
  unicode-range: U+0100-024F;
}
/* cyrillic */
@font-face {
  font-family: 'Roboto';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/roboto/v30/cyrillic.woff2) format('woff2');
  unicode-range: U+0400-04FF;
}`
        const result = extractLatinFontFaceBlock(css)

        expect(result).toContain('@font-face')
        expect(result).toContain('latin.woff2')
        expect(result).not.toContain('latin-ext.woff2')
        expect(result).not.toContain('cyrillic.woff2')
    })

    it('keeps one font face when no latin block exists', () => {
        const css = `@font-face { src: url(https://fonts.gstatic.com/s/roboto/v30/cyrillic.woff2); }
@font-face { src: url(https://fonts.gstatic.com/s/roboto/v30/second.woff2); }`
        const result = extractLatinFontFaceBlock(css)

        expect(result).toContain('cyrillic.woff2')
        expect(result).not.toContain('second.woff2')
    })
})

describe('fetchGoogleFontPreviewCss', () => {
    it('coalesces identical concurrent requests into a single fetch', async () => {
        const fetchCss = vi.fn(async () => ({
            success: true,
            css: `@font-face {
    font-family: 'Roboto';
    src: url(https://fonts.gstatic.com/s/roboto/v30/latin.woff2) format('woff2');
}`,
        }))
        const fetchFile = vi.fn(async () => ({
            success: true,
            dataUri: 'data:font/woff2;base64,dummy',
        }))

        const request = {family: 'Roboto', weight: '400', style: 'normal'}
        const [first, second] = await Promise.all([
            fetchGoogleFontPreviewCss(request, {fetchGoogleFontCss: fetchCss, fetchGoogleFontFile: fetchFile}),
            fetchGoogleFontPreviewCss(request, {fetchGoogleFontCss: fetchCss, fetchGoogleFontFile: fetchFile}),
        ])

        expect(fetchCss).toHaveBeenCalledTimes(1)
        expect(fetchFile).toHaveBeenCalledTimes(1)
        expect(first.success).toBe(true)
        expect(second.success).toBe(true)
        expect(first.css).toContain(getPreviewFontIdForFamily('Roboto'))
        expect(first.css).toBe(second.css)
    })

    it('limits concurrent preview loading to at most two active fetches', async () => {
        let active = 0
        let maxActive = 0
        const resolvers: Array<() => void> = []

        const fetchCss = vi.fn(async () => {
            active++
            maxActive = Math.max(maxActive, active)
            await new Promise<void>((resolve) => resolvers.push(resolve))
            active--
            return {
                success: true,
                css: `@font-face { font-family: 'Font'; src: url(https://fonts.gstatic.com/s/font/x.woff2); }`,
            }
        })
        const fetchFile = vi.fn(async () => ({
            success: true,
            dataUri: 'data:font/woff2;base64,dummy',
        }))

        const promises = [
            fetchGoogleFontPreviewCss({family: 'A', weight: '400', style: 'normal'}, {fetchGoogleFontCss: fetchCss, fetchGoogleFontFile: fetchFile}),
            fetchGoogleFontPreviewCss({family: 'B', weight: '400', style: 'normal'}, {fetchGoogleFontCss: fetchCss, fetchGoogleFontFile: fetchFile}),
            fetchGoogleFontPreviewCss({family: 'C', weight: '400', style: 'normal'}, {fetchGoogleFontCss: fetchCss, fetchGoogleFontFile: fetchFile}),
        ]

        await new Promise((resolve) => setTimeout(resolve, 10))
        expect(maxActive).toBeLessThanOrEqual(2)

        while (resolvers.length > 0 || active > 0) {
            resolvers.splice(0).forEach((resolve) => resolve())
            await new Promise((resolve) => setTimeout(resolve, 0))
        }
        await Promise.all(promises)

        expect(fetchCss).toHaveBeenCalledTimes(3)
    })

    it('caches a completed preview and returns it without re-fetching', async () => {
        const fetchCss = vi.fn(async () => ({
            success: true,
            css: `@font-face {
    font-family: 'Roboto';
    src: url(https://fonts.gstatic.com/s/roboto/v30/latin.woff2) format('woff2');
}`,
        }))
        const fetchFile = vi.fn(async () => ({
            success: true,
            dataUri: 'data:font/woff2;base64,dummy',
        }))

        const request = {family: 'Roboto', weight: '400', style: 'normal'}
        const first = await fetchGoogleFontPreviewCss(request, {fetchGoogleFontCss: fetchCss, fetchGoogleFontFile: fetchFile})
        const second = await fetchGoogleFontPreviewCss(request, {fetchGoogleFontCss: fetchCss, fetchGoogleFontFile: fetchFile})

        expect(fetchCss).toHaveBeenCalledTimes(1)
        expect(fetchFile).toHaveBeenCalledTimes(1)
        expect(second.css).toBe(first.css)
    })
})
