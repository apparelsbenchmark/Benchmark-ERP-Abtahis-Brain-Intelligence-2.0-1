import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Dashboard from '../components/Dashboard';

/**
 * Require a session cookie before rendering the dashboard route.
 * The ERP API still verifies the cookie signature and expiry on every request;
 * this server-side check prevents the root URL from opening the dashboard first.
 */
export default function Page() {
  const sessionCookie = cookies().get('benchmark_erp_session')?.value;
  if (!sessionCookie) redirect('/login');
  return <Dashboard />;
}
