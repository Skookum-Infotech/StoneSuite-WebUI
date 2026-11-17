import { Layers, ShieldCheck, Zap } from 'lucide-react'
import { AuthHero, type AuthHeroCopy, type AuthHeroFeature } from './AuthHero'

const COPY: AuthHeroCopy = {
  badge: 'Next-Gen Platform',
  lead: 'Elevate your',
  accent: 'stone operations.',
  description:
    'Experience seamless workflow management, real-time material tracking, and unmatched clarity across your entire fabrication process.',
}

const FEATURES: AuthHeroFeature[] = [
  { icon: <Zap className="size-4" />, title: 'Smart Workflows', text: 'Automate tasks and streamline coordination.' },
  { icon: <ShieldCheck className="size-4" />, title: 'Ironclad Security', text: 'Enterprise-grade protection for your data.' },
  { icon: <Layers className="size-4" />, title: 'Material Tracking', text: 'Real-time slab and inventory visibility.' },
]

// The decorative panel beside the login form.
export function LoginHero() {
  return <AuthHero copy={COPY} features={FEATURES} showSocial />
}
