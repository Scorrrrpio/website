# Personal Website

working on some cool WebGPU stuff

# TODO
- map editor
- once again add objects at runtime
- favicon
- redo url spawn locations (url to scene and spawn)
- holdable objects (scene graph)
- PHYSICS OVERHAUL
    - AABBs to OBBs / more collision mesh classes? (WIP)
    - account for multiple moving objects
    - AABB collision handling and sliding STILL don't work
- DEBUGGING OVERHAUL
    - conditional js imports
    - Global variables
    - render debug over everything (no depth testing)
    - collider outlines
- lazy loading / loading performance improvements / skeleton
- rendering optimizations
- collision optimizations
- mobile controls
- GLTF or GLB
- custom components (extend component class, if not instanceof throw error)
- private instance variables

# NOTES
- blender cube .ply export: Forward Y, Up Z
- invert y texture coordinate in shaders
- camera snaps because Chromium randomly spikes movementX/movementY in mousemove event (only with external mouse not trackpad)
