# Workspace discovery

The model-owned discovery file is ../solar-system.blu.json. It launches the runtime-free development service with npm run application; workspace/start-model.mjs is the equivalent convenience entry. Source is under blu/space/solar-system.

For agent use, open the hosted HTTPS model or build it and select `dist` with Bridge's **Open model folder** action, then connect from the model's Agent panel. Workspace's local port-5180 launch remains a manual/developer view, not an approved agent origin. A Workspace embed does not submit setup prompts or grant agent authority. Scenario setup happens in Solar through its already connected Bridge conversation. Model previews and scientific references remain owned by Solar.

Developer observation/state-restoration helpers still use the authenticated local model-service boundary. They are development tools, not a second end-user agent connection. Old validation reports describe the earlier prototype and are historical.
