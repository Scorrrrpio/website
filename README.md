# Personal Website

working on some cool WebGPU stuff

# TODO
- favicon
- instanced meshes
- include player in scene.json
- automate texture shader creation from scene.json (helloTriangle.\*.wgsl is hardcoded)
- add objects to scene at runtime
- better animation solution? (functions)
- DEBUGGING OVERHAUL
    - conditional js imports
    - Global variables
    - render debug over everything (no depth testing)
- holdable objects
- PHYSICS OVERHAUL
    - AABBs to OBBs / more collision mesh classes? (WIP)
    - account for multiple moving objects
    - AABB collision handling and sliding STILL don't work
- give player model matrix + model
- lazy loading / performance improvements
- rendering optimizations
- collision optimizations

# NOTES
- blender cube .ply export: Forward Y, Up Z
- invert y texture coordinate in shaders
- camera snaps because Chromium randomly spikes movementX/movementY in mousemove event (only with external mouse not trackpad)