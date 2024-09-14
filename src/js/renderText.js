import { AssetLoadError } from "./errors";
import { createBindGroup, createBindGroupLayout, createPipeline, createShaderModule, createVBAttributes } from "./wgpuHelpers";

export async function textToTexture(outputTexture, device, format, text) {
    // CONSTANTS
    // TODO as parameters
    const atlasUrl = "media/text/hackAtlas64.png";
    const metadataUrl = "media/text/hackMetadata64.json";
    const fontSize = 48;
    const MULTISAMPLE = 4;

    // load glyph atlas png
    const img = new Image();
    img.src = atlasUrl;
    try {
        await img.decode();
    }
    catch (error) {
        if (error.name === "EncodingError") {
            throw new AssetLoadError("Failed to load image: " + url);
        }
        else { throw error; }
    };
    // convert to bmp
    const atlasBMP = await createImageBitmap(img);

    const response = await fetch(metadataUrl);
    if (!response.ok) { throw new AssetLoadError("Failed to load Glyph Atlas Metadata"); }
    const metadata = await response.json();


    // GLYPH ATLAS TEXTURE
    const texture = device.createTexture({
        label: "Instance Texture",
        size: [atlasBMP.width, atlasBMP.height, 1],
        format: format,
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    device.queue.copyExternalImageToTexture(
        { source: atlasBMP },
        { texture: texture },
        [atlasBMP.width, atlasBMP.height]
    );

    // create texture sampler
    const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
    });


    // SHADERS
    const vertexModule = await createShaderModule(device, "shaders/text.vert.wgsl", "Text Vertex");
    const fragmentModule = await createShaderModule(device, "shaders/text.frag.wgsl", "Text Fragment");

    // GEOMETRY
    const atlasHeight = 64;
    const scale = fontSize / atlasHeight;
    const margin = 32;

    // recall uv [0, 0] is bottom left corner
    let xPos = -outputTexture.width + margin;  // [-1, 1] x coord and x increases
    let yPos = outputTexture.height - fontSize - margin;  // top (with space for glyph) and y decreases
    const letterQuads = [];

    const words = text.split(" ");
    for (let word of words) {
        let wordLength = 0;
        for (const ch of word) {
            if (ch != "\n") { wordLength += metadata[ch].advance * scale; }
            else break;
        }
        if (xPos + wordLength > outputTexture.width) {
            xPos = -outputTexture.width + margin;
            yPos -= fontSize;
        }
        word += " ";
        for (const ch of word) {
            if (yPos - fontSize < -outputTexture.height - fontSize + margin) { break; }
            if (ch === "\n") {
                xPos = -outputTexture.width + margin;
                yPos -= fontSize;
            }
            else {
                let x0 = (xPos + metadata[ch].x * scale) / outputTexture.width;
                let y1 = (yPos + metadata[ch].y * scale) / outputTexture.height;
                let x1 = (xPos + (metadata[ch].x + metadata[ch].width) * scale) / outputTexture.width;
                let y0 = (yPos + (metadata[ch].y - metadata[ch].height) * scale) / outputTexture.height;
                // TODO desperately needs a function
                letterQuads.push(
                    // TOP LEFT
                    x0, y1, metadata[ch].u0, metadata[ch].v0,
                    // BOTTOM LEFT
                    x0, y0, metadata[ch].u0, metadata[ch].v1,
                    // TOP RIGHT
                    x1, y1, metadata[ch].u1, metadata[ch].v0,
                    // BOTTOM RIGHT
                    x1, y0, metadata[ch].u1, metadata[ch].v1,
                    // TOP RIGHT
                    x1, y1, metadata[ch].u1, metadata[ch].v0,
                    // BOTTOM LEFT
                    x0, y0, metadata[ch].u0, metadata[ch].v1,
                );
                xPos += (metadata[ch].advance) * scale;
            }
        }
    }
    const vertices = Float32Array.from(letterQuads);

    // create vertex buffer
	const vertexBuffer = device.createBuffer({
		label: "Text Geometry",
		size: vertices.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
	});
	device.queue.writeBuffer(vertexBuffer, 0, vertices);


    // BIND GROUP and LAYOUT
    const BGL = createBindGroupLayout(device, "Text BGL", "texture", "sampler");
    const BG = createBindGroup(device, "Text Bind Group", BGL, texture.createView(), sampler);


    // PIPELINE
    const vbAttributes = createVBAttributes(["x", "y", "u", "v"]);
    const pipeline = createPipeline("Text Render Pipeline", device, BGL, vertexModule, 4, vbAttributes, fragmentModule, format, "triangle-list", "none", false, MULTISAMPLE);

    // 4xMSAA TEXTURES
    let msaaTexture = device.createTexture({
        format: format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        size: [outputTexture.width, outputTexture.height],
        sampleCount: MULTISAMPLE,
    });


    // RENDER
    function drawText() {
        // create GPUCommandEncoder
		const encoder = device.createCommandEncoder();

        // begin render pass
		const pass = encoder.beginRenderPass({
			colorAttachments: [{
                view: msaaTexture.createView(),  // render to MSAA texture
				loadOp: "clear",
				clearValue: { r: 0, g: 0, b: 0, a: 1 },
				storeOp: "store",
                resolveTarget: outputTexture.createView(),  // multisample down to output
			}],
		});

		// render triangle
		pass.setPipeline(pipeline);
        pass.setBindGroup(0, BG);
		pass.setVertexBuffer(0, vertexBuffer);
		pass.draw(vertices.length / 4);

		// end render pass
		pass.end();

		// create and submit GPUCommandBuffer
		device.queue.submit([encoder.finish()]);
    }

    drawText();
}