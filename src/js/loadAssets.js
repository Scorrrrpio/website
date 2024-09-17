import { AssetLoadError } from "./errors";
import { textureTriangle } from "./textureTriangle";
import { plyToTriangleList } from "./plyReader";
import { textToTexture } from "./renderText";
import { createBindGroup, createBindGroupLayout, createPipeline, createShaderModule, createVBAttributes } from "./wgpuHelpers";
import { AABB, SphereMesh } from "./collision";
import { Entity } from "./entity";

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

async function fetchSceneFile(url) {
    // Scene assets as JSON
    const assetsResponse = await fetch(url);
    if (!assetsResponse.ok) { throw new AssetLoadError("Failed to fetch scene from " + url); }
    return assetsResponse.json();
}

// TODO logic belongs in Scene class
export async function loadScene(sceneURL, cache, device, viewBuffer, projectionBuffer, format, topology, multisamples, debug=false) {
    const assets = await fetchSceneFile(sceneURL);  // TODO too much in one function

    // BIND GROUP LAYOUT
    const baseBindGroupLayout = createBindGroupLayout(device, "Default Bind Group Layout", "MVP");

    // TODO proof of concept implementation
    async function fetchOnce(url, fetcher) {
        if (cache.has(url)) {
            return cache.get(url);
        }
        if (debug) console.log("FETCH: " + url);
        const data = await fetcher;
        cache.set(url, data);
        return data;
    }

    // RENDERABLES
    const renderables = [];
    // TODO break into functions
    for (const asset of assets.objects) {  // each object in scene
        // ASSET FAMILY DEFAULT VALUES
        const [data, baseVertexShaderModule, baseFragmentShaderModule] = await Promise.all([
            fetchOnce(asset.file, plyToTriangleList(asset.file)),
            fetchOnce(asset.vertexShader, createShaderModule(device, asset.vertexShader, "Base Vertex Shader")),  // shaders from wgsl files
            fetchOnce(asset.fragmentShader, createShaderModule(device, asset.fragmentShader, "Base Fragment Shader"))
        ]);

        // TODO change ply reader AGAIN
        const floats = data.vertex.values.float32;
        
        // collision mesh based on geometry
        const meshGenerators = {
            aabb: AABB.createMesh,
            sphere: SphereMesh.createMesh,  // TODO other types (sphere, mesh)
        }
        const baseMesh = meshGenerators[asset.collision]?.(floats.data, floats.properties);

        // vertex buffer atrributes array
        const vbAttributes = createVBAttributes(floats.properties);
        //console.log("VB ATTRIBUTES\n", vbAttributes);  // TODO grouping

        // VERTEX BUFFER
        const vb = device.createBuffer({
            label: asset.file,
            size: floats.data.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(vb, 0, floats.data);

        // INSTANCE-SPECIFIC VALUES
        for (const instance of asset.instances) {
            // MODEL BUFFER
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

            // COLLIDER
            let collider;
            if (asset.collision === "aabb") {
                collider = new AABB(baseMesh.min, baseMesh.max, instance.href, instance.ghost, instance.v);
            }

            // OVERRIDE SHADERS
            let vertexShaderModule = baseVertexShaderModule;
            let fragmentShaderModule = baseFragmentShaderModule;
            if (instance.vertexShader && instance.fragmentShader) {
                [vertexShaderModule, fragmentShaderModule] = await Promise.all([
                    fetchOnce(instance.vertexShader, createShaderModule(device, instance.vertexShader, "Vertex Shader Override")),
                    fetchOnce(instance.fragmentShader, createShaderModule(device, instance.fragmentShader, "Fragment Shader Override"))
                ]);
            }

            // OVERRIDE CULL MODE
            const cullMode = instance.cullMode ? instance.cullMode : "back";

            // TEXTURE
            if (instance.texture) {
                let texture;
                if (instance.texture.url) {
                    // image texture
                    const imgBmp = await fetchOnce(instance.texture.url, loadImageToBMP(instance.texture.url));
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

            // create Entity
            const entity = new Entity(
                renderables.length,  // ID
                vb,  // vertex buffer
                floats.data.length / floats.properties.length,  // vertex count
                modelBuffer,
                bindGroup,
                createPipeline(
                    "FPV Render Pipeline",
                    device,
                    bindGroupLayout,
                    vertexShaderModule,
                    floats.properties.length,
                    vbAttributes,
                    fragmentShaderModule,
                    format,
                    topology,
                    cullMode,
                    true,
                    multisamples
                ),
                collider,
                animation,
                {  // transforms
                    position: instance.p || [0, 0, 0],
                    rotation: instance.r || [0, 0, 0],
                    scale: instance.s || [1, 1, 1],
                }
            );

            // add to renderables list
            renderables.push(entity);
        }
    }

    // create debug geometry
    if (debug) {
        createDebugGeometry(renderables, device, format, viewBuffer, projectionBuffer, multisamples);
    }

    return renderables;
}

async function createDebugGeometry(renderables, device, format, viewBuffer, projectionBuffer, multisamples) {
    // SHADERS
    const debugVShader = await createShaderModule(device, "shaders/basic.vert.wgsl", "DEBUG Vertex Module");
    const debugFShader = await createShaderModule(device, "shaders/debug.frag.wgsl", "DEBUG Fragment Module");

    // BGL
    const debugBGL = createBindGroupLayout(device, "DEBUG BGL", "MVP");

    for (const renderable of renderables) {
        if (renderable.collider && !renderable.collider.ghost) {
            // generate geometry (line-list)
            const vertexCount = 24;  // 12 edges, 2 vertices each
            const vertices = renderable.collider.toVertices();
            
            // VERTEX BUFFER
            const vb = device.createBuffer({
                label: "DEBUG VB",
                size: vertices.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
            device.queue.writeBuffer(vb, 0, vertices);
            const vbAttributes = createVBAttributes(["x", "y", "z"]);

            // BIND GROUP
            const bg = createBindGroup(device, "DEBUG Bind Group", debugBGL, {buffer: renderable.modelBuffer}, {buffer: viewBuffer}, {buffer: projectionBuffer});

            // PIPELINE
            const pipeline = createPipeline(
                "DEBUG Pipeline",
                device,
                debugBGL,
                debugVShader,
                3,
                vbAttributes,
                debugFShader,
                format,
                "line-list",
                "none",
                true,
                multisamples
            );

            // add debug utilities to renderable object
            renderable.debugVertexCount = vertexCount;
            renderable.debugVB = vb;
            renderable.debugBG = bg;
            renderable.debugPipeline = pipeline;
        }
    }
}