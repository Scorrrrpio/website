import { wgpuSetup } from "./wgpuSetup";
import { AssetManager } from "./assetManager";
import { RenderEngine } from "./renderEngine";
import { SceneManager } from "./sceneManager";

export async function engine() {
    // CONSTANTS
    const TOPOLOGY = "triangle-list";
    const MULTISAMPLE = 4;
    const DEBUG = false;


    // WEBGPU SETUP
	const canvas = document.querySelector("canvas");
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;

    const { device, context, format } = await wgpuSetup(canvas);


    // ASSET MANAGER
    const assetManager = new AssetManager(device);

    // RENDER ENGINE
    const renderEngine = new RenderEngine(device, context, format, canvas, MULTISAMPLE);

    // SCENE MANAGER
    const scene = await SceneManager.fromURL(
        "geometry/scene.json",
        assetManager,
        device, context, format, canvas,
        renderEngine.viewBuffer, renderEngine.projectionBuffer,
        TOPOLOGY, MULTISAMPLE, DEBUG
    );


    // RESIZE HANDLING
    window.addEventListener("resize", () => {
        for (const e in scene.entitiesWith("CameraComponent")) {
            renderEngine.handleResize(format, scene.components[e].CameraComponent, canvas);
        }
    });


    // GAME LOOP
    let frame = 0;
	function gameLoop() {
        scene.update(frame++, device, format, TOPOLOGY, MULTISAMPLE, DEBUG);
        renderEngine.render(scene.getActiveCamera(), scene.getRenderables(), scene.hud, context, canvas, DEBUG);
        requestAnimationFrame(gameLoop);
	}
    

    // START GAME
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
        const lockPromise = canvas.requestPointerLock({ unadjustedMovement: true });
        if (lockPromise) {
            lockPromise.catch((error) => {
                if (error.name === "NotSupportedError") {
                    console.log("Cannot disable mouse acceleration in this browser");
                    canvas.requestPointerLock();
                }
                else throw error;
            })
        }
        
        // enable player controls
        const controlled = scene.entitiesWith("InputComponent");
        for (const e of controlled) {
            scene.getComponent(e, "InputComponent").enableControls(canvas);
        }
        gameLoop();  // black until start
    });
}