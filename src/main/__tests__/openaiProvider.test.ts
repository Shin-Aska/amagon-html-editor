// @vitest-environment node
import {describe, expect, it} from 'vitest'
import {openAIError, openAIResponseContent, parseOpenAIModels, usesOpenAIResponses} from '../openaiProvider'

describe('OpenAI protocol compatibility', () => {
    it('keeps fine-tuned text models and excludes specialized endpoints and shut-down models', () => {
        const ids = ['ft:gpt-4.1:team:name:id', 'gpt-5.4-pro', 'gpt-4o-audio-preview', 'gpt-4o-search-preview', 'o3-deep-research', 'gpt-image-1']
        expect(parseOpenAIModels({data: [
            ...ids.map(id => ({id})), {id: 'gpt-5-retired', shutdown_date: '2020-01-01'},
        ]})).toEqual(['ft:gpt-4.1:team:name:id', 'gpt-5.4-pro'])
    })

    it('rejects malformed model catalogs instead of silently accepting no models', () => {
        expect(() => parseOpenAIModels({error: 'bad response'})).toThrow('invalid model list')
    })

    it.each(['gpt-5.4-mini', 'gpt-6-sol', 'gpt-5.4-pro', 'o3', 'ft:gpt-5:org:name:id'])('uses Responses for %s', model => {
        expect(usesOpenAIResponses(model)).toBe(true)
    })

    it('retains legacy Chat Completions compatibility', () => {
        expect(usesOpenAIResponses('gpt-4.1')).toBe(false)
        expect(openAIResponseContent({choices: [{message: {content: 'Legacy response'}}]}, false)).toBe('Legacy response')
    })

    it('surfaces incomplete responses instead of showing an empty assistant message', () => {
        expect(() => openAIResponseContent({status: 'incomplete', output: []}, true)).toThrow('output limit')
    })

    it('preserves an explicit refusal as visible text', () => {
        expect(openAIResponseContent({output: [{type: 'message', content: [{type: 'refusal', refusal: 'Cannot do that'}]}]}, true)).toBe('Cannot do that')
    })

    it('redacts partially masked API keys from provider error messages', () => {
        expect(openAIError(401, JSON.stringify({error: {message: 'Incorrect API key: sk-proj-prefix******suffix'}}), 'sk-proj-full-secret'))
            .toBe('OpenAI API error (401): Incorrect API key: [redacted]')
    })
})
