import { lokiSpin, move, spinY } from "./animations";
import { loadScene } from "./loadAssets";
import { Renderer } from "./renderer";
import { generateHUD } from "./hud";
import { Player } from "./player";
import { Entity } from "./entity";

export class Scene {
    static async fromURL(url, cache, device, context, canvas, format, topology, multisamples, debug=false) {
        const scene = new Scene(url, cache);
        await scene.initialize(device, context, canvas, format, topology, multisamples, debug);
        return scene;
    }

    constructor(url, cache) {
        this.url = url;
        this.cache = cache;
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
            this.url, this.cache, device, viewBuffer, projectionBuffer, format, topology, multisamples, debug
        );
        // TODO better solution
        this.runtimes = await loadScene(
            "geometry/scene2.json", this.cache, device, viewBuffer, projectionBuffer, format, topology, multisamples, debug
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
        this.renderer = new Renderer(device, context, canvas, viewBuffer, projectionBuffer, multisamples);
        window.addEventListener("resize", () => {
            this.renderer.handleResize(this.player, canvas);
        });
    }

    update(frame) {
        // TODO demo
        /*
        if (frame % 240 === 179) {
            this.renderables.push(this.runtimes[0]);
        }
        if (frame % 240 === 239) {
            this.renderables.pop();
        }*/

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