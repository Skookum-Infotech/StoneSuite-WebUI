// Pages that take the whole screen for their own tools and so show no breadcrumb bar.

/** The countertop drawing editor, /sales/sales_order/:id/drawing. */
const FULL_SCREEN_PAGES: readonly RegExp[] = [/^\/sales\/sales_order\/[^/]+\/drawing\/?$/];

export function hidesBreadcrumbs(pathname: string): boolean {
  return FULL_SCREEN_PAGES.some((page) => page.test(pathname));
}
