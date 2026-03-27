# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.


## Commands
* local apk `eas build --local --platform android --profile preview`
* run android
```
Do this exact recovery sequence in a terminal:

Reset ADB and start your emulator explicitly
adb kill-server
adb start-server
/Users/akashpatki/Library/Android/sdk/emulator/emulator -avd Medium_Phone_API_36.1

Wait until Android is fully booted, then verify connection
adb devices -l

You should see a line like:
emulator-5554 device ...

Start Expo clean and launch app to emulator
cd /Users/akashpatki/Documents/kash/code/moon/react-native/judge-me-not
npx expo start --clear
Then press a in the Expo terminal (instead of r first).
```

### TODO
* Image choose, change the file name displayed to image preview
* change image preview in the modal after session is selected. The image in carousal should be maintained in aspect ratio and padded to diplay as a square
* disable duplicate images being uploaded