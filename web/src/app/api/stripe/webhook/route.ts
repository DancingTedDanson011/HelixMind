import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import type Stripe from 'stripe';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription && session.metadata?.userId) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          const priceId = sub.items.data[0]?.price.id;

          const plan = getPlanFromPriceId(priceId);
          const period = sub.items.data[0]?.price.recurring?.interval === 'year' ? 'YEARLY' : 'MONTHLY';

          await prisma.subscription.update({
            where: { userId: session.metadata.userId },
            data: {
              stripeSubscriptionId: sub.id,
              plan,
              status: 'ACTIVE',
              billingPeriod: period,
              currentPeriodStart: new Date(sub.current_period_start * 1000),
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
            },
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const priceId = sub.items.data[0]?.price.id;
        const plan = getPlanFromPriceId(priceId);

        await prisma.subscription.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            plan,
            status: mapStripeStatus(sub.status),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        await prisma.subscription.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            plan: 'FREE',
            status: 'CANCELED',
            stripeSubscriptionId: null,
          },
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        await prisma.subscription.updateMany({
          where: { stripeCustomerId: customerId },
          data: { status: 'PAST_DUE' },
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
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
