import { mat4, vec3 } from "gl-matrix";
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


// COLLIDERS
class ColliderComponent {
    constructor(verts, href=null, ghost=false, velocity=[0, 0, 0]) {
        this.verts = verts;
        this.href = href;
        this.ghost = ghost;
        this.velocity = velocity;  // TODO why?
    }

    translate(vector) {
        for (const i in verts) {
            verts[i][0] += vector[0];
            verts[i][1] += vector[1];
            verts[i][2] += vector[2];
        }
    }

    copy() {
        throw new Error("Copy behaviour must be implemented by subclasses of ColliderComponent");
    }

    setProperties(href=null, ghost=false, velocity=[0, 0, 0]) {
        this.href = href;
        this.ghost = ghost;
        this.velocity = velocity;
    }

    static checkCollision(other) {
        throw new Error("checkCollision must be implemented by subclasses of ColliderComponent");
    }
}

export class AABBComponent extends ColliderComponent {
    constructor(min, max, href, ghost, velocity, debug=false) {
        super([min, max], href, ghost, velocity);
        this.min = min;
        this.max = max;
    }

    copy() {
        return new AABBComponent(this.min, this.max, this.hred, this.ghost, this.velocity, this.debug);
    }

    // TODO no rotation
    modelTransform(model) {
        this.min = [0, 0, 0];
        this.max = [0, 0, 0];
        vec3.transformMat4(this.min, this.verts[0], model);
        vec3.transformMat4(this.max, this.verts[1], model);
    }

    translate(vector) {
        this.min[0] += vector[0];
        this.min[1] += vector[1];
        this.min[2] += vector[2];
        this.max[0] += vector[0];
        this.max[1] += vector[1];
        this.max[2] += vector[2];
    }
    
    toVertices() {
        const vertices = new Float32Array(72);
        let vIndex = 0;
        // face 1
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.min[2];
        // face 2
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.min[2];
        // connectors
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.min[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.min[2];
        vertices[vIndex++] = this.min[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.max[2];
        vertices[vIndex++] = this.max[0]; vertices[vIndex++] = this.max[1]; vertices[vIndex++] = this.max[2];
        return vertices;
    }

    static createMesh(data, properties) {
        const xIndex = properties.indexOf("x");
        const yIndex = properties.indexOf("y");
        const zIndex = properties.indexOf("z");
    
        const aabb = {
            min: [Infinity, Infinity, Infinity],
            max: [-Infinity, -Infinity, -Infinity],
        };
        for (const i in data) {
            if (i % properties.length === xIndex) {
                if (data[i] < aabb.min[0]) { aabb.min[0] = data[i]; }
                if (data[i] > aabb.max[0]) { aabb.max[0] = data[i]; }
            }
            if (i % properties.length === yIndex) {
                if (data[i] < aabb.min[1]) { aabb.min[1] = data[i]; }
                if (data[i] > aabb.max[1]) { aabb.max[1] = data[i]; }
            }
            if (i % properties.length === zIndex) {
                if (data[i] < aabb.min[2]) { aabb.min[2] = data[i]; }
                if (data[i] > aabb.max[2]) { aabb.max[2] = data[i]; }
            }
        }
        return aabb;
    }

    checkCollision(other) {
        if (!other) { return false; }  // TODO why does this happen
        if (this.ghost || other.ghost) { return false; }
        if (other instanceof AABBComponent) {
            return (
                this.min[0] <= other.max[0] && this.max[0] >= other.min[0] &&
                this.min[1] <= other.max[1] && this.max[1] >= other.min[1] &&
                this.min[2] <= other.max[2] && this.max[2] >= other.min[2]
            );
        }
    }
}