import { create } from 'zustand';

interface BreadcrumbStore {
  labels: Record<string, string>;
  setLabel: (segment: string, label: string) => void;
  clearLabel: (segment: string) => void;
}

export const useBreadcrumbStore = create<BreadcrumbStore>((set) => ({
  labels: {},
  setLabel: (segment, label) =>
    set((s) => ({ labels: { ...s.labels, [segment]: label } })),
  clearLabel: (segment) =>
    set((s) => {
      const { [segment]: _removed, ...rest } = s.labels;
      return { labels: rest };
    }),
}));
