import {describe, expect, it} from 'vitest'
import type {AiCssProposal} from '../AiCssAssistModal'
import {applyCssProposal} from '../CustomCssManager'

describe('applyCssProposal', () => {
    it('replaces an existing selector block when using replace_match', () => {
        const currentCss = [
            '.navbar {',
            '  color: red;',
            '}',
            '',
            '.footer {',
            '  color: blue;',
            '}'
        ].join('\n')

        const proposal: AiCssProposal = {
            mode: 'replace_match',
            matchText: '.navbar',
            css: '.navbar {\n  color: var(--theme-text);\n}',
            explanation: 'Update the navbar colors.'
        }

        const nextCss = applyCssProposal(currentCss, proposal)

        expect(nextCss).toContain('color: var(--theme-text);')
        expect(nextCss).not.toContain('color: red;')
        expect(nextCss).toContain('.footer {')
    })

    it('removes an existing selector block when using delete_match', () => {
        const currentCss = [
            '.navbar {',
            '  color: red;',
            '}',
            '',
            '.footer {',
            '  color: blue;',
            '}'
        ].join('\n')

        const proposal: AiCssProposal = {
            mode: 'delete_match',
            matchText: '.navbar',
            css: '',
            explanation: 'Remove the navbar rule.'
        }

        const nextCss = applyCssProposal(currentCss, proposal)

        expect(nextCss).not.toContain('.navbar {')
        expect(nextCss).toContain('.footer {')
    })
})
