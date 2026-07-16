interface ApiResult {
  body: unknown
  status: number
}

interface PostApiHandlerOptions {
  createInvalidJsonResponse: () => ApiResult
  endpoint: string
  handleRequest: (requestBody: unknown) => Promise<ApiResult>
}

const createJsonResponse = (
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
    status,
  })

export const createPostApiHandler = ({
  createInvalidJsonResponse,
  endpoint,
  handleRequest,
}: PostApiHandlerOptions) => ({
  async fetch(request: Request) {
    if (request.method !== 'POST') {
      return createJsonResponse(
        {
          error: {
            code: 'METHOD_NOT_ALLOWED',
            hint: `Use POST /api/${endpoint}.`,
            message: 'Only POST is supported on this endpoint.',
          },
        },
        405,
        { allow: 'POST' },
      )
    }

    let requestBody: unknown
    try {
      requestBody = await request.json()
    } catch {
      const result = createInvalidJsonResponse()
      return createJsonResponse(result.body, result.status)
    }

    const result = await handleRequest(requestBody)
    return createJsonResponse(result.body, result.status)
  },
})
