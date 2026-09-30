# Simulation of the solar system

The solar system project is a simulation of the solar system, of the planets going around the sun and the moons going around the planets. But is much more ambitious then just that. There are two aspects to this simulation: what do we want to simulate and how do we want to visualize and interact with that reality. I have seperated this in two sections: 'Space' and 'View'. I have also added a third section, 'Tech', to write down some preliminary thoughts about the technology behind this simulation.

## Space

In no particular order we have to be able to simulate and display

1. The planets around the sun and the moons around the planets. We need accurate and available ephemeris data and then use the kepler equation to calculate the positions. We also need texture maps for the sun, planets and moons if available so that we can show a realistic view of the planets.
2. The astroid belt between mars and jupiter.
3. Satellites around the earth and further in space. We will have to find 3D representations of these or make some ourselves.
4. The launch and voyage of a rocket in space, its arrival on a planet etc.
5. Artefacts like the orbit of the planets or the trajectory of a rocket or the Lagrange points.


## View

1. We will use cameras to view the scene. Cameras that can move, cameras attached to planets or space ships, fixed cameras etc. Some cameras will be able to pan, zoom and rotate. Camera flexibility will be very important.
2. It must be possible to adjust size parameters for the solar system in such a way that planets can be better visible on certain views. Also simulation speed, start and end time must be adaptable. There will also be a time-scrubber to move back and forth in time.
3. We will have to show certain artifacts like trajectories, either as they are being followed or as completed
4. We will have to be able to show charts, like distance between planets, rocket fuel consumption etc.
5. The possibly many settings for cameras, magnifications, time (start, end speed) will be accessible via a coherent ui. 
6. Because we expect many possible settings, for example for cameras, there will be an LLM interface to the simulation so that a user can change settings or run scenarios via natural language commands.
7. We must be able to show the movement of objects over a given period from a fixed point in time: for example the movement of the sun as seen from a point on earth at 12.00 hrs every day.

## Tech

1. We will use three.js as our 3D package to build the simulation.
2. I propose to use svelte as our ui framework because of its modularity and speed.
3. Because of the potentially enormous scale differences, the renderer must be flexible with respect to scale.
4. The target system for this app is the browser. We will write the app in javascript, but webGL and webGL shaders can also be used. Also the use of webGPU or even WASM is permitted if there is a case for it.
5. I think we will have to use some sort of scenario to describe what we are doing at a given moment with the simulation: what am I looking at, over what period, with what camera, what events do I want to happen etc. Not clear yet, but something to think about.
6. Make sure to build the system according to a clear architecture, not a single blob of code.

## Usage scenarios

The following scenarios describes how users will work with the app and the type of widgets etc. they see when doing so. Where appropriate it also gives some indication of possible implementations.

1. When a user opens the app the configurator looks for a saved configuration. When none exists, the configurator selects the default configuration which is given as a startup parameter.
2. In the upper right corner there is a menu, the 'main menu', that consists of icons : an icon to put an overlay panel at the right (the settings panel) , an icon to put an overlay panel at the left (the chart panel). This 'main menu' is a ui node connected to the configurator. The overlay panels will be transparent so that the simulation going on behind them remains visible.
3. The settings pane will be used to harbour the settings for the elemenst of the simulationthat have settings, like magnification factors for the solar system, camera settings etc.
4. There are two icons on each canvas: one icon that allows to split the canvas in two equal parts one above the other, and one icon that allows a vertical equal split, one canvas next to the other. There is also an X-icon that when it is clicked removes that canves and let its neighbour absorb the extra space.
5. At the bottom of the screen for the entire width of the screen there is a zone that is reserved for special ui widgets and indicators or messages. One typical widget will be a time line and possibly a scrubber to go back and forth in time. 