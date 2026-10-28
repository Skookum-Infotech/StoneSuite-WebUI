import type { AnchorHTMLAttributes, ReactNode } from 'react';

type RouterLinkStubProps = { to: string; children?: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>;

/**
 * Stand-in for react-router's `<Link>` in tests that replace the whole module
 * with `vi.mock('react-router-dom', ...)` and so have no router context. It
 * renders a plain anchor, which keeps the real link semantics a test can query
 * (role "link", href) without needing a router.
 */
export function RouterLinkStub({ to, children, ...rest }: RouterLinkStubProps) {
  return <a href={to} {...rest}>{children}</a>;
}
