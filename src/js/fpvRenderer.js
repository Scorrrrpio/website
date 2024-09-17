import { wgpuSetup } from "./wgpuSetup";
import { Scene } from "./scene";

// TODO Engine class?
export async function fpv() {
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


    // SCENE SETUP
    const assetCache = new Map();
    const scene = await Scene.fromURL("geometry/scene.json", assetCache, device, context, canvas, format, TOPOLOGY, MULTISAMPLE, DEBUG);


    // RENDER LOOP
    let frame = 0;
	function renderLoop() {
        scene.update(frame++);
        scene.render(canvas, DEBUG);
        requestAnimationFrame(renderLoop);
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
        
        scene.player.enableControls(canvas);
        renderLoop();  // black until start
    });
}