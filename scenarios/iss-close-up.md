# ISS close-up — travel alongside the station

Read the current simulation state and active view. Preserve the date, timeline range, other views and layout. If the date precedes 20 November 1998, select an available date within the current range, preferably the bundled ISS data epoch; explain the date change.

Use the satellites tool with settings {"closeUp":"iss"} for the active view. This prepares a true-size station, Earth at true scale, and an orbit camera about 300 metres away pointed at the ISS, with follow enabled. The camera origin moves with the ISS each frame. Simulation speed must be real time (1/86400 simulated days per real second). Keep setup paused and tell the user to press Play.

Read back the full simulation state. Verify satelliteFocus is iss, focus is earth, follow is true, magnification for iss is 1, camera target is [0,0,0], speed is real time and playback is paused. Verify all other views are preserved. NASA detail geometry loads automatically at close range. Outside the bundled snapshot's ±3-day interval, describe the orbit as illustrative rather than historical tracking. Attitude and station assembly history are illustrative at every date.
