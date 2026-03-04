// SAML 2.0 helper for NextAuth integration
// Uses @node-saml/node-saml for assertion validation
// Provides: generateMetadata(), validateAssertion(), buildAuthnRequest()

import { SAML } from '@node-saml/node-saml';
import { prisma } from './prisma';

const SP_ENTITY_ID = process.env.SAML_SP_ENTITY_ID || process.env.NEXTAUTH_URL || 'https://app.helixmind.dev';

export interface SamlProfile {
  email: string;
  name?: string;
  role?: string;
}

// Get SAML instance for a team's config
export async function getSamlInstance(teamId: string) {
  const config = await prisma.samlConfig.findUnique({ where: { teamId } });
  if (!config) return null;

  const callbackUrl = `${SP_ENTITY_ID}/api/auth/saml/callback`;

  // H7: Reject SHA-1 — only allow SHA-256 and SHA-512 for SAML signatures
  const algo = config.signatureAlgorithm as string;
  const safeAlgo: 'sha256' | 'sha512' = algo === 'sha512' ? 'sha512' : 'sha256';

  const saml = new SAML({
    callbackUrl,
    entryPoint: config.ssoUrl,
    issuer: SP_ENTITY_ID,
    idpCert: config.certificate,
    signatureAlgorithm: safeAlgo,
    wantAssertionsSigned: true,
    audience: SP_ENTITY_ID,
  });

  return { saml, config };
}

// Generate SP metadata XML
export function generateMetadata(): string {
  const callbackUrl = `${SP_ENTITY_ID}/api/auth/saml/callback`;
  const logoutUrl = `${SP_ENTITY_ID}/api/auth/saml/logout`;
  return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${SP_ENTITY_ID}">
  <SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${callbackUrl}" index="1"/>
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${logoutUrl}"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
}

// Validate SAML assertion and extract profile
export async function validateAssertion(teamId: string, samlResponse: string): Promise<SamlProfile | null> {
  const instance = await getSamlInstance(teamId);
  if (!instance) return null;

  try {
    const { profile } = await instance.saml.validatePostResponseAsync({ SAMLResponse: samlResponse });
    if (!profile) return null;

    const config = instance.config;
    const email = (profile as Record<string, unknown>)[config.emailAttribute] || profile.nameID;
    const name = (profile as Record<string, unknown>)[config.nameAttribute] || profile.nameID;
    const role = config.roleAttribute ? (profile as Record<string, unknown>)[config.roleAttribute] : undefined;

    // Validate email is a real string (not undefined/null/empty)
    if (!email || typeof email !== 'string' || !email.includes('@')) return null;
    return { email, name: String(name || ''), role: role ? String(role) : undefined };
  } catch (err) {
    console.error(`[SAML] Assertion validation failed for team ${teamId}:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Build authn request URL for SP-initiated login
export async function buildAuthnRequestUrl(teamId: string): Promise<string | null> {
  const instance = await getSamlInstance(teamId);
  if (!instance) return null;

  try {
    const url = await instance.saml.getAuthorizeUrlAsync(teamId, undefined, {});
    return url;
  } catch {
    return null;
  }
}
