/** Only same-origin, in-app paths — never `//host`, `/\host` or an absolute URL. */
export function isSafeReturnPath(path: string | null | undefined): path is string {
  return typeof path === 'string'
    && path.startsWith('/')
    && !path.startsWith('//')
    && !path.startsWith('/\\');
}
