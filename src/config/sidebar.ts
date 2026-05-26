import {
  LayoutDashboard,
  Users,
  UserPlus,
} from 'lucide-react'

import type { SidebarItem } from '@/types/sidebar'

export const sidebarItems: SidebarItem[] = [
  {
    title: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    access: ['admin', 'manager', 'staff'],
  },
  {
    title: 'Customer',
    icon: Users,
    access: ['admin', 'manager', 'staff'],
    children: [
      {
        title: 'Onboarding',
        path: '/customer/onboarding',
        icon: UserPlus,
        access: ['admin', 'manager', 'staff'],
      },
    ],
  }    
]