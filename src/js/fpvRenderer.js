// imports
import { wgpuSetup } from "./wgpuSetup";
import { Player } from "./player";
import { assetsToBuffers } from "./loadAssets";

// inspired by the sphere graphic from lokinet.org
export async function fpv(canvasID) {
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
    const assetsResponse = await fetch("geometry/scene.json");
    if (!assetsResponse.ok) { throw new Error("Failed to load scene"); }
    const assets = await assetsResponse.json();
    // TODO what if objects are added at runtime?
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
    // TODO read from URL
    const spawnPosition = [0, 0, 0];
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

        player.pov.updateProjectionMatrix(canvas.width / canvas.height);

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
    }


    // HUD
    // TODO awful code
    // geometry
    const aspect = canvas.width / canvas.height;
    const crosshair = new Float32Array([
        // X,    Y
        -0.02,    0,
         0.02,    0,
           0, -0.02,
           0,  0.02,
    ]);

    // vertex buffer
    const hudVB = device.createBuffer({
		label: "HUD Vertices",
		size: crosshair.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
	});

    device.queue.writeBuffer(hudVB, 0, crosshair);

    // shaders
    const hudVertexShaderCode = `
    @group(0) @binding(0) var<uniform> projection: mat4x4<f32>;

    @vertex
    fn vertexMain(@location(0) pos: vec2f) -> @builtin(position) vec4f {
        return projection * vec4f(pos, -3, 1);
    }`;
    const hudFragmentShaderCode = `
    @fragment
    fn fragmentMain (@builtin(position) pos: vec4f) -> @location(0) vec4f {
        return vec4f(1, 1, 1, 1);
    }`;
    const hudVertexShaderModule = device.createShaderModule({
        label: "HUD Vertex Shader",
        code: hudVertexShaderCode
    });
    const hudFragmentShaderModule = device.createShaderModule({
        label: "HUD Fragment Shader",
        code: hudFragmentShaderCode
    });

    // bind group
    const hudBGL = device.createBindGroupLayout({
        label: "HUD Bind Group Layout",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: "uniform" },
            },
        ],
    });
    const hudBG = device.createBindGroup({
        label: "HUD bind group",
        layout: hudBGL,
        entries: [{
            binding: 0,
            resource: { buffer: projectionBuffer },
        }],
    });

    // pipeline
	const hudPipeline = device.createRenderPipeline({
		label: "HUD Pipeline",
		layout: device.createPipelineLayout({
            label: "HUD Pipeline Layout",
            bindGroupLayouts: [hudBGL],
        }),
		vertex: {
			module: hudVertexShaderModule,
			entryPoint: "vertexMain",
			buffers: [{
				arrayStride: 4 * 2 /*bytes*/,
				attributes: [
                    {
                        format: "float32x2",
                        offset: 0,
                        shaderLocation: 0
                    },
                ]
			}],
		},
		fragment: {
			module: hudFragmentShaderModule,
			entryPoint: "fragmentMain",
			targets: [{
				format: format,
			}]
		},
		primitive: {
			topology: "line-list"
		},
        depthStencil: {
            format: "depth24plus",
            depthWriteEnabled: true,
            depthCompare: "always",
        },
        multisample: {
            count: 4,
        },
	});


    // RENDER LOOP
	function renderLoop() {
        // create input texture the size of canvas
        canvasTexture = context.getCurrentTexture();

        // update camera
        player.move(aabbBoxes);

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

        if (document.pointerLockElement === canvas) {
            // render HUD
            pass.setPipeline(hudPipeline);
            pass.setBindGroup(0, hudBG);
            pass.setVertexBuffer(0, hudVB);
            pass.draw(crosshair.length / 2);
        }

		// end render pass
		pass.end();

		// create and submit GPUCommandBuffer
		device.queue.submit([encoder.finish()]);

        requestAnimationFrame(renderLoop);
	}

    handleResize();
    window.addEventListener("resize", () => {
        handleResize();
    });
    
    // remove html ui
    const loading = document.getElementById("loading");
    loading.remove();
    const playButton = document.getElementById("play-svg");
    playButton.style.display = "block";

    renderLoop();
}