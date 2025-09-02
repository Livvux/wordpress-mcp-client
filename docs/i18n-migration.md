# i18n Migration (English default + German)

This document summarizes the internationalization (i18n) work completed and how to extend it.

## Overview

- Default language: English (always used unless the user explicitly selects German in Settings → Language)
- Library: `next-intl` as the application i18n provider (client provider variant)
- Messages: `messages/en.json`, `messages/de.json`
- Provider: `components/next-intl-provider.tsx` wraps the app in `app/layout.tsx`
- Persisted language selection: `localStorage('ui-language')` and `localStorage('spoken-language')`

## Components migrated to next-intl

- Settings Dialog (`components/account-modal.tsx`)
  - Title/description, tabs, Theme/Accent/Language/Spoken language section labels
  - Buttons: Upgrade to Pro, Customer portal
- User menu (`components/sidebar-user-nav.tsx`)
  - Welcome, Login or Register, Billing, Sign out
- Upgrade CTA (`components/upgrade-cta.tsx`)
  - Dialog: title, description, benefits, plan labels, assurance footer
- Onboarding
  - Wizard (`components/onboarding/onboarding-wizard.tsx`): title, skip setup, step indicator, nav buttons
  - AI Provider setup (`components/onboarding/steps/api-setup.tsx`): titles, labels, loading/placeholder strings, actions
  - WordPress setup (`components/onboarding/steps/wordpress-setup.tsx`): titles, labels, status, actions
  - Provider cards (`components/onboarding/provider-cards.tsx`): popular models label, get API key button

## Files added/updated

- Added
  - `messages/en.json`, `messages/de.json`
  - `components/next-intl-provider.tsx`
- Updated
  - `app/layout.tsx`: add `IntlClientProvider`
  - Settings/User menu/Upgrade/Onboarding components listed above

## How language selection works

- Settings → Language updates `localStorage('ui-language')` with `auto | English | Deutsch` (currently these values are used). The next-intl client provider re-evaluates the locale on storage changes.
- Default remains English unless `ui-language` starts with `de`.

## How to add more strings

- Add keys to `messages/en.json` and `messages/de.json` (or other locales later)
- Use `useTranslations()` in components and replace hardcoded strings with `t('key')`

## Roadmap (optional)

- SSR + Locale routing using next-intl locale segments (`/en/`, `/de/`) and `NEXT_LOCALE` cookie
- Expand translations to tooltips, toast messages, error messages (map common error patterns to keys)
- Persist UI language on server (cookie-based) to ensure SSR renders correct locale on first paint

