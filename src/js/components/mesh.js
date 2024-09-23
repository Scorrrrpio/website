import { createBindGroup, createPipeline, createVBAttributes } from "../wgpuHelpers";

export class MeshComponent {
    constructor(device, vertices, vb, vertexCount, modelBuffer, bindGroup, pipeline) {
        this.device = device;
        this.vertices = vertices;
        this.vertexBuffer = vb;
        this.vertexCount = vertexCount;
        this.modelBuffer = modelBuffer;
        this.bindGroup = bindGroup;
        this.pipeline = pipeline;
    }

    static async assetToMesh(data, mesh, vertPromise, fragPromise, texturePromise, device, format, bindGroupLayout, viewBuffer, projectionBuffer, cullMode, topology, multisamples, debug=false) {
        // MODEL BUFFER
        const modelBuffer = device.createBuffer({
            label: "Model Uniform Buffer",
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        
        
        // VERTEX BUFFER
        // TODO change ply reader AGAIN
        const floats = mesh.vertex.values.float32;
        const vCount = floats.data.length / floats.properties.length;  // VERTEX COUNT
        const vProps = floats.properties.length;
        
        const vbAttributes = createVBAttributes(floats.properties);  // vertex buffer atrributes array
        //console.log("VB ATTRIBUTES\n", vbAttributes);  // TODO grouping

        const vb = device.createBuffer({
            label: data.file,
            size: floats.data.byteLength,  // TODO precompute while loading ply
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });


        // BIND GROUP
        let bindGroup;  // depends on texture

        // TEXTURE
        if (data.texture) {
            // create texture sampler
            const sampler = device.createSampler({
                magFilter: "linear",
                minFilter: "linear",
            });

            // create list of faces to texture
            const faceIDs = new Uint32Array([
                data.texture.faces?.includes("front") ? 1 : 0, 0, 0, 0,
                data.texture.faces?.includes("back") ? 1 : 0, 0, 0, 0,
                data.texture.faces?.includes("left") ? 1 : 0, 0, 0, 0,
                data.texture.faces?.includes("right") ? 1 : 0, 0, 0, 0,
                data.texture.faces?.includes("top") ? 1 : 0, 0, 0, 0,
                data.texture.faces?.includes("bottom") ? 1 : 0, 0, 0, 0,
            ]);
            // store in uniform buffer
            const faceIDsBuffer = device.createBuffer({
                label: "Texture Faces Buffer",
                size: faceIDs.byteLength,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
            device.queue.writeBuffer(faceIDsBuffer, 0, faceIDs);

            // OVERRIDE BIND GROUP
            bindGroup = createBindGroup(
                device, "OVERRIDE Bind Group", bindGroupLayout,
                {buffer: modelBuffer}, {buffer: viewBuffer}, {buffer: projectionBuffer},  // MVP
                (await texturePromise).createView(), sampler, {buffer: faceIDsBuffer}  // texture
            );
        }
        else {
            bindGroup = createBindGroup(
                device, "Base Bind Group", bindGroupLayout,
                {buffer: modelBuffer}, {buffer: viewBuffer}, {buffer: projectionBuffer}  // MVP
            );
        }

        // PIPELINE
        const pipeline = createPipeline(
            "FPV Render Pipeline",
            device,
            bindGroupLayout,
            await vertPromise,
            vProps,
            vbAttributes,
            await fragPromise,
            format,
            topology,
            cullMode,
            true,
            multisamples
        );


        // TODO debug geometry
        const meshComponent = new MeshComponent(device, floats, vb, vCount, modelBuffer, bindGroup, pipeline);
        meshComponent.writeVertexBuffer();
        return meshComponent;
    }

    writeVertexBuffer() {
        this.device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices.data);
    }
}