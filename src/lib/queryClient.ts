import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Treat all data as fresh for 2 minutes — prevents re-fetching the same
      // endpoint when navigating away and back within a normal work session.
      staleTime: 2 * 60 * 1000,
    },
  },
});
