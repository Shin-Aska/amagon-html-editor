// Pure OpenAI protocol helpers; credentials and requests stay in the main process.
const object = (value: unknown): Record<string, unknown> => (
    value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown> : {}
)

export const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini'
export const OPENAI_FALLBACK_MODELS = [DEFAULT_OPENAI_MODEL, 'gpt-5.4', 'gpt-4.1']

export function parseOpenAIModels(payload: unknown): string[] {
    const data = object(payload).data
    if (!Array.isArray(data)) throw new Error('OpenAI returned an invalid model list. Please refresh and try again.')
    const ids = data.flatMap((entry: unknown) => {
        const model = object(entry)
        if (typeof model.id !== 'string') return []
        const id = model.id.trim()
        const base = id.startsWith('ft:') ? id.split(':')[1] : id
        if (!base || !/^(?:gpt-\d|o\d(?:[.-]|$)|chatgpt-)/u.test(base)) return []
        if (/(?:^|-)(?:instruct|realtime|audio|transcribe|tts|image|search|deep-research)(?:-|$)/u.test(base)) return []
        if (typeof model.shutdown_date === 'string' && Date.parse(model.shutdown_date) <= Date.now()) return []
        return [id]
    })
    return [...new Set(ids)]
}

export function usesOpenAIResponses(model: string): boolean {
    const base = model.startsWith('ft:') ? model.split(':')[1] : model
    const version = /^gpt-(\d+)/u.exec(base ?? '')
    return Boolean(version && Number(version[1]) >= 5) || /^o\d/u.test(base ?? '')
}

export function openAIError(status: number, text: string, apiKey: string): string {
    let message = text
    try {
        const detail = object(object(JSON.parse(text)).error).message
        if (typeof detail === 'string') message = detail
    } catch {
        // Non-JSON HTTP errors still have a readable status.
        message = text
    }
    if (apiKey) message = message.split(apiKey).join('[redacted]')
    message = message.replace(/\bsk-[\w*.-]+/gu, '[redacted]').slice(0, 500)
    return `OpenAI API error (${status}): ${message || 'The request was rejected.'}`
}

export function openAIResponseContent(payload: unknown, responses: boolean): string {
    const data = object(payload)
    if (!responses) {
        const choice = Array.isArray(data.choices) ? object(data.choices[0]) : {}
        const text = object(choice.message).content
        if (typeof text === 'string' && text.trim()) return text
    } else if (Array.isArray(data.output)) {
        const texts: string[] = []
        for (const output of data.output) {
            const message = object(output)
            if (message.type !== 'message' || !Array.isArray(message.content)) continue
            for (const item of message.content) {
                const part = object(item)
                if (part.type === 'output_text' && typeof part.text === 'string') texts.push(part.text)
                if (part.type === 'refusal' && typeof part.refusal === 'string') texts.push(part.refusal)
            }
        }
        if (texts.join('').trim()) return texts.join('')
    }
    throw new Error(data.status === 'incomplete'
        ? 'OpenAI reached its output limit before returning text. Try a shorter request or another model.'
        : 'OpenAI returned no text. Please try another text model or retry the request.')
}
