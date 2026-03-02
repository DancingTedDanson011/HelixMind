'use client';

import { useCallback, useEffect, useState } from 'react';

interface SamlConfig {
  id: string;
  entityId: string;
  ssoUrl: string;
  certificate: string;
  signatureAlgorithm: string;
  emailAttribute: string;
  nameAttribute: string;
  roleAttribute: string | null;
  allowIdpInitiated: boolean;
  enforceForTeam: boolean;
}

interface SamlSettingsProps {
  teamId: string;
  isOwner: boolean;
}

export function SamlSettings({ teamId, isOwner }: SamlSettingsProps) {
  const [config, setConfig] = useState<SamlConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; authUrl?: string; error?: string } | null>(null);

  // Form state
  const [entityId, setEntityId] = useState('');
  const [ssoUrl, setSsoUrl] = useState('');
  const [certificate, setCertificate] = useState('');
  const [signatureAlgorithm, setSignatureAlgorithm] = useState('sha256');
  const [emailAttribute, setEmailAttribute] = useState('email');
  const [nameAttribute, setNameAttribute] = useState('displayName');
  const [roleAttribute, setRoleAttribute] = useState('');
  const [enforceForTeam, setEnforceForTeam] = useState(false);
  const [allowIdpInitiated, setAllowIdpInitiated] = useState(false);

  const metadataUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/auth/saml/metadata`
    : '/api/auth/saml/metadata';

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/saml`);
      if (!res.ok) {
        if (res.status === 403) setError('Enterprise plan required for SAML SSO');
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.config) {
        setConfig(data.config);
        setEntityId(data.config.entityId);
        setSsoUrl(data.config.ssoUrl);
        setCertificate(data.config.certificate);
        setSignatureAlgorithm(data.config.signatureAlgorithm);
        setEmailAttribute(data.config.emailAttribute);
        setNameAttribute(data.config.nameAttribute);
        setRoleAttribute(data.config.roleAttribute || '');
        setEnforceForTeam(data.config.enforceForTeam);
        setAllowIdpInitiated(data.config.allowIdpInitiated);
      }
    } catch {
      setError('Failed to load SAML configuration');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const res = await fetch(`/api/teams/${teamId}/saml`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          ssoUrl,
          certificate,
          signatureAlgorithm,
          emailAttribute,
          nameAttribute,
          roleAttribute: roleAttribute || null,
          enforceForTeam,
          allowIdpInitiated,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save');
        return;
      }

      const data = await res.json();
      setConfig(data.config);
      setSuccess('SAML configuration saved');
    } catch {
      setError('Failed to save SAML configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTestResult(null);
    setTesting(true);

    try {
      const res = await fetch(`/api/teams/${teamId}/saml/test`, { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/saml`, { method: 'DELETE' });
      if (res.ok) {
        setConfig(null);
        setEntityId('');
        setSsoUrl('');
        setCertificate('');
        setSignatureAlgorithm('sha256');
        setEmailAttribute('email');
        setNameAttribute('displayName');
        setRoleAttribute('');
        setEnforceForTeam(false);
        setAllowIdpInitiated(false);
        setConfirmDelete(false);
        setSuccess('SAML configuration deleted');
      }
    } catch {
      setError('Failed to delete SAML configuration');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#00d4ff] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-sm font-medium text-white">SAML 2.0 Single Sign-On</h3>
        <p className="text-xs text-gray-500">
          Configure SAML SSO to let team members sign in via your identity provider.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm text-green-400">
          {success}
        </div>
      )}

      {/* SP Metadata URL */}
      <div className="rounded-lg border border-white/10 bg-[#0a0a1a] p-4">
        <label className="mb-2 block text-xs font-medium text-gray-400">
          SP Metadata URL (provide this to your IdP)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={metadataUrl}
            className="flex-1 rounded-lg border border-white/10 bg-[#12122a] px-3 py-2 text-xs text-gray-300 outline-none"
          />
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(metadataUrl)}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 hover:border-[#00d4ff]/30 hover:text-white transition-colors"
          >
            Copy
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* IdP Entity ID */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">
            IdP Entity ID
          </label>
          <input
            type="text"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="https://idp.example.com/saml/metadata"
            required
            className="w-full rounded-lg border border-white/10 bg-[#12122a] px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-[#00d4ff]/50"
          />
        </div>

        {/* SSO URL */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">
            SSO URL (IdP Login Endpoint)
          </label>
          <input
            type="url"
            value={ssoUrl}
            onChange={(e) => setSsoUrl(e.target.value)}
            placeholder="https://idp.example.com/saml/sso"
            required
            className="w-full rounded-lg border border-white/10 bg-[#12122a] px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-[#00d4ff]/50"
          />
        </div>

        {/* Certificate */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">
            X.509 Certificate (PEM format)
          </label>
          <textarea
            value={certificate}
            onChange={(e) => setCertificate(e.target.value)}
            placeholder={"-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----"}
            required
            rows={6}
            className="w-full rounded-lg border border-white/10 bg-[#12122a] px-3 py-2 font-mono text-xs text-white placeholder-gray-600 outline-none focus:border-[#00d4ff]/50"
          />
        </div>

        {/* Signature Algorithm */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">
            Signature Algorithm
          </label>
          <select
            value={signatureAlgorithm}
            onChange={(e) => setSignatureAlgorithm(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#12122a] px-3 py-2 text-sm text-white outline-none focus:border-[#00d4ff]/50"
          >
            <option value="sha256">SHA-256</option>
            <option value="sha512">SHA-512</option>
          </select>
        </div>

        {/* Attribute Mapping */}
        <div className="rounded-lg border border-white/5 bg-[#0a0a1a] p-4 space-y-4">
          <h4 className="text-xs font-medium text-gray-400">Attribute Mapping</h4>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-gray-500">
                Email Attribute
              </label>
              <input
                type="text"
                value={emailAttribute}
                onChange={(e) => setEmailAttribute(e.target.value)}
                placeholder="email"
                className="w-full rounded-lg border border-white/10 bg-[#12122a] px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-[#00d4ff]/50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-gray-500">
                Name Attribute
              </label>
              <input
                type="text"
                value={nameAttribute}
                onChange={(e) => setNameAttribute(e.target.value)}
                placeholder="displayName"
                className="w-full rounded-lg border border-white/10 bg-[#12122a] px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-[#00d4ff]/50"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-gray-500">
              Role Attribute (optional)
            </label>
            <input
              type="text"
              value={roleAttribute}
              onChange={(e) => setRoleAttribute(e.target.value)}
              placeholder="role"
              className="w-full rounded-lg border border-white/10 bg-[#12122a] px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-[#00d4ff]/50"
            />
            <p className="mt-1 text-xs text-gray-600">
              Maps IdP roles to team roles. Values: admin, member, viewer.
            </p>
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enforceForTeam}
              onChange={(e) => setEnforceForTeam(e.target.checked)}
              className="h-4 w-4 rounded border-white/10 bg-[#12122a] text-[#00d4ff] accent-[#00d4ff]"
            />
            <div>
              <span className="text-sm text-white">Enforce SSO for all team members</span>
              <p className="text-xs text-gray-500">
                Members must sign in via SAML. Password login will be disabled for this team.
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allowIdpInitiated}
              onChange={(e) => setAllowIdpInitiated(e.target.checked)}
              className="h-4 w-4 rounded border-white/10 bg-[#12122a] text-[#00d4ff] accent-[#00d4ff]"
            />
            <div>
              <span className="text-sm text-white">Allow IdP-initiated login</span>
              <p className="text-xs text-gray-500">
                Allow users to start login from the identity provider portal.
              </p>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#00d4ff] px-5 py-2 text-sm font-medium text-black hover:bg-[#00d4ff]/80 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : config ? 'Update Configuration' : 'Save Configuration'}
          </button>

          {config && (
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="rounded-lg border border-[#00d4ff]/30 px-5 py-2 text-sm text-[#00d4ff] hover:bg-[#00d4ff]/10 transition-colors disabled:opacity-50"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          )}
        </div>
      </form>

      {/* Test result */}
      {testResult && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            testResult.success
              ? 'border-green-500/20 bg-green-500/5 text-green-400'
              : 'border-red-500/20 bg-red-500/5 text-red-400'
          }`}
        >
          {testResult.success
            ? 'Connection test successful. Auth URL generated.'
            : `Test failed: ${testResult.error}`}
        </div>
      )}

      {/* Delete zone */}
      {config && isOwner && (
        <div className="rounded-lg border border-red-500/20 p-4">
          <h3 className="mb-2 text-sm font-medium text-red-400">Remove SAML Configuration</h3>
          <p className="mb-3 text-xs text-gray-500">
            This will disable SSO for your team. Members will need to use email/password login.
          </p>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Delete SAML Config
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
