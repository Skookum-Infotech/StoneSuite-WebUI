import { Link } from 'react-router-dom';
import { Workflow, ShieldCheck, ArrowRight, UsersRound } from 'lucide-react';
import { PageHeader } from '@/components/tenant/ui';

/**
 * Configuration hub — the place to build/configure the platform, kept
 * separate from the daily workspace. Extensible: add cards here as new
 * builders (SSO, audit, teams) come online.
 */
const sections = [
  {
    to: '/config/workflows',
    icon: Workflow,
    title: 'Workflows',
    description: 'Design record state machines: states, transitions, guards, and custom fields. Enabled workflows show up in the workspace sidebar.',
  },
  {
    to: '/config/roles',
    icon: ShieldCheck,
    title: 'Roles & Access',
    description: 'Compose roles from the permission catalog (resource × action × scope) and control what each user can do.',
  },
  {
    to: '/config/users',
    icon: UsersRound,
    title: 'Users',
    description: 'Invite team members, assign roles, suspend or deactivate accounts, and manage pending invitations.',
  },
];

export default function ConfigHomePage() {
  return (
    <div className="p-6 3xl:p-10 4xl:p-14">
      <PageHeader
        title="Configuration"
        subtitle="Build and configure your workspace. Changes here drive the dynamic UI everywhere else."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.to}
              to={s.to}
              className="group flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-5 transition-colors hover:border-brand dark:border-stone-800 dark:bg-stone-900"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
                <Icon className="size-5" />
              </div>
              <div>
                <h2 className="flex items-center gap-1 text-sm font-bold text-stone-900 dark:text-white">
                  {s.title}
                  <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </h2>
                <p className="mt-1 text-xs text-stone-500">{s.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
