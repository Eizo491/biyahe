# Build the Biyahe Android app (GPS keeps working with the screen off)
1. Create a free GitHub account and a NEW repository. Upload the CONTENTS of this folder (index.html, js, css, package.json, .github ... ) so `.github` is at the top level.
2. In the repo: Actions > "Build Android APK" > Run workflow. Wait ~5-8 minutes.
3. Open the finished run > Artifacts > download "Biyahe-APK", unzip it, send app-debug.apk to your Android phone and install it (allow "install unknown apps").
4. Open Biyahe, sign in as a rider. When asked for location choose "Allow all the time", and allow notifications.
5. Phone Settings > Apps > Biyahe > Battery > set to "Unrestricted" (otherwise Android may kill it).
6. Take a job, start moving, turn the screen off. A "Biyahe is sharing your live location" notification stays on while it tracks.
