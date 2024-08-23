// imports
import { mat4 } from "gl-matrix";
import { wgpuSetup } from "./wgpuSetup";
import { plyToTriangleList } from "./plyReader";
import { fpvCamera } from "./camera";
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
    // TODO load assets and create all buffers
    // read from .ply files
    const TOPOLOGY = "triangle-list";
    // Scene assets as JSON
    // TODO glTF if things get dicey
    const assets = {
        objects: [
            {
                file: "geometry/cube.ply",
                position: [-1, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
            },
            {
                file: "geometry/lokiSphere.ply",
                position: [1, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
            }
        ],
    };
    const { vertexBuffers, viewBuffer, projectionBuffer } = await assetsToBuffers(assets, device);


    // SHADERS
	// vertex shader
	const vertexShaderCode = `
        struct VertexOutput {
            @location(0) barycentric: vec3f,
            @builtin(position) position: vec4f
        };

        @group(0) @binding(0) var<uniform> model: mat4x4<f32>;
        @group(0) @binding(1) var<uniform> view: mat4x4<f32>;
        @group(0) @binding(2) var<uniform> projection: mat4x4<f32>;

        @vertex
        fn vertexMain(@location(0) pos: vec3f, @builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
            var barycentrics = array<vec3f, 3> (
                vec3(1, 0, 0),
                vec3(0, 1, 0),
                vec3(0, 0, 1)
            );
            var output: VertexOutput;
            var mvp = projection * view * model;
            output.position = mvp * vec4f(pos, 1);
            output.barycentric = barycentrics[vertexIndex % 3];
            return output;
    }`;

    // fragment shader
    const fragmentShaderCode = `
        @fragment
        fn fragmentMain(@location(0) bary: vec3f) -> @location(0) vec4f {
            let threshold = 0.01;
            if (min(min(bary.x, bary.y), bary.z) >= threshold) {
                return vec4f(0, 0, 0, 1);
            }
            return vec4f(1, 1, 1, 1);
        }
    `;

    // create shader modules
	const vertexShaderModule = device.createShaderModule({
		label: "FPV Vertex Shader",
		code: vertexShaderCode
	});
	const fragmentShaderModule = device.createShaderModule({
		label: "FPV Fragment Shader",
		code: fragmentShaderCode
	});


    // CAMERA
    // coordinates
    const cameraPosition = [0, 0, 7];
    const cameraRotation = [0, 0, 0];
    // projection matrix
    const fov = Math.PI / 6;  // TODO cap at 2 * Math.PI / 3
    const near = 0.1;  // clipping planes
    const far = 100.0;
    // aspect ratio computed from canvas

    // create camera object
    const pov = new fpvCamera(canvas, cameraPosition, cameraRotation, fov, near, far);


    // PIPELINE
    const SAMPLES = 4;
	const pipeline = device.createRenderPipeline({
		label: "FPV Pipeline",
		layout: device.createPipelineLayout({
            label: "FPV Pipeline Layout",
            bindGroupLayouts: [vertexBuffers[0].bindGroupLayout],
        }),
		vertex: {
			module: vertexShaderModule,
			entryPoint: "vertexMain",
			buffers: [{
				arrayStride: 4 * 3 /*bytes*/,
				attributes: [{
					format: "float32x3",
					offset: 0,
					shaderLocation: 0
				}],
			}],
		},
		fragment: {
			module: fragmentShaderModule,
			entryPoint: "fragmentMain",
			targets: [{
				format: format,
                blend: {
                    color: {
                        srcFactor: "src-alpha",
                        dstFactor: "one-minus-src-alpha",
                        operation: "add",
                    },
                    alpha: {
                        srcFactor: "one",
                        dstFactor: "one-minus-src-alpha",
                        operation: "add",
                    },
                },
                writeMask: GPUColorWrite.ALL,
			}],
		},
		primitive: {
            topology: TOPOLOGY,
            frontFace: "ccw",
            cullMode: "back",
        },
        depthStencil: {
            format: "depth24plus",
            depthWriteEnabled: true,
            depthCompare: "less",
        },
        multisample: {
            count: SAMPLES,
        },
	});


    // 4xMSAA TEXTURES
    let canvasTexture = context.getCurrentTexture();
    let msaaTexture = device.createTexture({
        format: canvasTexture.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        size: [canvas.width, canvas.height],
        sampleCount: 4,
    });


    // DEPTH TESTING
    let depthTexture = device.createTexture({
        label: "Depth Texture",
        size: [canvas.width, canvas.height, 1],
        format: "depth24plus",
        sampleCount: 4,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });


    // HANDLE RESIZE
    function handleResize() {
        const parent = canvas.parentElement;

        canvas.width = Math.floor(parent.clientWidth * devicePixelRatio);
        canvas.height = Math.floor(parent.clientHeight * devicePixelRatio);

        // TODO handle in camera
        mat4.perspective(pov.projection, fov, canvas.width / canvas.height, near, far);

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
        pov.updateCamera();

        // write mvp matrices to uniform buffers
        for (const { modelBuffer, model } of vertexBuffers) {
            device.queue.writeBuffer(modelBuffer, 0, model);
        }
        device.queue.writeBuffer(viewBuffer, 0, new Float32Array(pov.view));
        device.queue.writeBuffer(projectionBuffer, 0, new Float32Array(pov.projection));

		// create GPUCommandEncoder
		const encoder = device.createCommandEncoder();

		// begin render pass
		const pass = encoder.beginRenderPass({
			colorAttachments: [{
                view: msaaTexture.createView(),  // render to MSAA texture
				//view: context.getCurrentTexture().createView(),
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

		// draw
        pass.setPipeline(pipeline);

        for (const { buffer, bindGroup, vertexCount } of vertexBuffers) {
            pass.setBindGroup(0, bindGroup);
            pass.setVertexBuffer(0, buffer);
            pass.draw(vertexCount);
        }

		// end render pass
		pass.end();

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