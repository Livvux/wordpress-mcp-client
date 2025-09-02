'use client';

import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSession } from '@/lib/auth-context';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bell,
  Palette,
  Wand2,
  Plug,
  Calendar,
  Database,
  Shield,
  User as UserIcon,
  X,
} from 'lucide-react';

export function AccountModal({
  trigger,
  open,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { session } = useSession();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const t = useTranslations();
  const [tab, setTab] = useState<
    | 'general'
    | 'notifications'
    | 'personalization'
    | 'connectors'
    | 'schedules'
    | 'data'
    | 'security'
    | 'account'
  >('general');

  // Accent color
  const [accent, setAccent] = useState<string>('default');
  const [uiLang, setUiLang] = useState<string>('auto');
  const [spokenLang, setSpokenLang] = useState<string>('auto');
  useEffect(() => {
    const saved = localStorage.getItem('accent-color') || 'default';
    setAccent(saved);
    applyAccent(saved);
    const ul = localStorage.getItem('ui-language') || 'auto';
    setUiLang(ul);
    const sl = localStorage.getItem('spoken-language') || 'auto';
    setSpokenLang(sl);
  }, []);

  const ACCENTS: Record<string, { light: string; dark: string; fgLight: string; fgDark: string; dot: string }>
    = {
      default: { light: '240 4.8% 95.9%', dark: '240 3.7% 15.9%', fgLight: '240 5.9% 10%', fgDark: '0 0% 98%', dot: 'hsl(0,0%,50%)' },
      blue: { light: '221 83% 96%', dark: '221 45% 20%', fgLight: '221 46% 20%', fgDark: '0 0% 98%', dot: '#3b82f6' },
      green: { light: '142 76% 95%', dark: '142 43% 20%', fgLight: '142 72% 20%', fgDark: '0 0% 98%', dot: '#10b981' },
      yellow: { light: '48 96% 95%', dark: '48 40% 20%', fgLight: '48 96% 20%', fgDark: '0 0% 98%', dot: '#f59e0b' },
      pink: { light: '330 90% 96%', dark: '330 50% 20%', fgLight: '330 70% 20%', fgDark: '0 0% 98%', dot: '#ec4899' },
      orange: { light: '24 95% 95%', dark: '24 55% 20%', fgLight: '24 90% 20%', fgDark: '0 0% 98%', dot: '#f97316' },
      purple: { light: '270 90% 96%', dark: '270 50% 20%', fgLight: '270 70% 20%', fgDark: '0 0% 98%', dot: '#8b5cf6' },
      black: { light: '0 0% 10%', dark: '0 0% 20%', fgLight: '0 0% 98%', fgDark: '0 0% 98%', dot: '#000000' },
    };

  function applyAccent(name: string) {
    const root = document.documentElement;
    const m = ACCENTS[name] ?? ACCENTS.default;
    const isDark = (document.documentElement.classList.contains('dark') || resolvedTheme === 'dark');
    root.style.setProperty('--accent', isDark ? m.dark : m.light);
    root.style.setProperty('--accent-foreground', isDark ? m.fgDark : m.fgLight);
    root.style.setProperty('--sidebar-accent', isDark ? m.dark : m.light);
    root.style.setProperty('--sidebar-accent-foreground', isDark ? m.fgDark : m.fgLight);
  }
  useEffect(() => { applyAccent(accent); }, [resolvedTheme]);

  // Security state
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confPw, setConfPw] = useState('');
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [providers, setProviders] = useState<{ id: string; name: string; enabled: boolean; linked: boolean }[] | null>(null);
  const [provMsg, setProvMsg] = useState<string | null>(null);
  // Organizations state
  const [orgs, setOrgs] = useState<any[] | null>(null);
  const [orgErr, setOrgErr] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [members, setMembers] = useState<any[] | null>(null);
  const [memberErr, setMemberErr] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer'|'editor'|'admin'>('viewer');
  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage(null);
    if (newPw !== confPw) { setPwMessage('New passwords do not match'); return; }
    const res = await fetch('/api/account/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j?.ok) { setPwMessage('Password updated successfully'); setCurPw(''); setNewPw(''); setConfPw(''); } else { setPwMessage(j?.error || 'Failed to update password'); }
  }

  async function loadProviders() {
    try {
      setProvMsg(null);
      const res = await fetch('/api/account/providers', { cache: 'no-store' });
      const j = await res.json();
      if (res.ok) setProviders(j.items || []);
      else setProvMsg(j?.error || 'Failed to load linked accounts');
    } catch {
      setProvMsg('Failed to load linked accounts');
    }
  }

  useEffect(() => {
    if (tab === 'security') loadProviders();
    if (tab === 'account') loadOrgs();
  }, [tab]);

  async function disconnectProvider(id: string) {
    setProvMsg(null);
    const res = await fetch(`/api/account/providers/${id}`, { method: 'DELETE' });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j?.ok) {
      await loadProviders();
    } else {
      setProvMsg(j?.error || 'Failed to unlink account');
    }
  }

  // Orgs helpers
  async function loadOrgs() {
    try {
      setOrgErr(null);
      const res = await fetch('/api/orgs', { cache: 'no-store' });
      const j = await res.json();
      if (res.ok) {
        setOrgs(j.items || []);
        if (j.items?.length) {
          const orgId = selectedOrg && j.items.some((o: any) => o.orgId === selectedOrg) ? selectedOrg : j.items[0].orgId;
          await loadMembers(orgId);
        } else {
          setSelectedOrg(null);
          setMembers([]);
        }
      } else setOrgErr(j?.error || 'Failed to load organizations');
    } catch {
      setOrgErr('Failed to load organizations');
    }
  }

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) return;
    const res = await fetch('/api/orgs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: orgName.trim() }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok) { setOrgName(''); await loadOrgs(); }
    else setOrgErr(j?.error || 'Failed to create organization');
  }

  async function loadMembers(orgId: string) {
    try {
      setMemberErr(null);
      const res = await fetch(`/api/orgs/${orgId}/members`, { cache: 'no-store' });
      const j = await res.json();
      if (res.ok) { setMembers(j.items || []); setSelectedOrg(orgId); }
      else setMemberErr(j?.error || 'Failed to load members');
    } catch {
      setMemberErr('Failed to load members');
    }
  }

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrg) return;
    const res = await fetch(`/api/orgs/${selectedOrg}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: inviteEmail, role: inviteRole }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok) { setInviteEmail(''); await loadMembers(selectedOrg); }
    else setMemberErr(j?.error || 'Failed to invite member');
  }

  async function removeMember(membershipId: string) {
    if (!selectedOrg) return;
    const res = await fetch(`/api/orgs/${selectedOrg}/members/${membershipId}`, { method: 'DELETE' });
    const j = await res.json().catch(() => ({}));
    if (res.ok) await loadMembers(selectedOrg);
    else setMemberErr(j?.error || 'Failed to remove');
  }

  async function setMemberRole(membershipId: string, role: string) {
    if (!selectedOrg) return;
    const res = await fetch(`/api/orgs/${selectedOrg}/members/${membershipId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok) await loadMembers(selectedOrg);
    else setMemberErr(j?.error || 'Failed to update role');
  }

  async function deleteOrg() {
    if (!selectedOrg) return;
    const res = await fetch(`/api/orgs/${selectedOrg}`, { method: 'DELETE' });
    const j = await res.json().catch(() => ({}));
    if (res.ok) { setSelectedOrg(null); await loadOrgs(); setMembers([]); }
    else setOrgErr(j?.error || 'Failed to delete organization');
  }

  async function openPortal() {
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    const j = await res.json().catch(() => ({}));
    if (j?.ok && j?.url) window.location.href = j.url;
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent className="w-full max-w-4xl">
        <div className="relative flex flex-col h-[70vh] max-h-[85vh]">
          <button
            type="button"
            aria-label="Close settings"
            onClick={() => onOpenChange?.(false)}
            className="absolute right-3 top-3 h-7 w-7 p-0 rounded-md bg-transparent hover:bg-accent hover:text-accent-foreground"
          >
            <X className="size-4" />
          </button>
          <AlertDialogHeader className="shrink-0">
            <AlertDialogTitle>{t('settings')}</AlertDialogTitle>
            <AlertDialogDescription>{t('customize')}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex gap-4 flex-1 overflow-hidden">
          <div className="w-56 shrink-0 border rounded-md p-2 space-y-1 bg-muted/30 h-full overflow-y-auto">
            {[
              { id: 'general', label: t('general'), icon: Palette },
              { id: 'notifications', label: t('notifications'), icon: Bell },
              { id: 'personalization', label: t('personalization'), icon: Wand2 },
              { id: 'connectors', label: t('connectors'), icon: Plug },
              { id: 'schedules', label: t('schedules'), icon: Calendar },
              { id: 'data', label: t('data'), icon: Database },
              { id: 'security', label: t('security'), icon: Shield },
              { id: 'account', label: t('account'), icon: UserIcon },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id as any)}
                className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground ${tab === (id as any) ? 'bg-accent text-accent-foreground' : ''}`}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 border rounded-md p-3 h-full overflow-y-auto">
            {tab === 'general' && (
              <div className="space-y-2">
                {/* Theme row */}
                <div className="border-b pb-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{t('theme')}</div>
                    <Select value={theme as string} onValueChange={(v) => setTheme(v as any)}>
                      <SelectTrigger className="w-40 h-8 border-0 bg-transparent hover:bg-accent">
                        <SelectValue>
                          <span className="capitalize">{theme}</span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {['system','dark','light'].map((t) => (
                          <SelectItem key={t} value={t}>
                            <span className="capitalize">{t}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Accent color row */}
                <div className="border-b pb-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{t('accent')}</div>
                    <Select
                      value={accent}
                      onValueChange={(c) => {
                        setAccent(c);
                        localStorage.setItem('accent-color', c);
                        applyAccent(c);
                      }}
                    >
                      <SelectTrigger className="w-40 h-8 border-0 bg-transparent hover:bg-accent">
                        <SelectValue>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: ACCENTS[accent]?.dot || '#000' }}
                            />
                            <span className="capitalize">{accent}</span>
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(ACCENTS).map((c) => (
                          <SelectItem key={c} value={c}>
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: ACCENTS[c]?.dot || '#000' }}
                              />
                              <span className="capitalize">{c}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* UI Language selector */}
                <div className="border-b pb-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{t('language')}</div>
                    <Select
                      value={uiLang}
                      onValueChange={(v) => {
                        setUiLang(v);
                        localStorage.setItem('ui-language', v);
                      }}
                    >
                      <SelectTrigger className="w-40 h-8 border-0 bg-transparent hover:bg-accent">
                        <SelectValue>
                          {uiLang === 'auto' ? t('auto') : uiLang}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          { id: 'auto', label: 'Auto-detect' },
                          { id: 'English', label: 'English' },
                          { id: 'Deutsch', label: 'Deutsch' },
                          { id: 'Français', label: 'Français' },
                          { id: 'Español', label: 'Español' },
                          { id: 'Italiano', label: 'Italiano' },
                          { id: 'Português', label: 'Português' },
                          { id: 'Nederlands', label: 'Nederlands' },
                        ].map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Spoken language selector */}
                <div className="border-b pb-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{t('spoken')}</div>
                    <Select
                      value={spokenLang}
                      onValueChange={(v) => {
                        setSpokenLang(v);
                        localStorage.setItem('spoken-language', v);
                      }}
                    >
                      <SelectTrigger className="w-40 h-8 border-0 bg-transparent hover:bg-accent">
                        <SelectValue>
                          {spokenLang === 'auto' ? t('auto') : spokenLang}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          { id: 'auto', label: 'Auto-detect' },
                          { id: 'English', label: 'English' },
                          { id: 'Deutsch', label: 'Deutsch' },
                          { id: 'Français', label: 'Français' },
                          { id: 'Español', label: 'Español' },
                          { id: 'Italiano', label: 'Italiano' },
                          { id: 'Português', label: 'Português' },
                          { id: 'Nederlands', label: 'Nederlands' },
                        ].map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <Button onClick={() => (window.location.href = '/upgrade')} className="h-8">{t('upgrade')}</Button>
                  <Button variant="secondary" onClick={openPortal} className="h-8">{t('portal')}</Button>
                </div>
              </div>
            )}

            {tab === 'security' && (
              <div className="space-y-4">
                <form onSubmit={changePassword} className="space-y-3">
                  <div>
                    <Label htmlFor="cur">Current password</Label>
                    <Input id="cur" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} required />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="new">New password</Label>
                      <Input id="new" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
                    </div>
                    <div>
                      <Label htmlFor="conf">Confirm</Label>
                      <Input id="conf" type="password" value={confPw} onChange={(e) => setConfPw(e.target.value)} required />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Button type="submit" className="h-8">Update password</Button>
                    {pwMessage && (
                      <Alert className="mt-1"><AlertDescription className="text-xs">{pwMessage}</AlertDescription></Alert>
                    )}
                  </div>
                </form>

                <div className="border-t pt-3">
                  <div className="text-sm font-medium mb-2">Connected accounts</div>
                  {provMsg && (
                    <Alert className="mb-2"><AlertDescription className="text-xs">{provMsg}</AlertDescription></Alert>
                  )}
                  <div className="space-y-2">
                    {(providers || []).map((p) => (
                      <div key={p.id} className="flex items-center justify-between border rounded-md p-2">
                        <div className="text-sm">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.enabled ? (p.linked ? 'Linked' : 'Not linked') : 'Disabled'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {p.enabled && !p.linked && p.id !== 'password' && (
                            <a href={`/api/auth/signin/${p.id}?redirectTo=${encodeURIComponent('/account')}`} className="text-xs border rounded-md px-2 py-1 hover:bg-accent">Connect</a>
                          )}
                          {p.enabled && p.linked && p.id !== 'password' && (
                            <button type="button" onClick={() => disconnectProvider(p.id)} className="text-xs border rounded-md px-2 py-1 hover:bg-accent">Disconnect</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'account' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-muted overflow-hidden">
                    {/* Avatar preview */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={typeof window !== 'undefined' ? (localStorage.getItem('avatar-data-url') || '') : ''}
                      alt="avatar"
                      className="h-full w-full object-cover"
                      onError={(e) => ((e.currentTarget.style.display = 'none'))}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{t('profile_picture')}</div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          try {
                            const dataUrl = String(reader.result);
                            localStorage.setItem('avatar-data-url', dataUrl);
                            window.dispatchEvent(new CustomEvent('avatar-updated', { detail: dataUrl }));
                          } catch {}
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="text-xs"
                    />
                    <div className="text-xs text-muted-foreground">Stored locally for now. We can persist to your account later.</div>
                  </div>
                </div>

                <div>
                  <Label>{t('email')}</Label>
                  <Input value={session?.email || ''} readOnly className="mt-1" />
                </div>

                <div className="mt-4 border-t pt-3">
                  <div className="text-sm font-medium mb-2">Organizations</div>
                  {orgErr && (<Alert className="mb-2"><AlertDescription className="text-xs">{orgErr}</AlertDescription></Alert>)}
                  <form onSubmit={createOrg} className="flex gap-2 mb-3">
                    <Input placeholder="New organization name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                    <Button type="submit" className="h-8">Create</Button>
                  </form>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="border rounded-md p-2">
                      <div className="text-xs text-muted-foreground mb-1">Your organizations</div>
                      <div className="space-y-1">
                        {(orgs || []).map((o) => (
                          <button key={o.orgId} type="button" onClick={() => loadMembers(o.orgId)} className={`w-full text-left text-sm rounded-md px-2 py-1 hover:bg-accent ${selectedOrg===o.orgId?'bg-accent text-accent-foreground':''}`}>
                            <div className="font-medium truncate">{o.name}</div>
                            <div className="text-xs text-muted-foreground">Role: {o.role}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2 border rounded-md p-2">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium">Members</div>
                        {selectedOrg && (
                          <Button variant="destructive" size="sm" onClick={deleteOrg}>Delete org</Button>
                        )}
                      </div>
                      {memberErr && (<Alert className="mb-2"><AlertDescription className="text-xs">{memberErr}</AlertDescription></Alert>)}
                      <div className="space-y-2">
                        {(members || []).map((m) => (
                          <div key={m.membershipId} className="flex items-center justify-between border rounded-md p-2">
                            <div>
                              <div className="text-sm font-medium">{m.email || m.userId}</div>
                              <div className="text-xs text-muted-foreground">Role: {m.role}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <select className="border rounded px-2 py-1 text-xs" value={m.role} onChange={(e) => setMemberRole(m.membershipId, e.target.value)}>
                                {['viewer','editor','admin','owner'].map((r) => (<option key={r} value={r}>{r}</option>))}
                              </select>
                              <button onClick={() => removeMember(m.membershipId)} className="text-xs border rounded px-2 py-1 hover:bg-accent" type="button">Remove</button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {selectedOrg && (
                        <form onSubmit={inviteMember} className="mt-3 flex items-center gap-2">
                          <Input placeholder="Invite by email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                          <select className="border rounded px-2 py-1 text-xs" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)}>
                            <option value="viewer">viewer</option>
                            <option value="editor">editor</option>
                            <option value="admin">admin</option>
                          </select>
                          <Button type="submit" className="h-8">Invite</Button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'personalization' && (<div className="text-sm text-muted-foreground">No options yet.</div>)}
            {tab === 'connectors' && (<div className="text-sm text-muted-foreground">No connectors configured.</div>)}
            {tab === 'schedules' && (<div className="text-sm text-muted-foreground">No schedules defined.</div>)}
            {tab === 'data' && (<div className="text-sm text-muted-foreground">Data controls coming soon.</div>)}
            {tab === 'notifications' && (<div className="text-sm text-muted-foreground">Notifications coming soon.</div>)}
          </div>
        </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
