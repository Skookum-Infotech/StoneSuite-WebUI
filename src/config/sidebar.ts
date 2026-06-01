import {
  LayoutDashboard,
  Users,
  UserPlus,
  Handshake,
  Network,
  Sparkles,
  Target
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
  },
  {
    title: 'CRM',
    icon: Network,
    access: ['admin', 'manager', 'staff'],
    children: [
      {
        title: 'Lead',
        path: '/crm/lead',
        icon: Sparkles,
        access: ['admin', 'manager', 'staff'],
      },
      {
        title: 'Prospect',
        path: '/crm/prospect',
        icon: Target,
        access: ['admin', 'manager', 'staff'],
      },
      {
        title: 'Customer',
        path: '/crm/customer',
        icon: Handshake,
        access: ['admin', 'manager', 'staff'],
      }
    ]
  }    
]