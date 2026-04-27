#!/bin/bash
# Run this once after cloning or creating your GitHub repo

echo "⚡ Setting up Forge repo..."

git init
git add .
git commit -m "feat: initial Forge fitness app scaffold

- React Native (Expo) iOS app
- Supabase auth + database with full schema and RLS
- Apple HealthKit integration (steps, HR, sleep, calories, workouts)
- Apple Watch connectivity service
- Claude AI coach with persistent memory system
- Calorie + macro tracking with AI food parsing
- iOS 26 Liquid Glass inspired design system
- 4-step onboarding flow
- Zustand global state management
- TypeScript throughout"

echo ""
echo "Now run:"
echo "  git remote add origin https://github.com/YOUR_ORG/forge-app.git"
echo "  git push -u origin main"
