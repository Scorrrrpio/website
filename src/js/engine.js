import { wgpuSetup } from "./wgpuSetup";
import { AssetManager } from "./assetManager";
import { RenderEngine } from "./renderEngine";
import { SceneManager } from "./sceneManager";
import { AnimationComponent } from "./components/animationComponent";

export class Engine {
    constructor(target, scene, assetManager=null) {
        // engine
        this.target = target;
        this.scene = scene;
        this.assetManager = assetManager;
        this.frame = 0;
        // CONSTANTS
        this.TOPOLOGY = "triangle-list";
        this.MULTISAMPLE = 4;
        this.DEBUG = false;
    }

    async init() {
        const animationPromise = AnimationComponent.loadCustomAnimations();

        await this.#wgpuSetup();
        await this.createEngineComponents();

        // RESIZE HANDLING
        window.addEventListener("resize", () => {
            this.renderEngine.handleResize(this.format, this.target);
            for (const e in this.sceneManager.entitiesWith("CameraComponent")) {
                this.sceneManager.getComponent(e, "CameraComponent").updateProjectionMatrix(this.target.width / this.target.height);
            }
        });

        await animationPromise;
        
        this.start();  // START GAME
    }

    async #wgpuSetup() {
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
        // allows for sharing
        if (!this.assetManager) this.assetManager = new AssetManager(this.device);

        // RENDER ENGINE
        this.renderEngine = new RenderEngine(this.device, this.format, this.target, this.MULTISAMPLE);

        // SCENE MANAGER
        this.sceneManager = await SceneManager.fromURL(
            this.scene,
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
            this.sceneManager.enableControls(this.target);  // TODO don't pass this.target

            // start sub-engines
            this.sceneManager.startSubEngines();

            console.log("Starting engine!");
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
        this.renderEngine.render(this.sceneManager, camera, renderables, hud, this.context, this.DEBUG);
    }
}

// TODO move into components folder
// solutions:
// both Engine classes inherit from subclass (eliminate circular dependency)
// dynamic loading
// unify into one class
// don't extend
export class TextureProgramComponent extends Engine {
    constructor(target, scene, assetManager, device, format) {
        super(null, scene, assetManager);  // assetManager shared with root engine
        this.target = target;
        this.device = device;
        this.format = format;
    }

    async init() {
        await this.createEngineComponents();
    }

    // TODO synchronize frames with root engine
    start() {
        console.log("Starting subengine!");
        this.gameLoop();
    }

    render() {
        const camera = this.sceneManager.getActiveCamera();
        const renderables = this.sceneManager.getRenderables();
        const hud = this.sceneManager.getHUD();
        this.renderEngine.render(this.sceneManager, camera, renderables, hud, this.target, this.DEBUG);
    }
}