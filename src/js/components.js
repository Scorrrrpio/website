import { mat4 } from "gl-matrix";
import { createBindGroup, createBindGroupLayout, createPipeline, createVBAttributes } from "./wgpuHelpers";
import { textureTriangle } from "./textureTriangle";
import { textToTexture } from "./renderText";

export class TransformComponent {
    constructor(position=[0, 0, 0], rotation=[0, 0, 0], scale=[1, 1, 1], animation) {
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
        this.createModelMatrix();
        this.animation = animation;  // TODO bad solution
    }

    createModelMatrix() {
        const model = mat4.create();
        mat4.translate(model, model, this.position);
        mat4.rotateX(model, model, this.rotation[0]);
        mat4.rotateY(model, model, this.rotation[1]);
        mat4.rotateZ(model, model, this.rotation[2]);
        mat4.scale(model, model, this.scale);
        this.model = model;
    }
}

export class MeshComponent {
    constructor(vb, vertexCount, modelBuffer, bindGroup, pipeline) {
        this.vertexBuffer = vb;
        this.vertexCount = vertexCount;
        this.modelBuffer = modelBuffer;
        this.bindGroup = bindGroup;
        this.pipeline = pipeline;
    }

    // TODO don't require assetManager
    static async assetToMesh(data, mesh, baseVert, baseFrag, assetManager, device, format, viewBuffer, projectionBuffer, topology, multisamples, debug=false) {
        // VERTEX BUFFER
        // TODO change ply reader AGAIN
        const floats = mesh.vertex.values.float32;
        const vCount = floats.data.length / floats.properties.length;
        const vProps = floats.properties.length;

        // vertex buffer atrributes array
        const vbAttributes = createVBAttributes(floats.properties);
        //console.log("VB ATTRIBUTES\n", vbAttributes);  // TODO grouping

        const vb = device.createBuffer({
            label: data.file,
            size: floats.data.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(vb, 0, floats.data);


        // MODEL BUFFER
        const modelBuffer = device.createBuffer({
            label: "Model Uniform Buffer",
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        // BIND GROUP and LAYOUT
        let bindGroupLayout = createBindGroupLayout(device, "Default Bind Group Layout", "MVP");
        let bindGroup = createBindGroup(
            device, "Base Bind Group", bindGroupLayout,
            {buffer: modelBuffer}, {buffer: viewBuffer}, {buffer: projectionBuffer}  // MVP
        );


        // using data
        // OVERRIDE SHADERS
        let vertexShaderModule = baseVert;
        let fragmentShaderModule = baseFrag;
        if (data.vertexShader && data.fragmentShader) {
            [vertexShaderModule, fragmentShaderModule] = await Promise.all([
                assetManager.get(data.vertexShader, debug),
                assetManager.get(data.fragmentShader, debug),
            ]);
        }

        // OVERRIDE CULL MODE
        const cullMode = data.cullMode ? data.cullMode : "back";

        // TEXTURE
        if (data.texture) {
            let texture;
            if (data.texture.url) {
                // image texture
                const imgBmp = await assetManager.get(data.texture.url, debug);
                // create texture on device
                texture = device.createTexture({
                    label: "Image Texture",
                    size: [imgBmp.width, imgBmp.height, 1],
                    format: format,
                    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
                });
                device.queue.copyExternalImageToTexture(
                    { source: imgBmp },
                    { texture: texture },
                    [imgBmp.width, imgBmp.height, 1],
                );
            }
            else if (data.texture.program) {
                // program texture
                const textureSize = [512, 512];
                texture = device.createTexture({
                    label: "Program Texture",
                    size: textureSize,
                    format: format,
                    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
                });
                if (data.texture.program === "helloTriangle") {
                    textureTriangle(texture, device, format);
                }
                else if (data.texture.program === "text") {
                    textToTexture(texture, device, format, data.texture.content);
                }
            }

            // create texture sampler
            const sampler = device.createSampler({
                magFilter: "linear",
                minFilter: "linear",
            });

            // create list of faces to texture
            const faceIDs = new Uint32Array([
                data.texture.faces.includes("front") ? 1 : 0, 0, 0, 0,
                data.texture.faces.includes("back") ? 1 : 0, 0, 0, 0,
                data.texture.faces.includes("left") ? 1 : 0, 0, 0, 0,
                data.texture.faces.includes("right") ? 1 : 0, 0, 0, 0,
                data.texture.faces.includes("top") ? 1 : 0, 0, 0, 0,
                data.texture.faces.includes("bottom") ? 1 : 0, 0, 0, 0,
            ]);
            // store in uniform buffer
            const faceIDsBuffer = device.createBuffer({
                label: "Texture Faces Buffer",
                size: faceIDs.byteLength,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
            device.queue.writeBuffer(faceIDsBuffer, 0, faceIDs);

            // OVERRIDE BIND GROUP
            bindGroupLayout = createBindGroupLayout(
                device, "Texture Bind Group Layout",
                "MVP", "texture", "sampler", {visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform"}}
            );
            bindGroup = createBindGroup(
                device, "OVERRIDE Bind Group", bindGroupLayout,
                {buffer: modelBuffer}, {buffer: viewBuffer}, {buffer: projectionBuffer},  // MVP
                texture.createView(), sampler, {buffer: faceIDsBuffer}  // texture
            );
        }

        // Pipeline
        const pipeline = createPipeline(
            "FPV Render Pipeline",
            device,
            bindGroupLayout,
            vertexShaderModule,
            vProps,
            vbAttributes,
            fragmentShaderModule,
            format,
            topology,
            cullMode,
            true,
            multisamples
        );


        // TODO debug geometry
        return new MeshComponent(vb, vCount, modelBuffer, bindGroup, pipeline);  // TODO
    }
}


class ColliderComponent {
    constructor() {}
}

class AABBComponent extends ColliderComponent {
    constructor() {
        super();
    }
}