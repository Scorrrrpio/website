// imports
import { wgpuSetup } from "./wgpuSetup";
import { Player } from "./player";
import { loadAssets } from "./loadAssets";
import { AssetLoadError } from "./errors";
import { generateHUD } from "./hud";
import { Renderer } from "./renderer";

// inspired by the sphere graphic from lokinet.org
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

    const { adapter, device, context, format } = await wgpuSetup(canvas);


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


    // GEOMETRY
    // Scene assets as JSON
    const assetsResponse = await fetch("geometry/scene.json");
    if (!assetsResponse.ok) { throw new AssetLoadError("Failed to load scene json"); }
    const assets = await assetsResponse.json();
    // TODO what if objects are added at runtime?
    const renderables = await loadAssets(
        assets, device, viewBuffer, projectionBuffer, format, TOPOLOGY, MULTISAMPLE, DEBUG
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
    const player = new Player(canvas, spawn.p, spawn.r);


    // HUD
    // TODO this needs depth testing and MSAA for some reason?
    const hud = await generateHUD(device, context.getCurrentTexture().format, projectionBuffer, MULTISAMPLE);


    // RENDER LOOP
    const renderer = new Renderer(device, context, canvas, viewBuffer, projectionBuffer, MULTISAMPLE);
	function renderLoop() {
        renderer.render(player, renderables, hud, canvas, DEBUG);
        requestAnimationFrame(renderLoop);
	}

    renderer.handleResize(player, canvas);
    window.addEventListener("resize", () => {
        renderer.handleResize(player, canvas);
    });
    
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
        
        player.enableControls(canvas);
        renderLoop();  // black until start
    });
}