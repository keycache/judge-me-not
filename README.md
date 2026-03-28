# Judge Me Now

Judge Me Now is an Expo/React Native interview practice app. It generates mock interview sessions from text descriptions or image inputs, lets users practice answers question by question, and stores sessions, attempts, and settings locally on device.

## Overview

The app is organized around four main flows:

- Prepare: create question sets from role descriptions or uploaded images using Google GenAI.
- Practice: select a session, work through generated questions, and track past answers.
- Insights: review feedback and trends from completed practice attempts.
- Profile: manage API setup and prompt/settings that influence generation and evaluation.

## Stack

- Expo Router with tab-based navigation
- React Native and TypeScript
- AsyncStorage-backed repositories for sessions and settings
- Google GenAI integration for question generation and answer evaluation
- Jest and React Native Testing Library for regression coverage

## Project Structure

- `app/`: route-based screens for setup, Prepare, Practice, Insights, and Profile
- `lib/`: domain models, repositories, prompt composition, GenAI integration, and practice logic
- `components/` and `constants/`: shared UI primitives, icons, and theme tokens
- `design/`: reference screens and design artifacts
- `__tests__`: focused tests across hooks, repositories, domain logic, and tab flows


## Commands
* local apk `eas build --local --platform android --profile preview`
* run android
```
Do this exact recovery sequence in a terminal:

Reset ADB and start your emulator explicitly
adb kill-server
adb start-server
emulator -avd Medium_Phone_API_36.1

Wait until Android is fully booted, then verify connection
adb devices -l

You should see a line like:
emulator-5554 device ...

Start Expo clean and launch app to emulator
cd .../judge-me-not
npx expo start --clear
Then press a in the Expo terminal (instead of r first).
```
