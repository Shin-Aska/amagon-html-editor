import { describe, expect, it } from 'vitest'
import { parseCssProposal } from '../AiCssAssistModal'

describe('parseCssProposal', () => {
    it('prefers metadata json plus a dedicated css fence', () => {
        const response = [
            '```json',
            '{',
            '  "mode": "insert",',
            '  "anchor": "end_of_file",',
            '  "matchText": "",',
            '  "insertHint": "Append this to the file.",',
            '  "explanation": "Adds a pseudo-element label without changing other rules."',
            '}',
            '```',
            '```css',
            '.card::before {',
            '  content: "Hello";',
            '  background-image: url("C:\\\\temp\\\\hero.png");',
            '}',
            '```'
        ].join('\n')

        const proposal = parseCssProposal(response, '.existing { color: red; }')

        expect(proposal).not.toBeNull()
        expect(proposal?.mode).toBe('insert')
        expect(proposal?.anchor).toBe('end_of_file')
        expect(proposal?.css).toContain('content: "Hello";')
        expect(proposal?.css).toContain('url("C:\\\\temp\\\\hero.png")')
    })

    it('rescues invalid json when the css field contains raw quotes and backslashes', () => {
        const response = [
            '```json',
            '{',
            '  "mode": "replace",',
            '  "explanation": "Full rewrite.",',
            '  "css": ".hero::before {',
            '  content: "New";',
            '  background-image: url("C:\\temp\\hero.png");',
            '}"',
            '}',
            '```'
        ].join('\n')

        const proposal = parseCssProposal(response, '')

        expect(proposal).not.toBeNull()
        expect(proposal?.mode).toBe('replace')
        expect(proposal?.css).toContain('content: "New";')
        expect(proposal?.css).toContain('url("C:\\temp\\hero.png")')
    })
})
