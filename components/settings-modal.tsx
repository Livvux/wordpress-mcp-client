'use client';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import { WordPressConnection } from './wordpress-connection';

interface SettingsModalProps {
  trigger: React.ReactNode;
  onConnectionChange: (connected: boolean, siteUrl?: string) => void;
  siteUrl: string;
}

export function SettingsModal({
  trigger,
  onConnectionChange,
  siteUrl,
}: SettingsModalProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Settings</AlertDialogTitle>
          <AlertDialogDescription>
            Configure your WordPress connection and chat settings
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-6">
          <WordPressConnection
            onConnectionChange={(connected) =>
              onConnectionChange(connected, siteUrl)
            }
          />
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
