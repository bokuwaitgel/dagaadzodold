import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Follower Battle Royale',
  description: 'Instagram follower battle royale prototype',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
