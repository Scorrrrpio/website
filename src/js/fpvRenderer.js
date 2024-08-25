// imports
import { mat4 } from "gl-matrix";
import { wgpuSetup } from "./wgpuSetup";
import { Player } from "./player";
import { assetsToBuffers } from "./loadAssets";

// inspired by the sphere graphic from lokinet.org
export async function fpv(canvasID, autoplay, allowControl) {
    // WEBGPU SETUP
	const canvas = document.getElementById(canvasID);
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;

    const { adapter, device, context, format } = await wgpuSetup(canvas);


    // GEOMETRY
    const TOPOLOGY = "triangle-list";
    const MULTISAMPLE = 4;
    // Scene assets as JSON
    // TODO glTF if things get dicey
    const assets = {
        objects: [
            {
                file: "geometry/cube.ply",
                vertexShader: "shaders/cubeVertex.wgsl",
                fragmentShader: "shaders/cubeFragment.wgsl",
                collision: "aabb",
                instances: [
                    {
                        position: [0, 0, 0],
                        rotation: [0, 0, 0],
                        scale: [7, 1, 7],
                        
                    },
                    {
                        position: [-7, 1, -7],
                        rotation: [0, 0, 0],
                        scale: [7, 1, 7],
                    },
                    {
                        position: [0, 2, -14],
                        rotation: [0, 0, 0],
                        scale: [7, 1, 7],
                    },
                    {
                        position: [7, 3, -7],
                        rotation: [0, 0, 0],
                        scale: [7, 1, 7],
                    },
                ],
            },
            {
                file: "geometry/lokiSphere.ply",
                vertexShader: "shaders/sphereVertex.wgsl",
                fragmentShader: "shaders/sphereFragment.wgsl",
                collision: "sphere",
                instances: [
                    {
                        position: [-3.5, 1.5, -30],
                        rotation: [0, 0, 0],
                        scale: [10, 10, 10],
                    },
                ],
            },
            {
                file: "geometry/pyramidOcto.ply",
                vertexShader: "shaders/pyramidVertex.wgsl",
                fragmentShader: "shaders/pyramidFragment.wgsl",
                collision: "none",  // TODO
                instances: [
                    {
                        position: [-3.5, 2, -3.5],
                        rotation: [0, 0, 0],
                        scale: [2, 2, 2],
                    },
                ],
            },
        ],
    };
    const { renderables, viewBuffer, projectionBuffer } = await assetsToBuffers(assets, device, format, TOPOLOGY, MULTISAMPLE);
    
    const aabbBoxes = [];
    // TODO not ideal for potentially moving boxes
    for (const { collisionMesh } of renderables) {
        if (collisionMesh) { aabbBoxes.push(collisionMesh); }
    }

    // TODO automate creation and integrate into object
    /*{
        id
        vertex buffer
        vertex count
        model matrix
        model matrix uniform buffer
        bind group (for model matrix)
        AABB (or collision mesh + mesh type)
        shader
    } */


    // PLAYER
    // coordinates
    const spawnPosition = [0, 0, 10];
    const spawnRotation = [0, 0, 0];
    // projection matrix
    const fov = Math.PI / 6;  // TODO cap at 2 * Math.PI / 3
    const near = 0.1;  // clipping planes
    const far = 1000.0;
    // aspect ratio computed from canvas

    // create player object
    const player = new Player(canvas, spawnPosition, spawnRotation);


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

        // TODO handle in camera
        mat4.perspective(player.pov.projection, fov, canvas.width / canvas.height, near, far);

        if (msaaTexture) { msaaTexture.destroy(); }
        msaaTexture = device.createTexture({
            format: canvasTexture.format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            size: [canvas.width, canvas.height],
            sampleCount: 4,
        });

        if (depthTexture) { depthTexture.destroy(); }
        depthTexture = device.createTexture({
            label: "Depth Texture",
            size: [canvas.width, canvas.height, 1],
            format: "depth24plus",
            sampleCount: 4,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });

        if (!animating && !autoplay) {
            renderLoop();
        }
    }


    // RENDER LOOP
    let animating = false;
	function renderLoop() {
        // create input texture the size of canvas
        canvasTexture = context.getCurrentTexture();

        // update camera
        player.move(aabbBoxes);

        // check for collisions

        // write mvp matrices to uniform buffers
        for (const { modelBuffer, model } of renderables) {
            device.queue.writeBuffer(modelBuffer, 0, model);
        }
        device.queue.writeBuffer(viewBuffer, 0, new Float32Array(player.pov.view));
        device.queue.writeBuffer(projectionBuffer, 0, new Float32Array(player.pov.projection));

		// create GPUCommandEncoder
		const encoder = device.createCommandEncoder();

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

		// end render pass
		pass.end();

        // TODO render HUD

		// create and submit GPUCommandBuffer
		device.queue.submit([encoder.finish()]);

        if (animating || autoplay) {
            requestAnimationFrame(renderLoop);
        }
	}


    // ANIMATION CONTROL
    function startRenderLoop() {
        if (!animating) {
            animating = true;
            renderLoop();
        }
    }

    function stopRenderLoop() {
        animating = false;
    }

    handleResize();
    window.addEventListener("resize", () => {
        handleResize();
    });
    
    renderLoop();

    if (!autoplay) {
	    canvas.addEventListener("mouseenter", startRenderLoop);
        canvas.addEventListener("mouseleave", stopRenderLoop);
    }
}