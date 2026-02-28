import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

export const emailFrom = process.env.EMAIL_FROM || 'HelixMind <noreply@helixmind.dev>';

const baseUrl = () => process.env.NEXTAUTH_URL || 'http://localhost:3000';

// ─── Brand constants for emails ─────────────────────────────────
const brand = {
  primary: '#00d4ff',
  accent: '#8a2be2',
  background: '#050510',
  surface: '#0a0a1a',
  surfaceLight: '#12122a',
  textPrimary: '#e0e0e0',
  textSecondary: '#999999',
  border: '#1a1a3a',
} as const;

// ─── Base layout ─────────────────────────────────────────────────

function emailLayout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:${brand.background}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${brand.background}; padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <span style="font-size:28px; font-weight:700; letter-spacing:1px;">
                <span style="color:${brand.primary};">Helix</span><span style="color:${brand.accent};">Mind</span>
              </span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:${brand.surface}; border:1px solid ${brand.border}; border-radius:12px; padding:40px 36px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:32px;">
              <p style="margin:0; font-size:12px; color:${brand.textSecondary}; line-height:1.6;">
                &copy; ${new Date().getFullYear()} HelixMind &mdash; Spiral Context Memory for AI Coding
              </p>
              <p style="margin:8px 0 0; font-size:12px; color:${brand.textSecondary};">
                <a href="${baseUrl()}" style="color:${brand.primary}; text-decoration:none;">helixmind.dev</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 24px; font-size:22px; font-weight:600; color:#ffffff; line-height:1.3;">${text}</h1>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px; font-size:15px; color:${brand.textPrimary}; line-height:1.6;">${text}</p>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
  <tr>
    <td align="center" style="background:linear-gradient(135deg, ${brand.primary}, ${brand.accent}); border-radius:8px;">
      <a href="${href}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; letter-spacing:0.3px;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

function divider(): string {
  return `<hr style="border:none; border-top:1px solid ${brand.border}; margin:24px 0;" />`;
}

function muted(text: string): string {
  return `<p style="margin:0 0 12px; font-size:13px; color:${brand.textSecondary}; line-height:1.5;">${text}</p>`;
}

function infoBox(text: string): string {
  return `<div style="background-color:${brand.surfaceLight}; border-left:3px solid ${brand.primary}; border-radius:4px; padding:14px 18px; margin:20px 0;">
  <p style="margin:0; font-size:14px; color:${brand.textPrimary}; line-height:1.5;">${text}</p>
</div>`;
}

// ─── Send functions ──────────────────────────────────────────────

/**
 * Send email verification link after registration or email change.
 */
export async function sendVerificationEmail(to: string, token: string) {
  const verifyUrl = `${baseUrl()}/auth/verify?token=${encodeURIComponent(token)}`;

  const html = emailLayout(
    'Verify your email',
    [
      heading('Verify your email address'),
      paragraph('Thanks for signing up for HelixMind. Please verify your email address to activate your account.'),
      button('Verify Email', verifyUrl),
      divider(),
      muted('If the button doesn\'t work, copy and paste this link into your browser:'),
      muted(`<a href="${verifyUrl}" style="color:${brand.primary}; word-break:break-all;">${verifyUrl}</a>`),
      muted('This link expires in 24 hours. If you did not create an account, you can safely ignore this email.'),
    ].join('\n'),
  );

  return resend.emails.send({
    from: emailFrom,
    to,
    subject: 'Verify your email — HelixMind',
    html,
  });
}

/**
 * Send password reset link.
 */
export async function sendPasswordResetEmail(to: string, token: string) {
  const resetUrl = `${baseUrl()}/auth/reset-password?token=${encodeURIComponent(token)}`;

  const html = emailLayout(
    'Reset your password',
    [
      heading('Reset your password'),
      paragraph('We received a request to reset the password for your HelixMind account. Click the button below to choose a new password.'),
      button('Reset Password', resetUrl),
      divider(),
      muted('If the button doesn\'t work, copy and paste this link into your browser:'),
      muted(`<a href="${resetUrl}" style="color:${brand.primary}; word-break:break-all;">${resetUrl}</a>`),
      muted('This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.'),
    ].join('\n'),
  );

  return resend.emails.send({
    from: emailFrom,
    to,
    subject: 'Reset your password — HelixMind',
    html,
  });
}

/**
 * Send welcome email after successful registration.
 */
export async function sendWelcomeEmail(to: string, name: string) {
  const dashboardUrl = `${baseUrl()}/dashboard`;
  const docsUrl = `${baseUrl()}/docs`;

  const html = emailLayout(
    'Welcome to HelixMind',
    [
      heading(`Welcome to HelixMind, ${name}!`),
      paragraph('Your account is ready. HelixMind gives your AI coding agent a spiral context memory — so it remembers what matters and forgets what doesn\'t.'),
      infoBox('Get started: install the CLI, run <code style="color:' + brand.primary + '; background:' + brand.background + '; padding:2px 6px; border-radius:3px; font-size:13px;">helixmind init</code> in your project, and start coding with context that evolves.'),
      button('Go to Dashboard', dashboardUrl),
      divider(),
      paragraph('Here are a few things you can do next:'),
      `<ul style="margin:0 0 16px; padding-left:20px; color:${brand.textPrimary}; font-size:14px; line-height:2;">
        <li>Read the <a href="${docsUrl}" style="color:${brand.primary}; text-decoration:none;">documentation</a></li>
        <li>Set up your first project with <code style="color:${brand.primary}; font-size:13px;">helixmind init</code></li>
        <li>Explore the spiral memory with <code style="color:${brand.primary}; font-size:13px;">helixmind spiral status</code></li>
      </ul>`,
      muted('If you have questions, open a support ticket from your dashboard.'),
    ].join('\n'),
  );

  return resend.emails.send({
    from: emailFrom,
    to,
    subject: 'Welcome to HelixMind — Let\'s get started',
    html,
  });
}

/**
 * Notify user about a response on their support ticket.
 */
export async function sendTicketResponseEmail(
  to: string,
  ticketId: string,
  message: string,
) {
  const ticketUrl = `${baseUrl()}/dashboard/support/${encodeURIComponent(ticketId)}`;

  // Sanitize message for safe HTML embedding (basic XSS prevention)
  const sanitized = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br />');

  const html = emailLayout(
    'Support Ticket Update',
    [
      heading('New reply on your support ticket'),
      paragraph('Your support ticket has received a new response:'),
      `<div style="background-color:${brand.surfaceLight}; border:1px solid ${brand.border}; border-radius:8px; padding:20px; margin:20px 0;">
        <p style="margin:0; font-size:14px; color:${brand.textPrimary}; line-height:1.6;">${sanitized}</p>
      </div>`,
      button('View Ticket', ticketUrl),
      divider(),
      muted(`Ticket ID: ${ticketId}`),
      muted('You can reply directly from your dashboard.'),
    ].join('\n'),
  );

  return resend.emails.send({
    from: emailFrom,
    to,
    subject: `Ticket update — HelixMind Support`,
    html,
  });
}

/**
 * Send subscription confirmation after plan change or initial purchase.
 */
export async function sendSubscriptionConfirmEmail(to: string, plan: string) {
  const billingUrl = `${baseUrl()}/dashboard/billing`;

  const planDisplay = plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase();

  const html = emailLayout(
    'Subscription Confirmed',
    [
      heading('Subscription confirmed'),
      paragraph(`Your HelixMind <strong style="color:${brand.primary};">${planDisplay}</strong> plan is now active.`),
      infoBox(`Plan: <strong>${planDisplay}</strong> — You now have access to all ${planDisplay} features. Your billing cycle starts today.`),
      button('Manage Billing', billingUrl),
      divider(),
      muted('You can manage your subscription, update payment methods, or cancel anytime from your billing dashboard.'),
      muted('If you have questions about your plan, open a support ticket or check our documentation.'),
    ].join('\n'),
  );

  return resend.emails.send({
    from: emailFrom,
    to,
    subject: `${planDisplay} plan activated — HelixMind`,
    html,
  });
}
