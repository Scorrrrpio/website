import { loadAssets } from "./loadAssets";
import { Renderer } from "./renderer";
import { generateHUD } from "./hud";
import { Player } from "./player";

export class Scene {
    constructor(url) {
        this.url = url;
    }

    async initialize(device, context, canvas, format, topology, multisamples, debug=false) {
        const json = this.#fetchScene();


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
        this.renderables = await loadAssets(
            await json, device, viewBuffer, projectionBuffer, format, topology, multisamples, debug
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
        this.hud = await generateHUD(device, context.getCurrentTexture().format, projectionBuffer, multisamples);

        // RENDERER
        this.renderer = new Renderer(device, context, canvas, viewBuffer, projectionBuffer, multisamples);
        window.addEventListener("resize", () => {
            this.renderer.handleResize(this.player, canvas);
        });
    }

    async #fetchScene() {
        // Scene assets as JSON
        const assetsResponse = await fetch(this.url);
        if (!assetsResponse.ok) { throw new AssetLoadError("Failed to fetch scene from " + url); }
        return assetsResponse.json();
    }

    drawFrame(canvas, debug=false) {
        this.renderer.render(this.player, this.renderables, this.hud, canvas, debug);
    }
}