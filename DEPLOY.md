# Deployment & Code Signing

This project uses [electron-builder](https://www.electron.build/) to produce signed desktop distributables for Windows and macOS. Generating trusted artifacts requires preparing signing material and exposing it to the packaging process via environment variables.

## Windows (MSIX & NSIS)

1. **Acquire a code signing certificate** capable of producing MSIX packages. Either purchase an EV certificate or create a trusted certificate from your enterprise PKI.
2. Export the certificate as a password-protected `.pfx` file and place it at `certs/windows/YourCompany_ChatGPT.pfx` (or update `build.win.certificateFile`).
3. Set the password as the `WIN_CERT_PASSWORD` environment variable before running any packaging script.
4. Update the following placeholders in `package.json`:
   - `build.win.publisherName`
   - `build.win.msix.identityName`
   - `build.win.msix.publisher`
   - `build.win.msix.publisherDisplayName`
5. If you use a different certificate location, configure `build.win.certificateFile` accordingly.

Run `npm run package:win` to build both NSIS and MSIX installers once the certificate and password are available.

## macOS (DMG & MAS)

1. Enroll in the Apple Developer Program and create both **Developer ID** and **Mac App Store** certificates.
2. Export the certificates to your login keychain on the build machine or use an Apple-issued signing identity inside a CI runner (e.g. via `apple-codesign`).
3. Provide a Mac App Store provisioning profile at `config/provisioning/mas.provisionprofile` matching the bundle identifier declared in `build.appId` and `build.mac.mas`.
4. Review and extend the entitlement files in `config/` to cover every capability the app needs.
5. Configure the following environment variables before packaging:
   - `APPLE_ID`
   - `APPLE_ID_PASSWORD` (or app-specific password)
   - `CSC_LINK` / `CSC_KEY_PASSWORD` if you sign using exported `.p12` files.

Run `npm run package:mac` to produce both the notarized DMG and the MAS submission package.

## Cross-platform packaging

Execute `npm run package` to build Windows, macOS, and Linux artifacts in one step. Ensure all platform-specific credentials are present in the environment; otherwise, run the individual scripts for the platforms you intend to ship.

For more background on configuration options, see the [`electron-builder` documentation](https://www.electron.build/configuration/configuration).
