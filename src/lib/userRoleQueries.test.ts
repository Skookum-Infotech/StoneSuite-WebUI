import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  invalidateUserRoleQueries,
  USERS_QUERY_KEY,
  USER_PERMISSIONS_QUERY_KEY,
} from './userRoleQueries';

const CURRENT_USER_ID = 'user-1';

function seededClient(): QueryClient {
  const qc = new QueryClient();
  qc.setQueryData([USERS_QUERY_KEY], []);
  qc.setQueryData([USER_PERMISSIONS_QUERY_KEY, CURRENT_USER_ID], { grants: [], activeRoleId: '', roles: [] });
  qc.setQueryData(['roles'], []);
  return qc;
}

describe('invalidateUserRoleQueries', () => {
  const cases: { name: string; key: readonly unknown[]; invalidated: boolean }[] = [
    { name: 'the Users page list', key: [USERS_QUERY_KEY], invalidated: true },
    {
      name: "the signed-in user's roles and grants (keyed per user id)",
      key: [USER_PERMISSIONS_QUERY_KEY, CURRENT_USER_ID],
      invalidated: true,
    },
    { name: 'the unrelated role catalogue', key: ['roles'], invalidated: false },
  ];

  it.each(cases)('marks $name invalidated=$invalidated', async ({ key, invalidated }) => {
    const qc = seededClient();

    await invalidateUserRoleQueries(qc);

    expect(qc.getQueryState(key)?.isInvalidated).toBe(invalidated);
  });
});
