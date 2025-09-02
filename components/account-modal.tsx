'use client';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function AccountModal({ trigger }: { trigger: React.ReactNode }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="w-full max-w-3xl h-[85vh]">
        <AlertDialogHeader>
          <AlertDialogTitle>Account</AlertDialogTitle>
          <AlertDialogDescription>
            Manage your account and security settings
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="w-full h-[calc(85vh-100px)]">
          <iframe
            src="/account"
            className="w-full h-full rounded-md border"
            title="Account Management"
          />
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
