import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'App',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Override the root layout's footer — app gets full-height, no footer
  return (
    <div className="fixed inset-0 top-16 flex flex-col bg-background">
      {children}
    </div>
  );
}
