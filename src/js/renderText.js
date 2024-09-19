import { createBindGroup, createBindGroupLayout, createPipeline, createVBAttributes } from "./wgpuHelpers";

// TODO awful format
// TODO some can be const not this
export class TextRenderer {
    constructor(outputTexture, format, text) {
        this.outputTexture = outputTexture;
        this.format = format;
        this.text = text;  // TODO why not pass at render time?
        // TODO as parameters
        this.atlasUrl = "media/text/hackAtlas64.png";
        this.metadataUrl = "media/text/hackMetadata64.json";
        this.fontSize = 48;
        this.scroll = 0
    }

    async initialize(assetManager, device) {
        // CONSTANTS
        const MULTISAMPLE = 4;

        // load glyph atlas to bmp and metadata json
        [this.atlasBmp, this.metadata] = await assetManager.get(this.atlasUrl, this.metadataUrl);

        // GLYPH ATLAS TEXTURE
        this.atlasTexture = device.createTexture({
            label: "Instance Texture",
            size: [this.atlasBmp.width, this.atlasBmp.height, 1],
            format: this.format,
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

        // SHADERS
        const [vertexModule, fragmentModule] = await assetManager.get("shaders/text.vert.wgsl", "shaders/text.frag.wgsl");

        this.createTextGeometry(0);

        // create vertex buffer
        this.vertexBuffer = device.createBuffer({
            label: "Text Geometry",
            size: this.vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });

        device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices);

        // BIND GROUP and LAYOUT
        const BGL = createBindGroupLayout(device, "Text BGL", "texture", "sampler");
        this.BG = createBindGroup(device, "Text Bind Group", BGL, this.atlasTexture.createView(), this.sampler);


        // PIPELINE
        const vbAttributes = createVBAttributes(["x", "y", "u", "v"]);
        this.pipeline = createPipeline("Text Render Pipeline", device, BGL, vertexModule, 4, vbAttributes, fragmentModule, this.format, "triangle-list", "none", false, MULTISAMPLE);

        // 4xMSAA TEXTURES
        this.msaaTexture = device.createTexture({
            format: this.format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            size: [this.outputTexture.width, this.outputTexture.height],
            sampleCount: MULTISAMPLE,
        });

        this.render(device);
    }

    createTextGeometry(scroll = 0) {
        this.scroll += scroll;
        this.scroll = Math.max(0, this.scroll);

        // GEOMETRY
        const atlasHeight = 64;
        const scale = this.fontSize / atlasHeight;
        const margin = 32;

        // recall uv [0, 0] is bottom left corner
        let xPos = -this.outputTexture.width + margin;  // [-1, 1] x coord and x increases
        let yPos = this.outputTexture.height - this.fontSize - margin + this.scroll;  // top (with space for glyph) and y decreases
        const letterQuads = [];

        // TODO assumes target face is square
        // TODO font scales with face
        const words = this.text.split(" ");
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
                }
            }
        }
        this.vertices = Float32Array.from(letterQuads);
    }

    render(device) {
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