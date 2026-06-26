import express from 'express'
import {
  createInvalidJsonResponse,
  handleCompareRequest,
} from './compareApi.js'

const app = express()
const port = Number.parseInt(process.env.PORT ?? '8787', 10)

app.use(express.json({ limit: '1mb' }))

app.post('/api/compare', async (request, response) => {
  const result = await handleCompareRequest(request.body)
  response.status(result.status).json(result.body)
})

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    if (
      error instanceof SyntaxError &&
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      error.status === 400
    ) {
      const invalidJsonResponse = createInvalidJsonResponse()
      response.status(invalidJsonResponse.status).json(invalidJsonResponse.body)
      return
    }

    throw error
  },
)

app.listen(port, () => {
  console.log(`fast-footprint-compare API listening on http://localhost:${port}`)
})
