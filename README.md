# Geotagged Photo Compass Sort

A Windows desktop app that sorts geotagged photographs into **North, North-East,
East, South-East, South, South-West, West and North-West** folders, based on
the bearing from a fixed asset centre point to each photo's camera position.

Typical use cases: turbines, pylons, towers, buildings, chimneys, monuments,
masts and other circular assets, where you need to know which side of the
asset an inspection photo was taken from.

> **Note:** this sorts by *where the camera was standing* relative to the
> asset, not which way the camera was *pointing*. Camera-facing direction
> would require reliable heading (compass) metadata in the photo, which most
> cameras/phones don't record reliably, and is out of scope for this tool.

## How it works

Built for fieldwork: no dialogs to fill in, no "Sort" button to remember to
click.

1. Enter the asset's centre point (latitude/longitude in decimal degrees) —
   or click **Paste "lat, long"** to grab both values in one go from
   whatever you copied off a map or GPS device.
2. Drag photos — or a whole folder of photos — onto the drop zone. (Or click
   it to browse instead, if that's easier with your hands full.)
3. Sorting starts immediately. Each photo's camera GPS position is read from
   its EXIF metadata, and the great-circle bearing from the asset centre to
   that position is calculated.
4. The bearing is classified into one of 8 compass sectors (each a 45°
   wedge centred on its direction — e.g. North covers 337.5°–22.5°) and the
   photo is **copied** (originals are left untouched) into a matching
   subfolder: `North`, `North-East`, `East`, `South-East`, `South`,
   `South-West`, `West`, `North-West`. The compass card grid fills in live
   with a running count per direction.
5. Photos with no GPS EXIF data (or a corrupt/unsupported file) are listed
   under "skipped" rather than sorted, so nothing is silently misplaced.
6. Keep dragging in more photos any time — counts keep accumulating for the
   same asset. Moving on to a different turbine/pylon/etc.? Click **Start
   new asset** to reset the counts and pick a fresh centre point.

The output folder is chosen automatically the first time you drop something
(a `Sorted` subfolder next to a dropped folder, or a `GeoCompassSort Sorted`
folder in your Pictures library for loose files) — use **Change output
folder** if you want it somewhere else.

## Project structure

```
GeoCompassSort.sln
src/
  GeoCompassSort.Core/   Platform-agnostic logic: EXIF GPS reading, bearing
                         calculation, sector classification, file sorting.
  GeoCompassSort.App/    WinUI 3 desktop app (the UI), packaged for MSIX /
                         the Microsoft Store.
tests/
  GeoCompassSort.Core.Tests/   xUnit tests for the Core logic.
```

The Core logic has no Windows-only dependencies, so it builds and tests on
any platform. The App project is WinUI 3 and only builds on Windows.

## Prerequisites (for building the app)

- Windows 10 (build 17763+) or Windows 11
- [Visual Studio 2022](https://visualstudio.microsoft.com/) (17.9 or later) with:
  - the **.NET Desktop Development** workload
  - the **Windows application development** workload (installs the Windows
    App SDK / WinUI templates)
- .NET 8 SDK (installed automatically by the above workloads)

## Build & run

1. Open `GeoCompassSort.sln` in Visual Studio on Windows.
2. Set **GeoCompassSort.App** as the startup project.
3. Press F5 (or Ctrl+F5) to build and run.

From the command line on Windows:

```powershell
dotnet build src\GeoCompassSort.App\GeoCompassSort.App.csproj -c Debug
```

## Running the tests

The Core test suite runs anywhere the .NET 8 SDK is installed (Windows,
macOS or Linux):

```bash
dotnet test tests/GeoCompassSort.Core.Tests/GeoCompassSort.Core.Tests.csproj
```

## Packaging for the Microsoft Store

The app project is already configured for single-project MSIX packaging
(`WindowsPackageType=MSIX` in `GeoCompassSort.App.csproj`), so no separate
packaging project is needed.

1. **Reserve an app name** in [Partner Center](https://partner.microsoft.com/dashboard)
   under Apps and games.
2. In Visual Studio: right-click **GeoCompassSort.App** → **Publish** →
   **Associate App with the Store...**, sign in, and select the reserved
   app name. This updates the `Identity` and `Publisher` values in
   `Package.appxmanifest` to match your Partner Center identity (the
   placeholder values currently in the manifest — `EcowattEnvironmental.GeoCompassSort`
   / `CN=EcowattEnvironmental` — must be replaced this way, not edited by hand).
3. **Replace the placeholder icons** in `src/GeoCompassSort.App/Assets/` —
   they are currently solid-colour placeholder PNGs at the required sizes
   (`Square44x44Logo.png`, `Square150x150Logo.png`, `StoreLogo.png`,
   `Wide310x150Logo.png`, `SplashScreen.png`, `LockScreenLogo.png`) so the
   project builds out of the box. Swap in real branded artwork before
   submitting.
4. Right-click **GeoCompassSort.App** → **Publish** → **Create App
   Packages...** → **Microsoft Store using a new app name / existing
   association** → follow the wizard to produce a signed `.msixupload`.
5. Upload the `.msixupload` to your Partner Center submission.

## Known limitations

- Requires the photo to have a valid GPS EXIF tag (most phone cameras and
  GPS-enabled cameras record this automatically; some drones/cameras need
  GPS logging enabled explicitly).
- Sector boundaries use true bearing (as recorded by GPS), not magnetic
  bearing — this matches how EXIF GPS coordinates work and needs no
  correction.
- Camera-facing/heading direction is not sorted on — see the note above.
