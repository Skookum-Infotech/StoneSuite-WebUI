// Routes for the customer-portal "Created Orders" pages. Shared by the router,
// the sidebar entry, the portal allowlist and the pages' own navigation so the
// four can never name different paths.
//
// They sit under /sales so the Sales sidebar group (matchPaths ["/sales"])
// opens on them, but outside every staff module's own prefix.
export const CREATED_ORDERS_PATH = '/sales/created-orders';
export const NEW_CREATED_ORDER_PATH = `${CREATED_ORDERS_PATH}/new`;

/** The detail page of one order, by the id the API gave it. */
export function createdOrderPath(id: string): string {
  return `${CREATED_ORDERS_PATH}/${encodeURIComponent(id)}`;
}

/** The page that changes one order, while it is still editable. */
export function createdOrderEditPath(id: string): string {
  return `${createdOrderPath(id)}/edit`;
}
