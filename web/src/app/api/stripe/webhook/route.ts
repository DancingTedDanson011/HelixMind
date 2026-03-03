import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import type Stripe from 'stripe';
import type { PrismaClient } from '@prisma/client';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Idempotency: skip already-processed events
  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { id: event.id },
  });
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Phase 1: Stripe API calls (outside transaction)
  let checkoutSub: Stripe.Subscription | null = null;
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.subscription && session.metadata?.userId) {
      checkoutSub = await stripe().subscriptions.retrieve(session.subscription as string);
    }
  }

  // Phase 2: DB writes in transaction (idempotent)
  try {
    await prisma.$transaction(async (tx) => {
      await tx.stripeWebhookEvent.create({
        data: { id: event.id, type: event.type },
      });

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          if (checkoutSub && session.metadata?.userId) {
            const priceId = checkoutSub.items.data[0]?.price.id;
            const plan = getPlanFromPriceId(priceId);
            const period = checkoutSub.items.data[0]?.price.recurring?.interval === 'year' ? 'YEARLY' : 'MONTHLY';

            await tx.subscription.update({
              where: { userId: session.metadata.userId },
              data: {
                stripeSubscriptionId: checkoutSub.id,
                plan,
                status: 'ACTIVE',
                billingPeriod: period,
                currentPeriodStart: new Date(checkoutSub.current_period_start * 1000),
                currentPeriodEnd: new Date(checkoutSub.current_period_end * 1000),
              },
            });
          }
          break;
        }

        case 'customer.subscription.updated': {
          await handleSubscriptionUpdated(tx, event);
          break;
        }

        case 'customer.subscription.deleted': {
          await handleSubscriptionDeleted(tx, event);
          break;
        }

        case 'invoice.payment_failed': {
          await handlePaymentFailed(tx, event);
          break;
        }
      }
    });

    // Send billing notifications (fire-and-forget, outside transaction)
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const s = event.data.object as Stripe.Checkout.Session;
          if (s.metadata?.userId) {
            await createNotification({
              userId: s.metadata.userId,
              type: 'BILLING',
              title: 'Subscription Activated',
              body: 'Your plan is now active. Welcome aboard!',
              link: '/dashboard/billing',
            });
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const canceled = await prisma.subscription.findFirst({
            where: { stripeCustomerId: sub.customer as string },
            select: { userId: true },
          });
          if (canceled) {
            await createNotification({
              userId: canceled.userId,
              type: 'BILLING',
              title: 'Subscription Canceled',
              body: 'Your subscription has been canceled. You can resubscribe anytime.',
              link: '/dashboard/billing',
            });
          }
          break;
        }
        case 'invoice.payment_failed': {
          const inv = event.data.object as Stripe.Invoice;
          const failed = await prisma.subscription.findFirst({
            where: { stripeCustomerId: inv.customer as string },
            select: { userId: true },
          });
          if (failed) {
            await createNotification({
              userId: failed.userId,
              type: 'BILLING',
              title: 'Payment Failed',
              body: 'Your payment could not be processed. Please update your billing info.',
              link: '/dashboard/billing',
            });
          }
          break;
        }
      }
    } catch (notifErr) {
      console.error('Billing notification error:', notifErr);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    // Race condition: another request already recorded this event
    if (error?.code === 'P2002') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleSubscriptionUpdated(tx: Tx, event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription;
  const customerId = sub.customer as string;
  const priceId = sub.items.data[0]?.price.id;
  const plan = getPlanFromPriceId(priceId);

  await tx.subscription.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      plan,
      status: mapStripeStatus(sub.status),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    },
  });
}

async function handleSubscriptionDeleted(tx: Tx, event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription;
  const customerId = sub.customer as string;

  await tx.subscription.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      plan: 'FREE',
      status: 'CANCELED',
      stripeSubscriptionId: null,
    },
  });
}

async function handlePaymentFailed(tx: Tx, event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = invoice.customer as string;

  await tx.subscription.updateMany({
    where: { stripeCustomerId: customerId },
    data: { status: 'PAST_DUE' },
  });
}

function getPlanFromPriceId(priceId: string): 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE' {
  const priceMap: Record<string, 'PRO' | 'TEAM'> = {
    [process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '']: 'PRO',
    [process.env.STRIPE_PRO_YEARLY_PRICE_ID || '']: 'PRO',
    [process.env.STRIPE_TEAM_MONTHLY_PRICE_ID || '']: 'TEAM',
    [process.env.STRIPE_TEAM_YEARLY_PRICE_ID || '']: 'TEAM',
  };
  return priceMap[priceId] || 'FREE';
}

function mapStripeStatus(status: string): 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID' | 'TRIALING' {
  const map: Record<string, 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID' | 'TRIALING'> = {
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    unpaid: 'UNPAID',
    trialing: 'TRIALING',
  };
  return map[status] || 'ACTIVE';
}
