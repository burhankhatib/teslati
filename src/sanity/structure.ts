import type {StructureResolver} from 'sanity/structure'

// https://www.sanity.io/docs/structure-builder-cheat-sheet
export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      // Articles with filtering options
      S.listItem()
        .title('Articles')
        .schemaType('article')
        .child(
          S.documentTypeList('article')
            .title('All Articles')
            .defaultOrdering([{ field: '_createdAt', direction: 'desc' }])
            .canHandleIntent((intentName, params) => {
              return intentName === 'edit' && params.type === 'article'
            })
        ),
      // Other document types
      ...S.documentTypeListItems().filter(
        (listItem) => !['article'].includes(listItem.getId()!)
      ),
    ])
