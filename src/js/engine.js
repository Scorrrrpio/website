import { wgpuSetup } from "./wgpuSetup";
import { AssetManager } from "./assetManager";
import { SceneManager } from "./sceneManager";

// TODO Engine class?
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

    // TODO consider keeping as object
    const { adapter, device, context, format } = await wgpuSetup(canvas);


    // ASSET MANAGER
    const assetManager = new AssetManager(device);


    // SCENE MANAGER
    const scene = await SceneManager.fromURL("geometry/scene.json", assetManager, device, context, canvas, format, TOPOLOGY, MULTISAMPLE, DEBUG);


    // GAME LOOP
    let frame = 0;
	async function gameLoop() {  // TODO why async
        await scene.update(frame++, device, format, TOPOLOGY, MULTISAMPLE, DEBUG);
        scene.render(canvas, DEBUG);
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
        scene.player2.enableControls(canvas);
        gameLoop();  // black until start
    });
}