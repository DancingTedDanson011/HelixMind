'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/providers/ToastProvider';
import {
  User,
  Mail,
  Globe,
  Save,
  Info,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────── */

interface ProfileEditorProps {
  user?: {
    name?: string | null;
    email?: string | null;
    locale?: string;
    role?: string;
    createdAt?: string;
  };
}

/* ─── Animation Variants ──────────────────────── */

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

/* ─── Component ───────────────────────────────── */

export function ProfileEditor({ user }: ProfileEditorProps) {
  const { toast } = useToast();
  const [name, setName] = useState(user?.name || '');
  const [locale, setLocale] = useState(user?.locale || 'en');
  const [saving, setSaving] = useState(false);

  const email = user?.email || '';
  const role = user?.role || 'USER';
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : 'Unknown';

  const initials = (name || email || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleSave = async () => {
    setSaving(true);
    // Mock save — replace with actual API call
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    toast({ type: 'success', message: 'Profile updated successfully.' });
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ── Header ── */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-white">Profile Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your account information and preferences.
        </p>
      </motion.div>

      {/* ── Avatar + Basic Info ── */}
      <motion.div variants={item}>
        <GlassPanel>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-2xl font-bold text-primary shrink-0">
              {initials}
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-white">{name || 'Your Name'}</h2>
              <p className="text-sm text-gray-500">{email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge>{role}</Badge>
                <span className="text-xs text-gray-600">Member since {memberSince}</span>
              </div>
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* ── Edit Form ── */}
      <motion.div variants={item}>
        <GlassPanel>
          <h2 className="text-base font-semibold text-white mb-6 flex items-center gap-2">
            <User size={16} className="text-primary" />
            Personal Information
          </h2>

          <div className="space-y-5">
            {/* Name */}
            <Input
              id="profile-name"
              label="Display Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
            />

            {/* Email (read-only) */}
            <div className="space-y-1.5">
              <label htmlFor="profile-email" className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <Mail size={14} />
                Email Address
              </label>
              <div className="relative">
                <input
                  id="profile-email"
                  type="email"
                  value={email}
                  readOnly
                  className="w-full rounded-lg border border-white/10 bg-surface/50 px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-gray-600 flex items-center gap-1.5">
                <Info size={12} />
                To change your email, contact support.
              </p>
            </div>

            {/* Locale */}
            <div className="space-y-1.5">
              <label htmlFor="profile-locale" className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <Globe size={14} />
                Language Preference
              </label>
              <select
                id="profile-locale"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-white hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all duration-200 appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                }}
              >
                <option value="en">English</option>
                <option value="de">Deutsch</option>
              </select>
            </div>
          </div>

          {/* Save */}
          <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
            <Button onClick={handleSave} loading={saving}>
              <Save size={16} />
              Save Changes
            </Button>
          </div>
        </GlassPanel>
      </motion.div>
    </motion.div>
  );
}
