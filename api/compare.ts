import {
  createInvalidJsonResponse,
  handleCompareRequest,
} from '../server/compareApi.js'
import { createPostApiHandler } from '../server/postApiHandler.js'

export default createPostApiHandler({
  createInvalidJsonResponse,
  endpoint: 'compare',
  handleRequest: handleCompareRequest,
})
