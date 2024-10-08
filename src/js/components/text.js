import { createBindGroup, createBindGroupLayout, createPipeline, createVBAttributes } from "../wgpuHelpers";

export class TextComponent {
    // TODO eliminate assetManager dependency?
    static async fromUrls(outputTexture, textUrl, atlasUrl, metadataUrl, fontSize, margin, aspect, assetManager, device, format) {
        const text = new TextComponent(outputTexture, textUrl, atlasUrl, metadataUrl, aspect, fontSize, margin);
        await text.initialize(assetManager, device, format);
        return text;
    }

    constructor(outputTexture, textUrl, atlasUrl, metadataUrl, aspect=[1, 1], fontSize=48, margin=32) {
        this.outputTexture = outputTexture;
        this.scrollOffset = 0
        this.textUrl = textUrl;
        this.atlasUrl = atlasUrl;
        this.metadataUrl = metadataUrl;
        this.fontSize = fontSize;
        this.margin = margin * outputTexture.width / 512;
        this.aspect = aspect;
    }

    async initialize(assetManager, device, format) {
        // CONSTANTS
        const MULTISAMPLE = 4;

        // CONTENT
        const textPromise = assetManager.get(this.textUrl);
        // ASSETS
        const atlasPromise = assetManager.get(this.atlasUrl);
        const metadataPromise = assetManager.get(this.metadataUrl);
        // SHADERS
        const vertPromise = assetManager.get("shaders/text.vert.wgsl");
        const fragPromise = assetManager.get("shaders/text.frag.wgsl");

        
        const atlasBmp = await atlasPromise
        // GLYPH ATLAS TEXTURE
        const atlasTexture = device.createTexture({
            label: "Instance Texture",
            size: [atlasBmp.width, atlasBmp.height, 1],
            format: format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        device.queue.copyExternalImageToTexture(
            { source: atlasBmp },
            { texture: atlasTexture },
            [atlasBmp.width, atlasBmp.height]
        );

        // create texture sampler
        const sampler = device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
        });

        // BIND GROUP and LAYOUT
        const BGL = createBindGroupLayout(device, "Text BGL",
            [
                {type: "texture", visibility: GPUShaderStage.FRAGMENT},
                {type: "sampler", visibility: GPUShaderStage.FRAGMENT},
            ]
        );
        this.BG = createBindGroup(device, "Text Bind Group", BGL, [atlasTexture.createView(), sampler]);

        // 4xMSAA TEXTURES
        this.msaaTexture = device.createTexture({
            format: format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            size: [this.outputTexture.width, this.outputTexture.height],
            sampleCount: MULTISAMPLE,
        });

        // create text geometry
        this.metadata = await metadataPromise;
        this.atlasPixelSize = this.metadata.metadata.pixelSize;
        this.#createTextGeometry(await textPromise);

        // create vertex buffer
        const vbAttributes = createVBAttributes(["x", "y", "u", "v"]);
        this.vertexBuffer = device.createBuffer({
            label: "Text Geometry",
            size: this.vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices);

        // PIPELINE
        this.pipeline = createPipeline("Text Render Pipeline", device, BGL, await vertPromise, 4, vbAttributes, await fragPromise, format, "triangle-list", "none", false, MULTISAMPLE);

        this.#render(device);
    }

    #createTextGeometry(text) {
        const xScale = (this.outputTexture.width / 512) * this.fontSize * (64 / this.atlasPixelSize) / (this.aspect[0] * 3);// * this.fontSize / this.aspect[0];
        const yScale = (this.outputTexture.height / 512) * this.fontSize * (64 / this.atlasPixelSize) / (this.aspect[1] * 3);// * this.fontSize / this.aspect[1];

        // GEOMETRY
        // recall uv [0, 0] is bottom left corner
        let xPos = -this.outputTexture.width + this.margin;  // [-1, 1] x coord and x increases
        let yPos = this.outputTexture.height - this.atlasPixelSize * yScale - this.margin;  // top (with space for glyph) and y decreases
        let lowest = 0;
        const letterQuads = [];

        const words = text.split(" ");
        for (let word of words) {
            // check if word fits on line
            let wordLength = 0;
            for (const ch of word) {
                if (ch === "\n") break;
                else if (!this.metadata[ch]) continue;
                wordLength += this.metadata[ch].advance * xScale;
            }
            if (xPos > -this.outputTexture.width + this.margin && xPos + wordLength > this.outputTexture.width - this.margin) {
                xPos = -this.outputTexture.width + this.margin;
                yPos -= this.atlasPixelSize * yScale;
            }
            // create letter geometry
            word += " ";
            for (const ch of word) {
                if (ch === "\n") {
                    xPos = -this.outputTexture.width + this.margin;
                    yPos -= this.atlasPixelSize * yScale;
                }
                else if (!this.metadata[ch]) continue;
                else {
                    let x0 = (xPos + this.metadata[ch].x * xScale) / this.outputTexture.width;
                    let y1 = (yPos + this.metadata[ch].y * yScale) / this.outputTexture.height;
                    let x1 = (xPos + (this.metadata[ch].x + this.metadata[ch].width) * xScale) / this.outputTexture.width;
                    let y0 = (yPos + (this.metadata[ch].y - this.metadata[ch].height) * yScale) / this.outputTexture.height;
                    letterQuads.push(
                        x0, y1, this.metadata[ch].u0, this.metadata[ch].v0,  // TOP LEFT
                        x0, y0, this.metadata[ch].u0, this.metadata[ch].v1,  // BOTTOM LEFT
                        x1, y1, this.metadata[ch].u1, this.metadata[ch].v0,  // TOP RIGHT
                        x1, y0, this.metadata[ch].u1, this.metadata[ch].v1,  // BOTTOM RIGHT
                        x1, y1, this.metadata[ch].u1, this.metadata[ch].v0,  // TOP RIGHT
                        x0, y0, this.metadata[ch].u0, this.metadata[ch].v1,  // BOTTOM LEFT
                    );
                    xPos += (this.metadata[ch].advance) * xScale;

                    lowest = yPos;
                }
            }
        }

        this.scrollBottom = -(lowest - this.atlasPixelSize * yScale) / this.outputTexture.height - 1;

        this.vertices = Float32Array.from(letterQuads);
    }

    scroll(scroll, device) {
        scroll /= this.outputTexture.height;

        if (scroll < -this.scrollOffset) {  // prevent scrolling beyond top
            for (let i = 1; i < this.vertices.length; i += 4) {
                this.vertices[i] -= this.scrollOffset;
            }
            this.scrollOffset = 0;
        }
        else if (this.scrollBottom > this.scrollOffset + scroll) {  // prevent scrolling beyond bottom
            for (let i = 1; i < this.vertices.length; i += 4) {
                this.vertices[i] += scroll;
            }
            this.scrollOffset += scroll;
        }

        this.#render(device);
    }

    #render(device) {
        device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices);

        // create GPUCommandEncoder
		const encoder = device.createCommandEncoder();

        // begin render pass
		const pass = encoder.beginRenderPass({
			colorAttachments: [{
                view: this.msaaTexture.createView(),  // render to MSAA texture
				loadOp: "clear",
				clearValue: { r: 0, g: 0, b: 0, a: 1 },
				storeOp: "store",
                resolveTarget: this.outputTexture.createView(),  // multisample down to output
			}],
		});

		// render text
		pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.BG);
		pass.setVertexBuffer(0, this.vertexBuffer);
		pass.draw(this.vertices.length / 4);

		// end render pass
		pass.end();

		// create and submit GPUCommandBuffer
		device.queue.submit([encoder.finish()]);
    }
}