export class RenderEngine {
    constructor(device, format, canvas, multisample) {
        this.device = device;
        this.multisample = multisample;

        // 4xMSAA TEXTURES
        this.msaaTexture = device.createTexture({
            format: format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            size: [canvas.width, canvas.height],
            sampleCount: multisample,
        });


        // DEPTH TESTING TEXTURE
        this.depthTexture = device.createTexture({
            label: "Depth Texture",
            size: [canvas.width, canvas.height, 1],
            format: "depth24plus",
            sampleCount: multisample,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });


        // UNIFORM BUFFERS
        this.viewBuffer = device.createBuffer({
            label: "View Uniform",
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        this.projectionBuffer = device.createBuffer({
            label: "Projection Uniform",
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
    }

	render(sceneManager, activeCamera, meshes, huds, context, canvas, debug=false) {
        // GET COMPONENTS
        const camera = sceneManager.getComponent(activeCamera, "CameraComponent");
        const renderables = meshes.map((m) => sceneManager.getComponent(m, "MeshComponent"));
        const hud = huds.map((h) => sceneManager.getComponent(h, "HUD"));
        const hudCamera = huds.map((h) => sceneManager.getComponent(h, "CameraComponent"))[0];

        this.canvasTexture = context.getCurrentTexture();  // create texture the size of canvas

        // 3D PASS
        // write mvp matrices to uniform buffers
        for (const m of meshes) {
            const mesh = {
                buffer: sceneManager.getComponent(m, "MeshComponent").modelBuffer,
                model: sceneManager.getComponent(m, "TransformComponent").model,
            }
            this.device.queue.writeBuffer(mesh.buffer, 0, mesh.model);
        }
        this.device.queue.writeBuffer(this.viewBuffer, 0, new Float32Array(camera.view));
        this.device.queue.writeBuffer(this.projectionBuffer, 0, new Float32Array(camera.projection));

        // 3D pass descriptor
        const passDescriptor = {
			colorAttachments: [{
                view: this.msaaTexture.createView(),  // render to MSAA texture
				loadOp: "clear",
				clearValue: { r: 0, g: 0, b: 0, a: 1 },
				storeOp: "store",
                resolveTarget: this.canvasTexture.createView(),
			}],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthLoadOp: "clear",
                depthClearValue: 1.0,
                depthStoreOp: "store",
            },
		};

        this.#pass(renderables, canvas, passDescriptor);


        // HUD PASS
        if (document.pointerLockElement === canvas) {
            // write HUD projection matrix to unifrom buffer
            this.device.queue.writeBuffer(this.projectionBuffer, 0, hudCamera.projection);

            // HUD pass descriptor (no depth testing)
            const hudPassDescriptor = {
                colorAttachments: [{
                    view: this.msaaTexture.createView(),  // render to MSAA texture
                    loadOp: "load",  // do not clear
                    clearValue: { r: 0, g: 0, b: 0, a: 0 },
                    storeOp: "store",
                    resolveTarget: this.canvasTexture.createView(),
                }],
            };

            this.#pass(hud, canvas, hudPassDescriptor);
        }
	}

    #pass(renderables, canvas, passDescriptor) {
        const encoder = this.device.createCommandEncoder();  // create GPUCommandEncoder

        // begin render pass
		const pass = encoder.beginRenderPass(passDescriptor);
        pass.setViewport(0, 0, canvas.width, canvas.height, 0, 1);  // defaults to full canvas

        for (const r of renderables) {
            pass.setBindGroup(0, r.bindGroup);
            pass.setPipeline(r.pipeline);
            pass.setVertexBuffer(0, r.vertexBuffer);
            pass.draw(r.vertexCount);
        }

        // end render pass
		pass.end();

        this.device.queue.submit([encoder.finish()]);  // create and submit GPUCommandBuffer
    }

    handleResize(format, canvas) {
        const parent = canvas.parentElement;

        const devicePixelRatio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(parent.clientWidth * devicePixelRatio);
        canvas.height = Math.floor(parent.clientHeight * devicePixelRatio);

        if (this.msaaTexture) { this.msaaTexture.destroy(); }
        this.msaaTexture = this.device.createTexture({
            format: format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            size: [canvas.width, canvas.height],
            sampleCount: this.multisample,
        });

        if (this.depthTexture) { this.depthTexture.destroy(); }
        this.depthTexture = this.device.createTexture({
            label: "Depth Texture",
            size: [canvas.width, canvas.height, 1],
            format: "depth24plus",
            sampleCount: this.multisample,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }
}