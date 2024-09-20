import { createBindGroup, createBindGroupLayout, createPipeline, createVBAttributes } from "./wgpuHelpers";

// TODO awful format
export class TextTexture {
    constructor(outputTexture) {
        this.outputTexture = outputTexture;
        this.scrollOffset = 0
        // TODO as parameters
        this.textUrl;
        this.atlasUrl = "media/text/hackAtlas64.png";
        this.metadataUrl = "media/text/hackMetadata64.json";
        this.fontSize = 48;
    }

    // TODO some can be const not this
    async initialize(assetManager, text, device, format) {
        // CONSTANTS
        const MULTISAMPLE = 4;

        // SHADERS
        const [vertPromise, fragPromise] = assetManager.get("shaders/text.vert.wgsl", "shaders/text.frag.wgsl");

        // load glyph atlas to bmp and metadata json
        const [atlasPromise, metadataPromise] = assetManager.get(this.atlasUrl, this.metadataUrl);
        
        this.atlasBmp = await atlasPromise
        // GLYPH ATLAS TEXTURE
        this.atlasTexture = device.createTexture({
            label: "Instance Texture",
            size: [this.atlasBmp.width, this.atlasBmp.height, 1],
            format: format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        device.queue.copyExternalImageToTexture(
            { source: this.atlasBmp },
            { texture: this.atlasTexture },
            [this.atlasBmp.width, this.atlasBmp.height]
        );

        // create texture sampler
        this.sampler = device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
        });

        // BIND GROUP and LAYOUT
        const BGL = createBindGroupLayout(device, "Text BGL", "texture", "sampler");
        this.BG = createBindGroup(device, "Text Bind Group", BGL, this.atlasTexture.createView(), this.sampler);

        // 4xMSAA TEXTURES
        this.msaaTexture = device.createTexture({
            format: format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            size: [this.outputTexture.width, this.outputTexture.height],
            sampleCount: MULTISAMPLE,
        });

        // create text geometry
        this.metadata = await metadataPromise;
        this.#createTextGeometry(text);

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
        // GEOMETRY
        const atlasHeight = 64;
        const scale = this.fontSize / atlasHeight;
        const margin = 32;

        // recall uv [0, 0] is bottom left corner
        let xPos = -this.outputTexture.width + margin;  // [-1, 1] x coord and x increases
        let yPos = this.outputTexture.height - this.fontSize - margin;  // top (with space for glyph) and y decreases
        let lowest = 0;
        const letterQuads = [];

        // TODO assumes target face is square
        // TODO font scales with face
        const words = text.split(" ");
        for (let word of words) {
            let wordLength = 0;
            for (const ch of word) {
                if (ch != "\n") { wordLength += this.metadata[ch].advance * scale; }
                else break;
            }
            if (xPos + wordLength > this.outputTexture.width) {
                xPos = -this.outputTexture.width + margin;
                yPos -= this.fontSize;
            }
            word += " ";
            for (const ch of word) {
                if (ch === "\n") {
                    xPos = -this.outputTexture.width + margin;
                    yPos -= this.fontSize;
                }
                else {
                    let x0 = (xPos + this.metadata[ch].x * scale) / this.outputTexture.width;
                    let y1 = (yPos + this.metadata[ch].y * scale) / this.outputTexture.height;
                    let x1 = (xPos + (this.metadata[ch].x + this.metadata[ch].width) * scale) / this.outputTexture.width;
                    let y0 = (yPos + (this.metadata[ch].y - this.metadata[ch].height) * scale) / this.outputTexture.height;
                    // TODO desperately needs a function
                    letterQuads.push(
                        // TOP LEFT
                        x0, y1, this.metadata[ch].u0, this.metadata[ch].v0,
                        // BOTTOM LEFT
                        x0, y0, this.metadata[ch].u0, this.metadata[ch].v1,
                        // TOP RIGHT
                        x1, y1, this.metadata[ch].u1, this.metadata[ch].v0,
                        // BOTTOM RIGHT
                        x1, y0, this.metadata[ch].u1, this.metadata[ch].v1,
                        // TOP RIGHT
                        x1, y1, this.metadata[ch].u1, this.metadata[ch].v0,
                        // BOTTOM LEFT
                        x0, y0, this.metadata[ch].u0, this.metadata[ch].v1,
                    );
                    xPos += (this.metadata[ch].advance) * scale;

                    lowest = yPos;
                }
            }
        }

        this.scrollBottom = -(lowest - this.fontSize) / this.outputTexture.height - 1;

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