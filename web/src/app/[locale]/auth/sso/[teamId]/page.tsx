import { SSOLogin } from '@/components/auth/SSOLogin';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{ locale: string; teamId: string }>;
}

export default async function SSOTeamLoginPage({ params }: PageProps) {
  const { teamId } = await params;

  if (!teamId) {
    notFound();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-20">
      <SSOLogin teamId={teamId} />
    </div>
  );
}
