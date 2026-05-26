import type { LucideIcon } from 'lucide-react'

export type SidebarAccessRole = 'admin' | 'manager' | 'staff'

export interface SidebarItem {
  title: string
  path?: string
  icon: LucideIcon
  access?: SidebarAccessRole[]
  children?: SidebarItem[]
}