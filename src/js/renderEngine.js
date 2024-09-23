export class RenderEngine {
    constructor(device, format, target, multisample) {
        this.target = target;
        this.device = device;
        this.multisample = multisample;

        // 4xMSAA TEXTURES
        this.msaaTexture = device.createTexture({
            format: format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            size: [target.width, target.height],
            sampleCount: multisample,
        });


        // DEPTH TESTING TEXTURE
        this.depthTexture = device.createTexture({
            label: "Depth Texture",
            size: [target.width, target.height, 1],
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

	render(sceneManager, activeCamera, meshes, huds, context, debug=false) {
        // GET COMPONENTS
        const camera = sceneManager.getComponent(activeCamera, "CameraComponent");
        const renderables = meshes.map((m) => sceneManager.getComponent(m, "MeshComponent"));
        const hud = huds.map((h) => sceneManager.getComponent(h, "HUDComponent"));
        const hudCamera = huds.map((h) => sceneManager.getComponent(h, "CameraComponent"))[0];

        if (context instanceof GPUCanvasContext) this.canvasTexture = context.getCurrentTexture();  // create texture the size of canvas

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
                resolveTarget: context instanceof GPUCanvasContext ? this.canvasTexture.createView() : this.target.createView(),
			}],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthLoadOp: "clear",
                depthClearValue: 1.0,
                depthStoreOp: "store",
            },
		};

        this.#pass(renderables, passDescriptor);


        // HUD PASS
        if (document.pointerLockElement === this.target) {
            // write HUD projection matrix to unifrom buffer
            this.device.queue.writeBuffer(this.projectionBuffer, 0, hudCamera.projection);

            // HUD pass descriptor (no depth testing)
            const hudPassDescriptor = {
                colorAttachments: [{
                    view: this.msaaTexture.createView(),  // render to MSAA texture
                    loadOp: "load",  // do not clear
                    clearValue: { r: 0, g: 0, b: 0, a: 0 },
                    storeOp: "store",
                    resolveTarget: context instanceof GPUCanvasContext ? this.canvasTexture.createView() : this.target.createView(),
                }],
            };

            this.#pass(hud, hudPassDescriptor);
        }
	}

    #pass(renderables, passDescriptor) {
        const encoder = this.device.createCommandEncoder();  // create GPUCommandEncoder

        // begin render pass
		const pass = encoder.beginRenderPass(passDescriptor);
        pass.setViewport(0, 0, this.target.width, this.target.height, 0, 1);  // defaults to full canvas

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

    handleResize(format) {
        const parent = this.target.parentElement;

        const devicePixelRatio = window.devicePixelRatio || 1;
        this.target.width = Math.floor(parent.clientWidth * devicePixelRatio);
        this.target.height = Math.floor(parent.clientHeight * devicePixelRatio);

        if (this.msaaTexture) { this.msaaTexture.destroy(); }
        this.msaaTexture = this.device.createTexture({
            format: format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            size: [this.target.width, this.target.height],
            sampleCount: this.multisample,
        });

        if (this.depthTexture) { this.depthTexture.destroy(); }
        this.depthTexture = this.device.createTexture({
            label: "Depth Texture",
            size: [this.target.width, this.target.height, 1],
            format: "depth24plus",
            sampleCount: this.multisample,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }
}