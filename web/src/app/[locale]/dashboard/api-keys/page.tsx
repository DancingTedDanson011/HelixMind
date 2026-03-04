import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ApiKeyManagerFull } from '@/components/dashboard/ApiKeyManagerFull';
import { LLMKeySettings } from '@/components/dashboard/LLMKeySettings';

export default async function ApiKeysPage() {
  const session = await auth();
  if (!session?.user) redirect('/auth/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      subscription: true,
      apiKeys: {
        where: { revokedAt: null },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!user) redirect('/auth/login');

  return (
    <DashboardLayout
      user={{
        name: user.name,
        email: user.email,
        plan: user.subscription?.plan || 'FREE',
      }}
    >
      <div className="space-y-8">
        {/* Section 1: LLM Provider Keys (for brainstorm without CLI) */}
        <LLMKeySettings />

        {/* Section 2: HelixMind API Keys (for Brain API access) */}
        <ApiKeyManagerFull
          apiKeys={user.apiKeys.map((k) => ({
            id: k.id,
            name: k.name,
            keyPrefix: k.keyPrefix,
            scopes: k.scopes,
            createdAt: k.createdAt.toISOString(),
            lastUsed: k.lastUsed?.toISOString() || null,
          }))}
        />
      </div>
    </DashboardLayout>
  );
}
