# Mobile Build Guide

This project uses [Capacitor](https://capacitorjs.com/) with the official [`@capacitor/share`](https://capacitorjs.com/docs/apis/share) plugin to expose the native share sheet on Android and iOS. Follow the instructions below to ensure the plugin is installed correctly and that both native builds compile and satisfy store review requirements.

## 1. Install dependencies

```bash
npm install
```

This installs Capacitor core packages together with the Share plugin that is already listed in `package.json`.

## 2. Configure Capacitor platforms

If the native projects have not been generated yet, add them once per platform:

```bash
npx cap add android
npx cap add ios
```

Whenever dependencies change (for example after updating the Share plugin), synchronise the native projects:

```bash
npx cap sync
```

The sync command copies the web assets and ensures the Share plugin is registered with each native host.

## 3. Android specific setup

1. Open the Android project:
   ```bash
   npx cap open android
   ```
2. In **`android/app/src/main/AndroidManifest.xml`**, confirm that your `MainActivity` uses the default Capacitor template. No additional permissions are required for text/URL sharing, but if you share files from internal storage you must declare the relevant media access permissions such as:
   ```xml
   <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
   <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
   ```
   Declare only the permissions that match the type of files you expose and be prepared to justify them during Play Store review.
3. When sharing files from private app storage, expose them through a `FileProvider` that matches the configuration in `android/app/src/main/res/xml/file_paths.xml`. Capacitor adds this provider by default; ensure the authority matches `${applicationId}.fileprovider`.
4. Build the application in Android Studio (`Build > Make Project`) and run on a device or emulator to verify the share sheet opens. Use the **App content** section in Play Console to document any storage access permissions you declared.

## 4. iOS specific setup

1. Open the Xcode workspace:
   ```bash
   npx cap open ios
   ```
2. In Xcode, select the **Info** tab for the app target and add usage descriptions if you intend to share photos or other local files. Apple requires a justification string for each capability you request. For file-based sharing add (adjusting the wording to suit your product):
   - `NSPhotoLibraryAddUsageDescription`: "We use the share sheet to allow you to export images to your photo library."
   - `NSPhotoLibraryUsageDescription`: "We need access to your photos when you choose to share saved images."
3. Ensure that your bundle identifier is registered in the Apple Developer portal and that push capabilities remain disabled unless explicitly required. The Share plugin does not require additional entitlements.
4. Run the app on a simulator or device (`Cmd + R`) to confirm that the native share controller appears. Before submitting to the App Store, run **Product > Archive** and validate the build in the Organizer.

## 5. Web fallback behaviour

When the app runs in a browser, the module in `app.js` automatically falls back to the Web Share API (if available) or copies the share content to the clipboard. No extra setup is required for the web build, but ensure pages are served over HTTPS to allow clipboard access.

## 6. Troubleshooting

- After updating Capacitor or the Share plugin, always rerun `npx cap sync` followed by the relevant IDE build to regenerate native bindings.
- If Android Studio reports missing plugins, check `android/app/src/main/assets/capacitor.plugins.json` and confirm it contains an entry for `@capacitor/share`. Delete the `android` folder and rerun `npx cap add android` if necessary.
- For iOS build errors referencing `SharePlugin`, clean the build folder (`Shift + Cmd + K`) and reinstall pods with `npx cap sync ios && cd ios && pod install`.

Following the steps above ensures the Share plugin is configured correctly and provides the usage disclosures reviewers expect on both major app stores.
