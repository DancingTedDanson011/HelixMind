import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const PRICE_ID_MAP: Record<string, Record<string, string | undefined>> = {
  pro: {
    monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  },
  team: {
    monthly: process.env.STRIPE_TEAM_MONTHLY_PRICE_ID,
    yearly: process.env.STRIPE_TEAM_YEARLY_PRICE_ID,
  },
};

const checkoutSchema = z.object({
  plan: z.enum(['pro', 'team']),
  period: z.enum(['monthly', 'yearly']).default('monthly'),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { plan, period } = parsed.data;
    const priceId = PRICE_ID_MAP[plan]?.[period];

    if (!priceId) {
      return NextResponse.json(
        { error: `No Stripe Price ID configured for ${plan}/${period}` },
        { status: 500 },
      );
    }

    // Get or create Stripe customer
    let subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    let customerId = subscription?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: session.user.name || undefined,
        metadata: { userId: session.user.id },
      });
      customerId = customer.id;

      if (subscription) {
        await prisma.subscription.update({
          where: { userId: session.user.id },
          data: { stripeCustomerId: customerId },
        });
      } else {
        await prisma.subscription.create({
          data: {
            userId: session.user.id,
            stripeCustomerId: customerId,
            plan: 'FREE',
            status: 'ACTIVE',
          },
        });
      }
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?checkout=canceled`,
      metadata: { userId: session.user.id },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
