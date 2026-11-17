import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { queryClient } from '@/lib/queryClient';
import { router } from './router';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        richColors
        position="top-right"
        closeButton
        toastOptions={{
          classNames: {
            title: 'text-body font-medium',
            description: 'text-field',
            // Approved: success message text in dark gray, title stays in the success green.
            success: '[&_[data-description]]:text-ink!',
          },
        }}
      />
    </QueryClientProvider>
  );
}
