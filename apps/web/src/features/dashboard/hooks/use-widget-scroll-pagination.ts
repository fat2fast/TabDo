import { useState, useEffect, useCallback, useRef } from 'react'

export interface UseWidgetScrollPaginationOptions<T> {
  initialItems?: T[]
  total?: number
  fetchPage: (page: number) => Promise<{ items: T[]; total?: number; hasMore: boolean }>
  pageSize?: number
}

export function useWidgetScrollPagination<T extends { id: string }>({
  initialItems = [],
  total,
  fetchPage,
  pageSize = 5,
}: UseWidgetScrollPaginationOptions<T>) {
  const [items, setItems] = useState<T[]>(initialItems)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(() => {
    if (total !== undefined) return total > initialItems.length
    return initialItems.length >= pageSize
  })
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const initialIds = initialItems.map((i) => i.id).join(',')
  const prevInitialIdsRef = useRef(initialIds)

  // Only reset when initial items actually change in identity or total changes
  useEffect(() => {
    if (prevInitialIdsRef.current !== initialIds) {
      prevInitialIdsRef.current = initialIds
      setItems(initialItems)
      setPage(1)
      if (total !== undefined) {
        setHasMore(total > initialItems.length)
      } else {
        setHasMore(initialItems.length >= pageSize)
      }
    }
  }, [initialIds, initialItems, total, pageSize])

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    try {
      const nextPage = page + 1
      const res = await fetchPage(nextPage)
      if (res.items.length === 0) {
        setHasMore(false)
        return
      }
      let hasMoreItems = res.hasMore
      setItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id))
        const incoming = res.items.filter((i) => !existingIds.has(i.id))
        const newTotal = prev.length + incoming.length
        if (
          res.items.length < pageSize ||
          (res.total !== undefined && newTotal >= res.total)
        ) {
          hasMoreItems = false
        }
        return [...prev, ...incoming]
      })
      setPage(nextPage)
      setHasMore(hasMoreItems)
    } catch {
      setHasMore(false)
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, hasMore, page, fetchPage, pageSize])

  // Direct scroll event listener
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
      if (scrollHeight - scrollTop - clientHeight < 60 && hasMore && !isLoadingMore) {
        loadMore()
      }
    },
    [hasMore, isLoadingMore, loadMore]
  )

  // IntersectionObserver sentinel inside the scroll container
  useEffect(() => {
    const sentinel = sentinelRef.current
    const container = scrollContainerRef.current
    if (!sentinel || !container || !hasMore || isLoadingMore) return
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore()
        }
      },
      {
        root: container,
        rootMargin: '60px',
        threshold: 0,
      }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, loadMore])

  return {
    items,
    hasMore,
    isLoadingMore,
    handleScroll,
    scrollContainerRef,
    sentinelRef,
  }
}
