import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

export function useNotifications() {
  const recent = useQuery(api.nudges.queries.recent)
  const unreadCount = useQuery(api.nudges.queries.unreadCount) ?? 0
  const markRead = useMutation(api.nudges.queries.markRead)
  const markAllRead = useMutation(api.nudges.queries.markAllRead)

  return {
    notifications: recent ?? [],
    unreadCount,
    markRead: (id: Id<'notifications'>) => markRead({ id }),
    markAllRead: () => markAllRead(),
    loading: recent === undefined,
  }
}
