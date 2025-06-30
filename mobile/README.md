# OrganizationShots Mobile App

A React Native app built with Expo for managing organization headshots.

## Features

- 📱 Native iOS app experience
- 🔐 Email authentication with Supabase
- 🏢 Organization-based user management
- 📷 Camera integration for taking photos
- 🖼️ Photo gallery with upload/delete functionality
- 📊 Member management and photo tracking

## Setup

1. Install dependencies:
```bash
cd mobile
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Add your Supabase credentials to `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. Start the development server:
```bash
npm start
```

5. Run on iOS:
```bash
npm run ios
```

## Project Structure

```
mobile/
├── src/
│   ├── components/          # Reusable UI components
│   ├── context/            # React Context providers
│   ├── lib/                # Utility libraries (Supabase, photo storage)
│   ├── screens/            # App screens
│   └── types/              # TypeScript type definitions
├── App.tsx                 # Main app component
├── app.json               # Expo configuration
└── package.json           # Dependencies and scripts
```

## Key Components

- **AuthContext**: Manages user authentication state
- **AuthWrapper**: Handles navigation based on auth state
- **PhotoStorage**: Manages photo upload/download with Supabase
- **Camera Integration**: Uses Expo ImagePicker for camera access

## Permissions

The app requires the following permissions:
- Camera access (for taking photos)
- Photo library access (for selecting existing photos)

These are automatically requested when needed.

## Building for Production

1. Build for iOS:
```bash
expo build:ios
```

2. Submit to App Store:
```bash
expo upload:ios
```

## Environment Variables

- `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## Database Schema

The app uses the same Supabase database as the web version:
- `users`: User profiles with organization membership
- `organizations`: Organization details and join codes
- `photos`: Photo metadata and storage URLs

## Storage

Photos are stored in Supabase Storage in the `member-photos` bucket with the following structure:
```
{organization_id}/{user_id}/{timestamp}_{filename}
```