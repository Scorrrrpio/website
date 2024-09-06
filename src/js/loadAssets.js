import { AssetLoadError } from "./errors";
import { textureTriangle } from "./textureTriangle";
import { plyToTriangleList } from "./plyReader";
import { mat4 } from "gl-matrix";
import { textToTexture } from "./renderText";
import { createBindGroup, createBindGroupLayout, createPipeline, createShaderModule, createVBAttributes } from "./wgpuHelpers";
import { AABB, vertsToAABB, transformCollisionMesh } from "./collision";

// TODO move functions to physics.js

export function createModelMatrix(position, rotation, scale) {
    const model = mat4.create();
    mat4.translate(model, model, position);
    mat4.rotateX(model, model, rotation[0]);
    mat4.rotateY(model, model, rotation[1]);
    mat4.rotateZ(model, model, rotation[2]);
    mat4.scale(model, model, scale);
    return model;
}

async function loadImageToBMP(url) {
    // read image from texture url
    const img = new Image();
    img.src = url;
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
    return await createImageBitmap(img);
}

export async function loadAssets(assets, device, viewBuffer, projectionBuffer, format, topology, multisamples) {
    // BIND GROUP LAYOUT
    const baseBindGroupLayout = createBindGroupLayout(device, "Default Bind Group Layout", "MVP");

    // RENDERABLES
    const renderables = [];
    for (const asset of assets.objects) {  // each object in scene
        // ASSET FAMILY DEFAULT VALUES
        // vertices from ply file
        const data = await plyToTriangleList(asset.file);
        // shaders from wgsl files
        const baseVertexShaderModule = await createShaderModule(device, asset.vertexShader, "Base Vertex Shader");
        const baseFragmentShaderModule = await createShaderModule(device, asset.fragmentShader, "Base Fragment Shader");
        
        // collision mesh based on geometry
        let baseMesh;
        if (asset.collision === "aabb") {
            baseMesh = vertsToAABB(data);
            // TODO other types (sphere, mesh)
            // sphere should be easy: radius to furthest point
        }


        // INSTANCE-SPECIFIC VALUES
        for (const instance of asset.instances) {
            // VERTEX BUFFER
            const vb = device.createBuffer({
                label: asset.file,
                size: data.floats.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
            device.queue.writeBuffer(vb, 0, data.floats);
            // create vertex buffer atrributes array
            const vbAttributes = createVBAttributes(data.properties);

            // MODEL MATRIX
            const model = createModelMatrix(instance.p, instance.r, instance.s);
            const modelBuffer = device.createBuffer({
                label: "Model Uniform " + renderables.length,
                size: 64,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });

            // BIND GROUP
            let bindGroupLayout = baseBindGroupLayout;
            let bindGroup = createBindGroup(
                device, "Base Bind Group " + renderables.length, bindGroupLayout,
                {buffer: modelBuffer}, {buffer: viewBuffer}, {buffer: projectionBuffer}  // MVP
            );

            // TRANSFORM COLLISION MESH
            const velocity = instance.v ? instance.v : [0, 0, 0];
            //const collisionMesh = transformCollisionMesh(baseMesh, model, velocity, instance.href, instance.ghost);
            let collisionMesh;
            if (asset.collision === "aabb") {
                collisionMesh = new AABB(baseMesh.min, baseMesh.max, instance.href, instance.ghost, instance.v);
                collisionMesh.modelTransform(model);
            }

            // OVERRIDE SHADERS
            let vertexShaderModule = baseVertexShaderModule;
            let fragmentShaderModule = baseFragmentShaderModule;
            if (instance.vertexShader && instance.fragmentShader) {
                vertexShaderModule = await createShaderModule(device, instance.vertexShader, "Vertex Shader Override");
                fragmentShaderModule = await createShaderModule(device, instance.fragmentShader, "Fragment Shader Override");
            }

            // OVERRIDE CULL MODE
            const cullMode = instance.cullMode ? instance.cullMode : "back";

            // TEXTURE
            if (instance.texture) {
                // TODO I don't understand textures well enough to compress this code
                let texture;
                if (instance.texture.url) {
                    // image texture
                    const imgBmp = await loadImageToBMP(instance.texture.url);
                    // create texture on device
                    texture = device.createTexture({
                        label: "Instance Texture",
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
                else if (instance.texture.program) {
                    // program texture
                    const textureSize = [512, 512];
                    texture = device.createTexture({
                        label: "Program Texture",
                        size: textureSize,
                        format: format,
                        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
                    });
                    if (instance.texture.program === "helloTriangle") {
                        textureTriangle(texture, device, format);
                    }
                    else if (instance.texture.program === "text") {
                        textToTexture(texture, device, format, instance.texture.content);
                    }
                }

                // create texture sampler
                const sampler = device.createSampler({
                    magFilter: "linear",
                    minFilter: "linear",
                });

                // create list of faces to texture
                const faceIDs = new Uint32Array([
                    instance.texture.faces.includes("front") ? 1 : 0, 0, 0, 0,
                    instance.texture.faces.includes("back") ? 1 : 0, 0, 0, 0,
                    instance.texture.faces.includes("left") ? 1 : 0, 0, 0, 0,
                    instance.texture.faces.includes("right") ? 1 : 0, 0, 0, 0,
                    instance.texture.faces.includes("top") ? 1 : 0, 0, 0, 0,
                    instance.texture.faces.includes("bottom") ? 1 : 0, 0, 0, 0,
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

            // ANIMATION
            const animation = instance.animation;

            // add to renderables list
            renderables.push({
                id: renderables.length,
                vertexBuffer: vb,
                vertexCount: data.floats.length / data.properties.length,
                model: model,
                modelBuffer: modelBuffer,
                bindGroup: bindGroup,
                pipeline: createPipeline(
                    "FPV Render Pipeline",
                    device,
                    bindGroupLayout,
                    vertexShaderModule,
                    data.properties.length,
                    vbAttributes,
                    fragmentShaderModule,
                    format,
                    topology,
                    cullMode,
                    true,
                    multisamples
                ),
                baseMesh: baseMesh,
                collisionMesh: collisionMesh,
                animation: animation,
                transforms: {
                    position: instance.p,
                    rotation: instance.r,
                    scale: instance.s,
                },
            });
        }
    }

    return renderables;
}