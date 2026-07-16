import {
  createDiscoverInvalidJsonResponse,
  handleDiscoverRequest,
} from '../server/discoverApi.js'
import { createPostApiHandler } from '../server/postApiHandler.js'

export default createPostApiHandler({
  createInvalidJsonResponse: createDiscoverInvalidJsonResponse,
  endpoint: 'discover',
  handleRequest: handleDiscoverRequest,
})
