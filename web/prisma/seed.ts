import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ─── 1. Admin User ───────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@helixmind.dev';
  const adminPassword = process.env.ADMIN_PASSWORD || 'HelixAdmin2024!';

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const admin = await prisma.user.create({
      data: {
        name: 'Admin',
        email: adminEmail,
        passwordHash,
        role: 'ADMIN',
        emailVerified: new Date(),
        subscription: {
          create: { plan: 'ENTERPRISE', status: 'ACTIVE' },
        },
      },
    });
    console.log(`✅ Admin user created: ${admin.email}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   ⚠️  Change this password immediately!\n`);
  } else {
    console.log(`ℹ️  Admin user already exists: ${adminEmail}\n`);
  }

  // ─── 1b. Promote ECLIPS FACTORY to ADMIN ────
  const eclipsEmail = 'xinicetm@gmail.com';
  const eclipsUser = await prisma.user.findUnique({ where: { email: eclipsEmail } });
  if (eclipsUser) {
    if (eclipsUser.role !== 'ADMIN') {
      await prisma.user.update({
        where: { email: eclipsEmail },
        data: { role: 'ADMIN', name: eclipsUser.name || 'ECLIPS FACTORY' },
      });
      console.log(`✅ ${eclipsEmail} promoted to ADMIN`);
    } else {
      console.log(`ℹ️  ${eclipsEmail} is already ADMIN`);
    }
  } else {
    console.log(`ℹ️  ${eclipsEmail} not yet registered — will be promoted on first login\n`);
  }

  // ─── 2. Support User ─────────────────────────
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@helixmind.dev';
  const supportPassword = process.env.SUPPORT_PASSWORD || 'HelixSupport2024!';

  const existingSupport = await prisma.user.findUnique({ where: { email: supportEmail } });

  if (!existingSupport) {
    const passwordHash = await bcrypt.hash(supportPassword, 12);
    await prisma.user.create({
      data: {
        name: 'Support',
        email: supportEmail,
        passwordHash,
        role: 'SUPPORT',
        emailVerified: new Date(),
        subscription: {
          create: { plan: 'ENTERPRISE', status: 'ACTIVE' },
        },
      },
    });
    console.log(`✅ Support user created: ${supportEmail}`);
    console.log(`   Password: ${supportPassword}\n`);
  } else {
    console.log(`ℹ️  Support user already exists: ${supportEmail}\n`);
  }

  // ─── 3. System Settings ──────────────────────
  const defaultSettings = [
    { key: 'NEXTAUTH_SECRET', category: 'auth', label: 'NextAuth Secret', description: 'JWT signing secret (generate with: openssl rand -base64 32)', isSecret: true },
    { key: 'GITHUB_CLIENT_ID', category: 'auth', label: 'GitHub OAuth Client ID', description: 'GitHub Developer Settings > OAuth Apps', isSecret: false },
    { key: 'GITHUB_CLIENT_SECRET', category: 'auth', label: 'GitHub OAuth Client Secret', description: 'GitHub Developer Settings > OAuth Apps', isSecret: true },
    { key: 'GOOGLE_CLIENT_ID', category: 'auth', label: 'Google OAuth Client ID', description: 'Google Cloud Console > Credentials', isSecret: false },
    { key: 'GOOGLE_CLIENT_SECRET', category: 'auth', label: 'Google OAuth Client Secret', description: 'Google Cloud Console > Credentials', isSecret: true },
    { key: 'STRIPE_SECRET_KEY', category: 'payments', label: 'Stripe Secret Key', description: 'Stripe Dashboard > API Keys (sk_...)', isSecret: true },
    { key: 'STRIPE_WEBHOOK_SECRET', category: 'payments', label: 'Stripe Webhook Secret', description: 'Stripe Dashboard > Webhooks (whsec_...)', isSecret: true },
    { key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', category: 'payments', label: 'Stripe Publishable Key', description: 'Stripe Dashboard > API Keys (pk_...)', isSecret: false },
    { key: 'RESEND_API_KEY', category: 'email', label: 'Resend API Key', description: 'Resend Dashboard > API Keys', isSecret: true },
    { key: 'EMAIL_FROM', category: 'email', label: 'Email From Address', description: 'Sender for transactional emails', isSecret: false },
    { key: 'NEXT_PUBLIC_APP_URL', category: 'general', label: 'App URL', description: 'Public URL of the application', isSecret: false },
    { key: 'NEXT_PUBLIC_APP_NAME', category: 'general', label: 'App Name', description: 'Display name of the application', isSecret: false },
  ];

  for (const setting of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: {
        ...setting,
        value: process.env[setting.key] || '',
      },
    });
  }
  console.log(`✅ ${defaultSettings.length} system settings initialized\n`);

  // ─── 4. Plan Configurations ──────────────────
  const plans = [
    {
      plan: 'FREE' as const,
      displayName: 'Free',
      monthlyPrice: 0,
      yearlyPrice: 0,
      tokenLimit: null,
      maxApiKeys: 2,
      features: [
        'Full CLI with all features',
        'Unlimited local spiral memory',
        'Ollama integration',
        '3D Brain visualization',
        'Community support',
      ],
      isActive: true,
      sortOrder: 0,
    },
    {
      plan: 'PRO' as const,
      displayName: 'Pro',
      monthlyPrice: 19,
      yearlyPrice: 190,
      tokenLimit: 500000,
      maxApiKeys: 10,
      features: [
        'Everything in Free',
        'Cloud brain sync',
        'Web Knowledge Enricher',
        'Priority support',
        'API access',
        'Usage analytics',
      ],
      isActive: true,
      sortOrder: 1,
      stripePriceMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || null,
      stripePriceYearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || null,
    },
    {
      plan: 'TEAM' as const,
      displayName: 'Team',
      monthlyPrice: 39,
      yearlyPrice: null,
      tokenLimit: 2000000,
      maxApiKeys: 50,
      features: [
        'Everything in Pro',
        'Shared team brain',
        'Team analytics dashboard',
        'Role-based access',
        'Dedicated support',
        'Custom integrations',
      ],
      isActive: true,
      sortOrder: 2,
      stripePriceMonthly: process.env.STRIPE_TEAM_MONTHLY_PRICE_ID || null,
      stripePriceYearly: process.env.STRIPE_TEAM_YEARLY_PRICE_ID || null,
    },
    {
      plan: 'ENTERPRISE' as const,
      displayName: 'Enterprise',
      monthlyPrice: null,
      yearlyPrice: null,
      tokenLimit: null,
      maxApiKeys: 999,
      features: [
        'Everything in Team',
        'Self-hosted deployment',
        'SSO / SAML',
        'SOC 2 compliance',
        'SLA guarantee',
        'Custom training',
      ],
      isActive: true,
      sortOrder: 3,
    },
  ];

  for (const plan of plans) {
    await prisma.planConfig.upsert({
      where: { plan: plan.plan },
      update: {},
      create: plan,
    });
  }
  console.log(`✅ ${plans.length} plan configurations initialized\n`);

  // ─── 5. FAQ Entries ──────────────────────────
  const faqs = [
    {
      question: { en: 'Is HelixMind free?', de: 'Ist HelixMind kostenlos?' },
      answer: { en: 'Yes! The CLI is fully free and open source. Pro features like cloud sync require a subscription.', de: 'Ja! Das CLI ist vollständig kostenlos und Open Source. Pro-Features wie Cloud-Sync erfordern ein Abo.' },
      category: 'general',
      sortOrder: 0,
    },
    {
      question: { en: 'Does HelixMind work offline?', de: 'Funktioniert HelixMind offline?' },
      answer: { en: 'Yes — with Ollama integration, you can run HelixMind completely offline. Your data never leaves your machine.', de: 'Ja — mit Ollama-Integration kannst du HelixMind komplett offline nutzen. Deine Daten verlassen nie deinen Rechner.' },
      category: 'general',
      sortOrder: 1,
    },
    {
      question: { en: 'What models does HelixMind support?', de: 'Welche Modelle unterstützt HelixMind?' },
      answer: { en: 'Claude (Anthropic), GPT-4 (OpenAI), and any Ollama model. Provider is configurable per project.', de: 'Claude (Anthropic), GPT-4 (OpenAI) und jedes Ollama-Modell. Der Provider ist pro Projekt konfigurierbar.' },
      category: 'technical',
      sortOrder: 2,
    },
  ];

  for (const faq of faqs) {
    const existing = await prisma.faqEntry.findFirst({
      where: { category: faq.category, sortOrder: faq.sortOrder },
    });
    if (!existing) {
      await prisma.faqEntry.create({ data: faq });
    }
  }
  console.log(`✅ FAQ entries initialized\n`);

  console.log('🎉 Seed complete!\n');
  console.log('Staff login: /auth/staff');
  console.log(`  Admin: ${adminEmail}`);
  console.log(`  Support: ${supportEmail}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
