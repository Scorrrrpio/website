// imports
import { wgpuSetup } from "./wgpuSetup";
import { Player } from "./player";
import { assetsToBuffers } from "./loadAssets";
import { AssetLoadError } from "./errors";
import { generateHUD } from "./hud";
import { lokiSpin, spinY } from "./animations";

// inspired by the sphere graphic from lokinet.org
export async function fpv() {
    // WEBGPU SETUP
	const canvas = document.querySelector("canvas");
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;

    const { adapter, device, context, format } = await wgpuSetup(canvas);


    // GEOMETRY
    const TOPOLOGY = "triangle-list";
    const MULTISAMPLE = 4;
    // Scene assets as JSON
    // TODO glTF if things get dicey
    const assetsResponse = await fetch("geometry/scene.json");
    if (!assetsResponse.ok) { throw new AssetLoadError("Failed to load scene json"); }
    const assets = await assetsResponse.json();
    // TODO what if objects are added at runtime?
    const { renderables, viewBuffer, projectionBuffer } = await assetsToBuffers(assets, device, format, TOPOLOGY, MULTISAMPLE);
    
    const aabbBoxes = [];
    // TODO not ideal for potentially moving boxes
    for (const { collisionMesh } of renderables) {
        if (collisionMesh) { aabbBoxes.push(collisionMesh); }
    }

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


    // 4xMSAA TEXTURES
    let canvasTexture = context.getCurrentTexture();
    let msaaTexture = device.createTexture({
        format: canvasTexture.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        size: [canvas.width, canvas.height],
        sampleCount: MULTISAMPLE,
    });


    // DEPTH TESTING TEXTURE
    let depthTexture = device.createTexture({
        label: "Depth Texture",
        size: [canvas.width, canvas.height, 1],
        format: "depth24plus",
        sampleCount: MULTISAMPLE,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });


    // HANDLE RESIZE
    function handleResize() {
        const parent = canvas.parentElement;

        canvas.width = Math.floor(parent.clientWidth * devicePixelRatio);
        canvas.height = Math.floor(parent.clientHeight * devicePixelRatio);

        player.pov.updateProjectionMatrix(canvas.width / canvas.height);

        if (msaaTexture) { msaaTexture.destroy(); }
        msaaTexture = device.createTexture({
            format: canvasTexture.format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            size: [canvas.width, canvas.height],
            sampleCount: MULTISAMPLE,
        });

        if (depthTexture) { depthTexture.destroy(); }
        depthTexture = device.createTexture({
            label: "Depth Texture",
            size: [canvas.width, canvas.height, 1],
            format: "depth24plus",
            sampleCount: MULTISAMPLE,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }


    // HUD
    const hud = generateHUD(device, format, projectionBuffer, MULTISAMPLE);

    // RENDER LOOP
    let frame = 0;
	function renderLoop() {
        // update camera
        player.move(aabbBoxes);

        // update animations
        for (const renderable of renderables) {
            switch (renderable.animation) {
                case "spinY":
                    spinY(renderable);
                    break;
                case "lokiSpin":
                    lokiSpin(renderable);
                    break;
            }
        }

        // write mvp matrices to uniform buffers
        for (const { modelBuffer, model } of renderables) {
            device.queue.writeBuffer(modelBuffer, 0, model);
        }
        device.queue.writeBuffer(viewBuffer, 0, new Float32Array(player.pov.view));
        device.queue.writeBuffer(projectionBuffer, 0, new Float32Array(player.pov.projection));

		// create GPUCommandEncoder
		const encoder = device.createCommandEncoder();

        // create input texture the size of canvas
        canvasTexture = context.getCurrentTexture();

		// begin render pass
		const pass = encoder.beginRenderPass({
			colorAttachments: [{
                view: msaaTexture.createView(),  // render to MSAA texture
				loadOp: "clear",
				clearValue: { r: 0, g: 0, b: 0, a: 1 },
				storeOp: "store",
                resolveTarget: canvasTexture.createView(),
			}],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthLoadOp: "clear",
                depthClearValue: 1.0,
                depthStoreOp: "store",
            },
		});

        pass.setViewport(0, 0, canvas.width, canvas.height, 0, 1);  // defaults to full canvas

        for (const { pipeline, vertexBuffer, bindGroup, vertexCount } of renderables) {
            // draw
            pass.setPipeline(pipeline);
            pass.setBindGroup(0, bindGroup);
            pass.setVertexBuffer(0, vertexBuffer);
            pass.draw(vertexCount);
        }

        if (document.pointerLockElement === canvas) {
            // render HUD
            pass.setPipeline(hud.pipeline);
            pass.setBindGroup(0, hud.bindGroup);
            pass.setVertexBuffer(0, hud.vertexBuffer);
            pass.draw(hud.vertexCount);
        }

		// end render pass
		pass.end();

		// create and submit GPUCommandBuffer
		device.queue.submit([encoder.finish()]);

        frame++;
        requestAnimationFrame(renderLoop);
	}

    handleResize();
    window.addEventListener("resize", () => {
        handleResize();
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
        canvas.requestPointerLock();
        player.enableControls(canvas);
        renderLoop();  // black until start
    });
}