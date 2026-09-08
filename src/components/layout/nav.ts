import {
  BarChart3,
  BookMarked,
  Briefcase,
  CalendarClock,
  Columns3,
  ListChecks,
  Settings as SettingsIcon,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Single letter used by the "g then …" navigation sequence. */
  sequenceKey: string
  /** Shown in the mobile tab bar. */
  primaryMobile: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/today', label: 'Today', icon: ListChecks, sequenceKey: 't', primaryMobile: true },
  { to: '/opportunities', label: 'Opportunities', icon: Briefcase, sequenceKey: 'o', primaryMobile: true },
  { to: '/pipeline', label: 'Pipeline', icon: Columns3, sequenceKey: 'p', primaryMobile: true },
  { to: '/contacts', label: 'Contacts', icon: Users, sequenceKey: 'c', primaryMobile: true },
  { to: '/interviews', label: 'Interviews', icon: CalendarClock, sequenceKey: 'i', primaryMobile: false },
  { to: '/stories', label: 'Story Bank', icon: BookMarked, sequenceKey: 's', primaryMobile: false },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, sequenceKey: 'a', primaryMobile: false },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, sequenceKey: ',', primaryMobile: false },
]
