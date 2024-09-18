import { lokiSpin, move, spinY } from "./animations";
import { createDebugGeometry, createInstance, loadScene } from "./assetManager";
import { RenderEngine } from "./renderEngine";  // TODO move to Engine
import { generateHUD } from "./hud";
import { Player } from "./player";

export class SceneManager {
    static async fromURL(url, assetManager, device, context, canvas, format, topology, multisamples, debug=false) {
        const scene = new SceneManager(url, assetManager);
        await scene.initialize(device, context, canvas, format, topology, multisamples, debug);
        return scene;
    }

    constructor(url, assetManager) {
        this.url = url;
        this.assetManager = assetManager;
    }

    async initialize(device, context, canvas, format, topology, multisamples, debug=false) {
        // UNIFORM BUFFERS
        // create uniform buffers for MVP matrices
        const viewBuffer = device.createBuffer({
            label: "View Uniform",
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        const projectionBuffer = device.createBuffer({
            label: "Projection Uniform",
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });


        // ENTITIES
        this.renderables = await loadScene(
            this.url, this.assetManager, device, viewBuffer, projectionBuffer, format, topology, multisamples, debug
        );


        // PLAYER
        // spawn coordinates
        function urlToSpawn() {
            const spawns = {
                "default": {
                    p: [0, 2.001, 0],
                    r: [0, 0, 0],
                },
                "bio": {
                    p: [0, 0, -40],
                    r: [0, 0, 0],
                },
            };
            const params = new URLSearchParams(window.location.search);
            const spawn = params.get("spawn");
            if (spawn) { return spawns[spawn]; }
            else { return spawns.default; }
        }
        
        // create player object
        const spawn = urlToSpawn(); 
        this.player = new Player(canvas, spawn.p, spawn.r);


        // HUD
        // TODO this needs depth testing and MSAA for some reason?
        this.hud = await generateHUD(device, format, projectionBuffer, multisamples);

        // RENDERER
        this.renderer = new RenderEngine(device, context, canvas, viewBuffer, projectionBuffer, multisamples);
        window.addEventListener("resize", () => {
            this.renderer.handleResize(this.player, canvas);
        });
    }

    async update(frame, device, format, topology, multisamples, debug=false) {
        // TODO demo
        /*
        if (frame % 240 === 179) {
            const data = {
                p: [-20, 4, 0],
                s: [2, 2, 2],
                texture: {
                    url: "media/mysterious-canine.jpg",
                    faces: ["front", "back", "right", "left", "top", "bottom"],
                },
                vertexShader: "shaders/texture.vert.wgsl",
                fragmentShader: "shaders/texture.frag.wgsl",
            }
            const newCube = await createInstance(
                data,  // instance data
                this.renderables[0].asset,  // base asset
                this.assetManager,  // cache
                device,
                format,
                this.renderer.viewBuffer,
                this.renderer.projectionBuffer,
                topology,
                multisamples,
                debug
            );
            this.renderables[0].instances.push(newCube);
        }
        if (frame % 240 === 239) {
            this.renderables[0].instances.pop();
        }
        */

        // update animations
        for (const asset of this.renderables) {
            for (const instance of asset.instances) {
                switch (instance.animation) {
                    case "spinY":
                        spinY(instance);
                        break;
                    case "lokiSpin":
                        lokiSpin(instance);
                        break;
                    case "move":
                        move(instance);
                        createDebugGeometry(instance, device);
                        break;
                }
            }
        }

        // update camera
        const colliders = this.renderables.flatMap(asset => asset.instances.map(instance => instance.collider));
        this.player.move(colliders);
    }

    render(canvas, debug) {
        this.renderer.render(this.player, this.renderables, this.hud, canvas, debug)
    }
}