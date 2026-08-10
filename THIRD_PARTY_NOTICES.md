# Third-party notices

This document identifies third-party components distributed with or used to
build Fenix A320 Remote Cockpit. They are not relicensed under the project's
asset license.

## FlyByWire Simulations

`public/fonts/AirbusFCU.ttf` was sourced from the FlyByWire Simulations
aircraft repository. Its embedded metadata identifies:

> Copyright (c) 2021, Tyler Knox

FlyByWire states that original source-code assets and compiled artifacts in
its aircraft repository are distributed under GNU GPLv3. The complete GPLv3
text applicable to this font is included in
`LICENSES/GPL-3.0-FlyByWire.txt`.

Source: https://github.com/flybywiresim/aircraft

The FlyByWire repository was also used as a geometric and functional
reference for the Airbus-style controls. No FlyByWire FCU source file is
vendored in this repository.

## MobiFlight WASM Module

The files under `mobiflight-event-module/`, including
`MobiFlightWasmModule.wasm`, are from the MobiFlight WASM Module project and
are distributed under the MIT License.

Copyright © 2021 Sebastian Moebius, MobiFlight.

Source: https://github.com/MobiFlight/MobiFlight-WASM-Module

License: `LICENSES/MIT-MobiFlight.txt`

## Fonts

The following fonts are distributed under the SIL Open Font License 1.1:

- `public/fonts/Montserrat.ttf` — The Montserrat Project Authors
- `public/fonts/Poppins-SemiBold.ttf` — The Poppins Project Authors / Indian
  Type Foundry
- `src/assets/overhead/fonts/inter-variable.ttf` — The Inter Project Authors

The complete common license and copyright notices are in
`LICENSES/OFL-1.1.txt`.

## Microsoft Flight Simulator SimConnect

`bridge/A320Boards.Bridge/lib/Microsoft.FlightSimulator.SimConnect.dll` and
`bridge/A320Boards.Bridge/lib/SimConnect.dll` are Microsoft Flight Simulator
SDK components. They are proprietary Microsoft material and are not covered
by GPLv3 or the Fenix A320 Remote Cockpit asset license. Their use and
redistribution are subject to the Microsoft Flight Simulator SDK terms
applicable to the SDK version from which they were obtained.

Distributors must verify that those terms permit shipping the DLLs. When in
doubt, omit the DLLs and require users or builders to obtain them from an
installed Microsoft Flight Simulator SDK.

Documentation:
https://docs.flightsimulator.com/html/Programming_Tools/SimConnect/SimConnect_SDK.htm

## JavaScript dependencies

JavaScript dependencies are declared in `package.json` and locked in
`package-lock.json`. Their current license families include MIT, ISC,
Apache-2.0, BSD-3-Clause, and MPL-2.0. Each package remains under the license
shipped in its npm package. Anyone distributing a compiled bundle must
preserve the notices required by those licenses.

Major direct dependencies:

- React and React DOM — MIT
- Vite and `@vitejs/plugin-react` — MIT
- TypeScript — Apache-2.0
- Lucide React — ISC

## Reference projects

The following projects informed architecture or simulator integration but
are not vendored as source code here:

- MSFS Blind Assist — GPLv3
- A32NX WebRemote — GPLv3
- OpenA3XX Flightdeck — GPLv3

Their technical interfaces, public documentation, and behavior were used as
references. No source code from these projects is vendored in the Fenix A320
Remote Cockpit source. Project code is distributed under the PolyForm
Noncommercial License 1.0.0 as described in `LICENSES.md`.

## Trademarks and simulator content

Airbus, Fenix Simulations, FlyByWire Simulations, MobiFlight, Microsoft, and
Microsoft Flight Simulator names and marks belong to their respective
owners. Fenix A320 Remote Cockpit is an independent home-cockpit project and
is not endorsed by or affiliated with those parties.
