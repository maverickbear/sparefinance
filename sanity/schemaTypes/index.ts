import { type SchemaTypeDefinition } from 'sanity'
import { blockContentType } from '../schemas/blockContent'
import { postType } from '../schemas/post'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [postType, blockContentType],
}
