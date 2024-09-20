import { mat4 } from "gl-matrix";

export class RenderEngine {
    constructor(device, context, format, canvas, multisample) {
        this.device = device;
        this.multisample = multisample;

        // 4xMSAA TEXTURES
        this.canvasTexture = context.getCurrentTexture();  // TODO what is this? what is context?
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

	render(camera, renderables, hud, context, canvas, debug=false) {
        // write mvp matrices to uniform buffers
        // model written in SceneManager
        this.device.queue.writeBuffer(this.viewBuffer, 0, new Float32Array(camera.view));
        this.device.queue.writeBuffer(this.projectionBuffer, 0, new Float32Array(camera.projection));

		// create GPUCommandEncoder
		const encoder = this.device.createCommandEncoder();

        // TODO pass function
        // create input texture the size of canvas
        this.canvasTexture = context.getCurrentTexture();

		// begin render pass
		const pass = encoder.beginRenderPass({
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
		});

        pass.setViewport(0, 0, canvas.width, canvas.height, 0, 1);  // defaults to full canvas

        for (const r of renderables) {
            pass.setVertexBuffer(0, r.vertexBuffer);
            pass.setBindGroup(0, r.bindGroup);
            pass.setPipeline(r.pipeline);
            pass.draw(r.vertexCount);
        }

        // end render pass
		pass.end();

        // create and submit GPUCommandBuffer
		this.device.queue.submit([encoder.finish()]);


        // HUD PASS
        // TODO HUD CameraComponent
        const aspect = canvas.width / canvas.height;
        const ortho = mat4.ortho(mat4.create(), -aspect, aspect, -1, 1, -1, 1);
        this.device.queue.writeBuffer(this.projectionBuffer, 0, ortho);

        // create GPUCommandEncoder
		const hudEncoder = this.device.createCommandEncoder();

        // create input texture the size of canvas
        this.canvasTexture = context.getCurrentTexture();

        // begin render pass
		const hudPass = hudEncoder.beginRenderPass({
			colorAttachments: [{
                view: this.msaaTexture.createView(),  // render to MSAA texture
				loadOp: "load",
				clearValue: { r: 0, g: 0, b: 0, a: 0 },
				storeOp: "store",
                resolveTarget: this.canvasTexture.createView(),
			}],
		});

        hudPass.setViewport(0, 0, canvas.width, canvas.height, 0, 1);  // defaults to full canvas

        // render HUD
        if (document.pointerLockElement === canvas) {
            hudPass.setBindGroup(0, hud.bindGroup);
            hudPass.setPipeline(hud.pipeline);
            hudPass.setVertexBuffer(0, hud.vertexBuffer);
            hudPass.draw(hud.vertexCount);
        }

        // end render pass
		hudPass.end();

        // create and submit GPUCommandBuffer
		this.device.queue.submit([hudEncoder.finish()]);
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