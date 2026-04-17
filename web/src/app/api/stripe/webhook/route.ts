import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { checkRateLimit, GENERAL_RATE_LIMIT } from '@/lib/rate-limit';
import type Stripe from 'stripe';
import type { PrismaClient } from '@prisma/client';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export async function POST(req: Request) {
  const rateLimited = checkRateLimit(req, 'stripe-webhook', GENERAL_RATE_LIMIT);
  if (rateLimited) return rateLimited;

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe().webhooks.constructEvent(
      body,
      signature,
      webhookSecret,
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Idempotency: skip already-processed events (only if we finished them).
  // SECURITY (WIDE-WEB-008): we must NOT consider an event processed just
  // because a row exists — a prior attempt may have crashed inside the DB
  // transaction. Only rows with processed=true block the retry.
  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { id: event.id },
  });
  if (existing?.processed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // SECURITY (WIDE-WEB-008): record the event OUTSIDE the work transaction
  // so that a failure during plan handling does not roll the record back and
  // let a replay slip through with different (possibly attacker-chosen) data.
  // We upsert to tolerate a prior crashed attempt that already wrote the row.
  try {
    await prisma.stripeWebhookEvent.upsert({
      where: { id: event.id },
      update: {}, // retain original row on retry
      create: { id: event.id, type: event.type, processed: false },
    });
  } catch (err) {
    console.error('Webhook event record failed:', err);
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 });
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
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          if (checkoutSub && session.metadata?.userId) {
            const priceId = checkoutSub.items.data[0]?.price.id;
            const plan = getPlanFromPriceId(priceId);
            if (!plan) {
              // Unknown price — log and noop. Do NOT throw: we still want to
              // mark the event processed so Stripe stops retrying it. Manual
              // investigation is needed via logs.
              console.error(`[STRIPE] checkout.session.completed with unknown price ${priceId} — skipping update`);
              break;
            }
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

    // Mark processed AFTER the work transaction commits successfully.
    await prisma.stripeWebhookEvent.update({
      where: { id: event.id },
      data: { processed: true, error: null },
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
    // SECURITY (WIDE-WEB-008): record the failure on the event row so ops can
    // see what happened and the retry path is explicit.
    try {
      await prisma.stripeWebhookEvent.update({
        where: { id: event.id },
        data: {
          processed: false,
          error: (error instanceof Error ? error.message : String(error)).slice(0, 2000),
        },
      });
    } catch (recordErr) {
      console.error('Failed to record webhook error state:', recordErr);
    }
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleSubscriptionUpdated(tx: Tx, event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription;
  const customerId = sub.customer as string;
  const priceId = sub.items.data[0]?.price.id;
  const plan = getPlanFromPriceId(priceId);

  // SECURITY (WIDE-WEB-008): when Stripe references a price we do not know,
  // do NOT overwrite the stored plan — leave it untouched and log. Refusing
  // to map silently downgrades us to FREE which is user-visible damage.
  const baseData = {
    status: mapStripeStatus(sub.status),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
  };
  if (!plan) {
    console.error(`[STRIPE] customer.subscription.updated with unknown price ${priceId} — status/period updated, plan left unchanged`);
    await tx.subscription.updateMany({
      where: { stripeCustomerId: customerId },
      data: baseData,
    });
    return;
  }

  await tx.subscription.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      ...baseData,
      plan,
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

// SECURITY (WIDE-WEB-008): returning null for unknown prices keeps the
// webhook idempotent. Throwing here rolls back the work transaction, which
// (combined with the old in-tx event record) used to let Stripe retry the
// same event with a different plan mapping — a path to plan drift.
function getPlanFromPriceId(priceId: string | undefined): 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE' | null {
  if (!priceId) return null;
  const priceMap: Record<string, 'PRO' | 'TEAM'> = {};
  if (process.env.STRIPE_PRO_MONTHLY_PRICE_ID) priceMap[process.env.STRIPE_PRO_MONTHLY_PRICE_ID] = 'PRO';
  if (process.env.STRIPE_PRO_YEARLY_PRICE_ID) priceMap[process.env.STRIPE_PRO_YEARLY_PRICE_ID] = 'PRO';
  if (process.env.STRIPE_TEAM_MONTHLY_PRICE_ID) priceMap[process.env.STRIPE_TEAM_MONTHLY_PRICE_ID] = 'TEAM';
  if (process.env.STRIPE_TEAM_YEARLY_PRICE_ID) priceMap[process.env.STRIPE_TEAM_YEARLY_PRICE_ID] = 'TEAM';
  const plan = priceMap[priceId];
  if (!plan) {
    console.error(`[STRIPE] Unknown price ID: ${priceId} — caller must decide how to proceed`);
    return null;
  }
  return plan;
}

function mapStripeStatus(status: string): 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID' | 'TRIALING' {
  const map: Record<string, 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID' | 'TRIALING'> = {
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    unpaid: 'UNPAID',
    trialing: 'TRIALING',
    incomplete: 'UNPAID',
    incomplete_expired: 'CANCELED',
    paused: 'PAST_DUE',
  };
  return map[status] || 'UNPAID';
}
