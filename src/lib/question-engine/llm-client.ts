/**
 * OpenAI-Compatible LLM Client for the Clean-Room Trivia Engine
 *
 * Supports local vLLM (e.g. http://127.0.0.1:18737/v1) and hosted OpenAI API.
 * Handles JSON extraction robustly across both thinking and non-thinking models.
 */

export interface LlmConfig {
    provider?: 'openai-compatible' | 'anthropic'
    baseUrl: string
    apiKey: string
    model: string
    enableThinking?: boolean
    timeoutMs?: number
}

export interface LlmJsonCallOptions {
    systemPrompt: string
    userPrompt: string
    temperature?: number
    maxTokens?: number
    enableThinking?: boolean
}

export interface LlmJsonResponse<T> {
    data: T
    rawText: string
    model: string
    samplingParams: Record<string, unknown>
}

export function resolveLlmConfig(overrides?: Partial<LlmConfig>): LlmConfig {
    const requestedProvider =
        overrides?.provider ||
        (process.env.TRIVIA_ENGINE_LLM_PROVIDER as 'openai-compatible' | 'anthropic' | undefined) ||
        (overrides?.baseUrl?.includes('anthropic.com') ||
        (!overrides?.baseUrl && !process.env.TRIVIA_ENGINE_LLM_BASE_URL && !process.env.LOCAL_LLM_BASE_URL && !process.env.OPENAI_API_KEY && process.env.ANTHROPIC_API_KEY)
            ? 'anthropic'
            : 'openai-compatible')

    if (requestedProvider === 'anthropic') {
        const baseUrl = (
            overrides?.baseUrl ||
            process.env.TRIVIA_ENGINE_LLM_BASE_URL ||
            'https://api.anthropic.com/v1'
        ).replace(/\/+$/, '')
        const model =
            overrides?.model ||
            process.env.TRIVIA_ENGINE_LLM_MODEL ||
            'claude-sonnet-4-6'
        const apiKey =
            overrides?.apiKey ||
            process.env.TRIVIA_ENGINE_LLM_API_KEY ||
            process.env.ANTHROPIC_API_KEY ||
            ''
        return {
            provider: 'anthropic',
            baseUrl,
            apiKey,
            model,
            enableThinking: overrides?.enableThinking ?? false,
            timeoutMs: overrides?.timeoutMs ?? 180_000,
        }
    }

    const baseUrl =
        overrides?.baseUrl ||
        process.env.TRIVIA_ENGINE_LLM_BASE_URL ||
        process.env.LOCAL_LLM_BASE_URL ||
        (process.env.OPENAI_API_KEY ? 'https://api.openai.com/v1' : 'http://127.0.0.1:18737/v1')

    const isLocal = baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost')

    const model =
        overrides?.model ||
        process.env.TRIVIA_ENGINE_LLM_MODEL ||
        (isLocal ? 'Qwen3.8-27B-Swift-Heretic-MXFP4' : 'gpt-4o')

    const apiKey =
        overrides?.apiKey ||
        process.env.TRIVIA_ENGINE_LLM_API_KEY ||
        (isLocal ? 'local-vllm' : process.env.OPENAI_API_KEY || '')

    return {
        provider: 'openai-compatible',
        baseUrl: baseUrl.replace(/\/+$/, ''),
        apiKey,
        model,
        enableThinking: overrides?.enableThinking ?? false,
        timeoutMs: overrides?.timeoutMs ?? (overrides?.enableThinking ? 180_000 : 120_000),
    }
}

/**
 * Extract the first balanced JSON object or array from model output
 * (handles markdown code fences or stray pre/post text).
 */
export function extractJsonFromText<T>(raw: string): T {
    const trimmed = raw.trim()
    // Strip markdown fences if present
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed

    try {
        return JSON.parse(candidate) as T
    } catch {
        // Fallback: find first '{' or '[' and matching closing bracket
        const startObj = candidate.indexOf('{')
        const startArr = candidate.indexOf('[')
        const start =
            startObj === -1
                ? startArr
                : startArr === -1
                    ? startObj
                    : Math.min(startObj, startArr)
        if (start === -1) {
            throw new Error(`No JSON object/array found in LLM output: ${candidate.slice(0, 200)}`)
        }
        const openChar = candidate[start]
        const closeChar = openChar === '{' ? '}' : ']'
        let depth = 0
        let inString = false
        let escaped = false
        for (let i = start; i < candidate.length; i++) {
            const ch = candidate[i]
            if (inString) {
                if (escaped) {
                    escaped = false
                } else if (ch === '\\') {
                    escaped = true
                } else if (ch === '"') {
                    inString = false
                }
            } else {
                if (ch === '"') {
                    inString = true
                } else if (ch === openChar) {
                    depth++
                } else if (ch === closeChar) {
                    depth--
                    if (depth === 0) {
                        return JSON.parse(candidate.slice(start, i + 1)) as T
                    }
                }
            }
        }
        throw new Error(`Unterminated JSON in LLM output: ${candidate.slice(start, start + 240)}`)
    }
}

export async function discoverActiveLocalModel(baseUrl: string): Promise<string | null> {
    try {
        const resp = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
            signal: AbortSignal.timeout(5_000),
        })
        if (!resp.ok) return null
        const json = (await resp.json()) as { data?: Array<{ id?: string }> }
        return json.data?.[0]?.id || null
    } catch {
        return null
    }
}

export async function callLlmJson<T>(
    config: LlmConfig,
    options: LlmJsonCallOptions
): Promise<LlmJsonResponse<T>> {
    const temperature = options.temperature ?? 0.5
    const enableThinking = options.enableThinking ?? config.enableThinking ?? false
    const baseMaxTokens = options.maxTokens ?? (enableThinking ? 5120 : 2400)
    const maxTokens = enableThinking ? Math.max(baseMaxTokens, 5120) : baseMaxTokens

    const isLocal = config.baseUrl.includes('127.0.0.1') || config.baseUrl.includes('localhost')
    let activeModel = config.model

    if (isLocal && (!activeModel || activeModel === 'auto')) {
        const discovered = await discoverActiveLocalModel(config.baseUrl)
        if (discovered) activeModel = discovered
    }

    const samplingParams = {
        temperature,
        maxTokens,
        enableThinking,
    }

    let lastError: unknown = null
    let dynamicMaxTokens = maxTokens
    const isAnthropic = config.provider === 'anthropic' || config.baseUrl.includes('anthropic.com')

    for (let attempt = 0; attempt < 6; attempt++) {
        try {
            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 120_000)

            let rawText = ''
            let servedModel = activeModel

            if (isAnthropic) {
                const resp = await fetch(`${config.baseUrl}/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': config.apiKey,
                        'anthropic-version': '2023-06-01',
                    },
                    body: JSON.stringify({
                        model: activeModel,
                        max_tokens: dynamicMaxTokens,
                        temperature,
                        system: options.systemPrompt,
                        messages: [{ role: 'user', content: options.userPrompt }],
                    }),
                    signal: controller.signal,
                })
                clearTimeout(timer)

                if (!resp.ok) {
                    const errText = await resp.text().catch(() => '')
                    throw new Error(`Anthropic HTTP ${resp.status}: ${errText.slice(0, 300)}`)
                }
                const payload = (await resp.json()) as {
                    model?: string
                    content?: Array<{ type?: string; text?: string }>
                }
                rawText = (payload.content || [])
                    .filter((b) => b.type === 'text' && b.text)
                    .map((b) => b.text)
                    .join('\n')
                servedModel = payload.model || activeModel
            } else {
                const body: Record<string, unknown> = {
                    model: activeModel,
                    messages: [
                        { role: 'system', content: options.systemPrompt },
                        { role: 'user', content: options.userPrompt },
                    ],
                    temperature,
                    max_tokens: dynamicMaxTokens,
                }

                if (isLocal) {
                    body.chat_template_kwargs = { enable_thinking: enableThinking }
                } else {
                    body.response_format = { type: 'json_object' }
                }

                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                }
                if (config.apiKey) {
                    headers.Authorization = `Bearer ${config.apiKey}`
                }

                const resp = await fetch(`${config.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                    signal: controller.signal,
                })
                clearTimeout(timer)

                if (!resp.ok) {
                    const errText = await resp.text().catch(() => '')
                    // If local vLLM hot-swapped models, re-discover and retry cleanly
                    if (isLocal && (resp.status === 404 || resp.status >= 500)) {
                        const discovered = await discoverActiveLocalModel(config.baseUrl)
                        if (discovered) {
                            activeModel = discovered
                            config.model = discovered
                        }
                        await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)))
                        continue
                    }
                    throw new Error(`LLM HTTP ${resp.status}: ${errText.slice(0, 300)}`)
                }

                const payload = (await resp.json()) as {
                    model?: string
                    choices?: Array<{ message?: { content?: string | null } }>
                }
                rawText = payload.choices?.[0]?.message?.content ?? ''
                servedModel = payload.model || activeModel
            }

            if (!rawText || !rawText.trim()) {
                // Some local thinking models need more token budget to emit final content
                dynamicMaxTokens = Math.min(dynamicMaxTokens * 2, 8192)
                throw new Error('LLM returned empty content (increasing max_tokens and retrying)')
            }

            const data = extractJsonFromText<T>(rawText)
            return {
                data,
                rawText,
                model: servedModel,
                samplingParams: { ...samplingParams, maxTokens: dynamicMaxTokens },
            }
        } catch (err) {
            lastError = err
            if (attempt < 5) {
                // On local connection errors (e.g., vLLM model reload), wait and re-discover model
                const waitMs = isLocal ? 3000 * (attempt + 1) : 1000 * (attempt + 1)
                await new Promise((r) => setTimeout(r, waitMs))
                if (isLocal) {
                    const discovered = await discoverActiveLocalModel(config.baseUrl)
                    if (discovered) {
                        activeModel = discovered
                        config.model = discovered
                    }
                }
            }
        }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
