import { useQuery } from '@tanstack/react-query'
import { getCategories } from '../api/categories'
import { categoryQueryKeys } from '../query-keys'

export function useCategories() {
  return useQuery({
    queryKey: categoryQueryKeys.list(),
    queryFn: getCategories,
  })
}
