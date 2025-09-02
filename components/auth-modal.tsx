'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { X, Twitter } from 'lucide-react';

import { AuthForm } from '@/components/auth-form';
import { SubmitButton } from '@/components/submit-button';
import { toast } from '@/components/toast';
import { useSession } from '@/lib/auth-context';
import { LogoGoogle } from '@/components/icons';

import {
  login as loginAction,
  register as registerAction,
  type LoginActionState,
  type RegisterActionState,
} from '@/app/(auth)/actions';

type Mode = 'login' | 'register';

export function AuthModal({
  mode,
  trigger,
  allowSwitch = false,
}: {
  mode: Mode;
  trigger: React.ReactNode;
  allowSwitch?: boolean;
}) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [loginState, loginFormAction] = useActionState<
    LoginActionState,
    FormData
  >(loginAction, { status: 'idle' });
  const [registerState, registerFormAction] = useActionState<
    RegisterActionState,
    FormData
  >(registerAction, {
    status: 'idle',
  });

  const [currentMode, setCurrentMode] = useState<Mode>(mode);
  const isLogin = currentMode === 'login';
  const state = isLogin ? loginState.status : registerState.status;

  useEffect(() => {
    if (!open) return;
    if (state === 'failed') {
      toast({
        type: 'error',
        description: isLogin
          ? 'Invalid credentials!'
          : 'Failed to create account!',
      });
    } else if (state === 'user_exists') {
      toast({ type: 'error', description: 'Account already exists!' });
    } else if (state === 'invalid_data') {
      toast({
        type: 'error',
        description: 'Failed validating your submission!',
      });
    } else if (state === 'success') {
      setIsSuccessful(true);
      updateSession();
      router.refresh();
      setTimeout(() => setOpen(false), 150); // close after short delay
    }
  }, [state, open]);

  const handleSubmit = (formData: FormData) => {
    setEmail((formData.get('email') as string) || '');
    if (isLogin) loginFormAction(formData);
    else registerFormAction(formData);
  };

  const title = isLogin ? 'Sign In' : 'Sign Up';
  const description = isLogin
    ? 'Use your email and password to sign in'
    : 'Create an account with your email and password';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-full max-w-md">
        <DialogClose
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <X className="h-5 w-5" />
        </DialogClose>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{title}</span>
            {allowSwitch && (
              <button
                type="button"
                className="text-xs font-normal text-muted-foreground hover:text-foreground"
                onClick={() => setCurrentMode((m) => (m === 'login' ? 'register' : 'login'))}
              >
                {isLogin ? "Need an account? Sign up" : "Have an account? Sign in"}
              </button>
            )}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4 px-4 sm:px-16">
          <div className="flex flex-col gap-2">
            {process.env.NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH !== 'false' && (
              <a
                href="/api/auth/signin/google"
                className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
              >
                <LogoGoogle size={16} />
                <span>Continue with Google</span>
              </a>
            )}
            {process.env.NEXT_PUBLIC_ENABLE_TWITTER_OAUTH !== 'false' && (
              <a
                href="/api/auth/signin/twitter"
                className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
              >
                <Twitter className="h-4 w-4" />
                <span>Continue with X (Twitter)</span>
              </a>
            )}
          </div>
          <AuthForm
            action={handleSubmit}
            defaultEmail={email}
            autoFocusEmail
            className=""
          >
            <SubmitButton isSuccessful={isSuccessful}>
              {isLogin ? 'Sign in' : 'Sign Up'}
            </SubmitButton>
          </AuthForm>
        </div>
      </DialogContent>
    </Dialog>
  );
}
