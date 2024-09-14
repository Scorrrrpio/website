# Personal Website

working on some cool WebGPU stuff

# TODO
- text wrapping
- PHYSICS OVERHAUL
    - AABBs to OBBs / more collision mesh classes? (WIP)
    - account for multiple moving objects
    - AABB collision handling and sliding STILL don't work
- give player model matrix + model
- holdable objects
- favicon
- better animation solution? (functions)
- DEBUGGING OVERHAUL
    - conditional js imports
    - Global variables
- loadAssets -> Scene class
    - add objects to scene at runtime
- Entity class?
- Renderer class?
- scene object default properties
- automate testure shader creation from scene.json (helloTriangle.\*.wgsl is hardcoded)

# NOTES
- blender cube .ply export: Forward Y, Up Z
- invert y texture coordinate in shaders
- camera snaps because Chromium randomly spikes movementX/movementY in mousemove event (only with external mouse not trackpad)