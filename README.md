# SecureApp

Text-only private group chat built with React Native, Expo, and Supabase realtime.

## What this version includes

- Email/password auth with per-user profiles
- Invite-by-username chat creation
- Realtime chat list and message stream through Supabase
- Swipe-to-reply on messages
- Emoji reactions
- Temporary 60-second disappearing messages
- View-once messages with tap-to-reveal UX
- Text-only design: no images, video, file uploads, or calls
- Strict Supabase Row Level Security policies for chats, memberships, messages, reactions, and view logs

## Stack

- Expo / React Native
- TypeScript
- Supabase Auth + Postgres + Realtime
- Direct client-to-Supabase architecture, no custom server

## Security notes

This project is designed to reduce accidental exposure, not to promise impossible guarantees.

- Authorized members can still screenshot what they see.
- A second phone camera can always capture content.
- Without a custom server, device-attestation and advanced abuse prevention are limited.
- The current implementation uses protected database access and secure client UX. End-to-end encryption can be added as a next phase.

## Setup

1. Install packages:

```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your Supabase project values.

3. In Supabase SQL editor, run [`supabase/schema.sql`](/C:/COMPUTERS/PROJECTS/Apps/Private%20Chat%20-%20AntiAvi/supabase/schema.sql).

4. Start Expo:

```bash
npm start
```

5. Open the project in Expo Go on iOS or Android.

## Recommended next phase

- Add app-level PIN / biometrics lock
- Add client-side encryption for message bodies
- Add membership approval / invite tokens
- Add message deletion jobs for expired rows
- Add per-chat settings for default disappearing timers
