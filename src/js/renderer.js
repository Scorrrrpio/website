import { lokiSpin, move, spinY } from "./animations";

export class Renderer {
    constructor(device, context, canvas, viewBuffer, projectionBuffer, multisample) {
        this.device = device;
        this.context = context;  // TODO needed?
        this.viewBuffer = viewBuffer;
        this.projectionBuffer = projectionBuffer;
        this.multisample = multisample;

        // 4xMSAA TEXTURES
        this.canvasTexture = context.getCurrentTexture();  // TODO what is this?
        this.msaaTexture = device.createTexture({
            format: this.canvasTexture.format,
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
    }

	render(player, renderables, hud, canvas, debug=false) {
        // update animations
        for (const renderable of renderables) {
            switch (renderable.animation) {
                case "spinY":
                    spinY(renderable);
                    break;
                case "lokiSpin":
                    lokiSpin(renderable);
                    break;
                case "move":
                    move(renderable);
                    break;
            }
        }

        // update camera
        const aabbBoxes = renderables.map(renderable => renderable.collisionMesh);
        player.move(aabbBoxes);

        // TODO combine with animation -> O(n) not O(2n)
        // write mvp matrices to uniform buffers
        for (const { modelBuffer, model } of renderables) {
            this.device.queue.writeBuffer(modelBuffer, 0, model);
        }
        this.device.queue.writeBuffer(this.viewBuffer, 0, new Float32Array(player.pov.view));
        this.device.queue.writeBuffer(this.projectionBuffer, 0, new Float32Array(player.pov.projection));

		// create GPUCommandEncoder
		const encoder = this.device.createCommandEncoder();

        // create input texture the size of canvas
        this.canvasTexture = this.context.getCurrentTexture();

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

        for (const { pipeline, vertexBuffer, bindGroup, vertexCount } of renderables) {
            // draw
            pass.setPipeline(pipeline);
            pass.setBindGroup(0, bindGroup);
            pass.setVertexBuffer(0, vertexBuffer);
            pass.draw(vertexCount);
        }

        // render debug content
        if (debug) {
            for (const {debugPipeline, debugVB, debugBG, debugVertexCount } of renderables) {
                if (debugVertexCount) {
                    pass.setPipeline(debugPipeline);
                    pass.setBindGroup(0, debugBG);
                    pass.setVertexBuffer(0, debugVB);
                    pass.draw(debugVertexCount);
                }
            }
        }

        // render HUD
        if (document.pointerLockElement === canvas) {
            pass.setPipeline(hud.pipeline);
            pass.setBindGroup(0, hud.bindGroup);
            pass.setVertexBuffer(0, hud.vertexBuffer);
            pass.draw(hud.vertexCount);
        }

		// end render pass
		pass.end();

		// create and submit GPUCommandBuffer
		this.device.queue.submit([encoder.finish()]);
	}

    handleResize(player, canvas) {
        const parent = canvas.parentElement;

        const devicePixelRatio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(parent.clientWidth * devicePixelRatio);
        canvas.height = Math.floor(parent.clientHeight * devicePixelRatio);

        // TODO AWFUL
        player.pov.updateProjectionMatrix(canvas.width / canvas.height);

        if (this.msaaTexture) { this.msaaTexture.destroy(); }
        this.msaaTexture = this.device.createTexture({
            format: this.canvasTexture.format,
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