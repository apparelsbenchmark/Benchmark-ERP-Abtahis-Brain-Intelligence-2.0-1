import './globals.css';
import type { ReactNode } from 'react';
import AbtahisBrain from '../components/AbtahisBrain';

export const metadata = {
  title: 'Benchmark Group ERP',
  description: 'Benchmark RMG Management Control Tower'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}<AbtahisBrain /></body></html>;
}
