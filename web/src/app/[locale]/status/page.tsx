import { StatusPage } from '@/components/sla/StatusPage';

export const metadata = {
  title: 'HelixMind Status',
  description: 'Real-time system status and uptime monitoring for HelixMind services.',
};

export default function StatusRoute() {
  return <StatusPage />;
}
