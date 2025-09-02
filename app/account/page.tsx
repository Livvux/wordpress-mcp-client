'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSession } from '@/lib/auth-context';

export default function AccountPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [email, setEmail] = useState('');

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confPw, setConfPw] = useState('');
  const [pwMessage, setPwMessage] = useState<string | null>(null);

  const [delPw, setDelPw] = useState('');
  const [delConf, setDelConf] = useState('');
  const [delMessage, setDelMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!session || session.userType === 'guest') {
        router.push('/login');
      } else {
        setEmail(session.email || '');
      }
    }
  }, [loading, session, router]);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage(null);
    if (newPw !== confPw) {
      setPwMessage('New passwords do not match');
      return;
    }
    const res = await fetch('/api/account/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j?.ok) {
      setPwMessage('Password updated successfully');
      setCurPw('');
      setNewPw('');
      setConfPw('');
    } else {
      setPwMessage(j?.error || 'Failed to update password');
    }
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDelMessage(null);
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: delPw, confirm: delConf }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j?.ok) {
      window.location.href = '/';
    } else {
      setDelMessage(j?.error || 'Failed to delete account');
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input value={email} readOnly className="mt-1" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-3">
            <div>
              <Label htmlFor="cur">Current password</Label>
              <Input
                id="cur"
                type="password"
                value={curPw}
                onChange={(e) => setCurPw(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="new">New password</Label>
              <Input
                id="new"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="conf">Confirm new password</Label>
              <Input
                id="conf"
                type="password"
                value={confPw}
                onChange={(e) => setConfPw(e.target.value)}
                required
              />
            </div>
            <Button type="submit">Update password</Button>
            {pwMessage && (
              <Alert className="mt-2">
                <AlertDescription>{pwMessage}</AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={deleteAccount} className="space-y-3">
            <div className="text-sm text-red-600">
              Delete your account and all data. This action cannot be undone.
            </div>
            <div>
              <Label htmlFor="delpw">Password</Label>
              <Input
                id="delpw"
                type="password"
                value={delPw}
                onChange={(e) => setDelPw(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="delconf">Confirm password</Label>
              <Input
                id="delconf"
                type="password"
                value={delConf}
                onChange={(e) => setDelConf(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="destructive">
              Delete account
            </Button>
            {delMessage && (
              <Alert className="mt-2" variant="destructive">
                <AlertDescription>{delMessage}</AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
