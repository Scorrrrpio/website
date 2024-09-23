import { wgpuSetup } from "./wgpuSetup";
import { AssetManager } from "./assetManager";
import { RenderEngine } from "./renderEngine";
import { SceneManager } from "./sceneManager";

// TODO to engine class
// output target (canvas or texture)
// starting scene

export class Engine {
    constructor(target, scene) {
        // engine
        this.target = target;
        this.scene = scene;
        this.frame = 0;
        // CONSTANTS
        this.TOPOLOGY = "triangle-list";
        this.MULTISAMPLE = 4;
        this.DEBUG = false;
    }

    async init() {
        await this.wgpuSetup();
        await this.createEngineComponents();

        // RESIZE HANDLING
        window.addEventListener("resize", () => {
            this.renderEngine.handleResize(this.format, this.target);
            for (const e in this.sceneManager.entitiesWith("CameraComponent")) {
                this.sceneManager.getComponent(e, "CameraComponent").updateProjectionMatrix(this.target.width / this.target.height);
            }
        });

        // TODO testing
        const textureSize = [512, 512];
        const texture = this.device.createTexture({
            label: "Program Texture",
            size: textureSize,
            format: this.format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });
        const subengine = new TextureEngine(texture, this.scene, this.device, this.format);
        subengine.init();

        this.start();  // START GAME
    }

    async wgpuSetup() {
        // WEBGPU SETUP
        if (!(this.target instanceof Element)) { throw new Error("Root Engine target must be a canvas element"); }
        const devicePixelRatio = window.devicePixelRatio || 1;
        this.target.width = this.target.clientWidth * devicePixelRatio;
        this.target.height = this.target.clientHeight * devicePixelRatio;

        const { device, context, format } = await wgpuSetup(this.target);
        this.device = device;
        this.context = context;
        this.format = format;
    }

    async createEngineComponents() {
        // ASSET MANAGER
        this.assetManager = new AssetManager(this.device);

        // RENDER ENGINE
        this.renderEngine = new RenderEngine(this.device, this.format, this.target, this.MULTISAMPLE);

        // SCENE MANAGER
        this.sceneManager = await SceneManager.fromURL(
            "geometry/scene.json",
            this.assetManager,
            this.device, this.format, this.target,
            this.renderEngine.viewBuffer, this.renderEngine.projectionBuffer,
            this.TOPOLOGY, this.MULTISAMPLE, this.DEBUG
        );
    }
    
    start() {
        // remove loading ui
        const loading = document.getElementById("loading");
        loading.remove();
        const playButton = document.getElementById("play-svg");
        playButton.style.display = "block";
        const controlsText = document.getElementById("controls");
        controlsText.style.display = "block";

        // start game with play button
        playButton.addEventListener("click", () => {
            // remove play button
            playButton.remove();
            controlsText.style.display = "none";

            // request pointer lock (and handle browser differences)
            // chromium returns Promise, firefox returns undefined
            const lockPromise = this.target.requestPointerLock({ unadjustedMovement: true });
            if (lockPromise) {
                lockPromise.catch((error) => {
                    if (error.name === "NotSupportedError") {
                        console.log("Cannot disable mouse acceleration in this browser");
                        this.target.requestPointerLock();
                    }
                    else throw error;
                })
            }
            
            // enable player controls
            const controlled = this.sceneManager.entitiesWith("InputComponent");
            for (const e of controlled) {
                this.sceneManager.getComponent(e, "InputComponent").enableControls(this.target);
            }
            this.gameLoop();  // black until start
        });
    }

    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        this.sceneManager.update(this.frame++, this.device, this.format, this.TOPOLOGY, this.MULTISAMPLE, this.DEBUG);
    }

    render() {
        const camera = this.sceneManager.getActiveCamera();
        const renderables = this.sceneManager.getRenderables();
        const hud = this.sceneManager.getHUD();
        this.renderEngine.render(this.sceneManager, camera, renderables, hud, this.context, this.target, this.DEBUG);
    }
}

export class TextureEngine extends Engine {
    constructor(target, scene, device, format) {
        super(null, scene);
        this.target = target;
        this.device = device;
        this.format = format;
    }

    async init() {
        await this.createEngineComponents();
        this.start();
    }

    wgpuSetup() {
        console.warn("Skipping wgpuSetup call for SubEngine - device and format come from root Engine.");
    }

    start() {
        console.log("Starting subengine!");
        this.update();
        this.render();
    }
}