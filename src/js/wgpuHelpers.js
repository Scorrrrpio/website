export function createPipeline(label, device, bindGroupLayout, vertexShaderModule, vbStrideBytes, vertexBufferAttributes, fragmentShaderModule, format, topology, cullMode, depthTest, multisamples) {
    const pipelineDescriptor = {
		label: label,
		layout: bindGroupLayout === "auto" ? "auto" : device.createPipelineLayout({
            label: label + " Layout",
            bindGroupLayouts: [bindGroupLayout],
        }),
		vertex: {
			module: vertexShaderModule,
			entryPoint: "vertexMain",
			buffers: [{
				arrayStride: 4 * vbStrideBytes /*bytes*/,
				attributes: vertexBufferAttributes,
			}],
		},
		fragment: {
			module: fragmentShaderModule,
			entryPoint: "fragmentMain",
			targets: [{
				format: format,
                blend: {
                    color: {
                        srcFactor: "src-alpha",
                        dstFactor: "one-minus-src-alpha",
                        operation: "add",
                    },
                    alpha: {
                        srcFactor: "one",
                        dstFactor: "one-minus-src-alpha",
                        operation: "add",
                    },
                },
                writeMask: GPUColorWrite.ALL,
			}],
		},
		primitive: {
            topology: topology,
            frontFace: "ccw",
            cullMode: cullMode,
        },
	};
    if (multisamples) {
        pipelineDescriptor.multisample = { count: multisamples };
    }
    if (depthTest) {
        pipelineDescriptor.depthStencil = {
            format: "depth24plus",
            depthWriteEnabled: cullMode === "back",
            depthCompare: "less",
        };
    }
    return device.createRenderPipeline(pipelineDescriptor);
}

export function createBindGroupLayout(device, label, resources=[]) {  // resources format: { type, visibility }
    function createBindGroupLayoutEntry(binding, resource) {
        const entry = {
            binding: binding,
            visibility: resource.visibility,
        };
    
        switch (resource.type) {
            case "buffer":
                entry.buffer = {
                    type: "uniform",  // storage, read-only-storage
                };
                break;
            case "texture":
                entry.texture = {
                    multisampled: false,
                    sampleType: "float",  // depth, sint, uint, unfilterable-float
                    //viewDimension
                };
                break;
            case "sampler":
                entry.sampler = {
                    type: "filtering",  // comparision, non-filtering
                };
                break;
            case "externalTexture":
                entry.externalTexture = {};
            break;
            case "storageTexture":
                entry.storageTexture = {
                    access: undefined,  // write-only
                    format: "rgba8unorm",  // or another texture format
                    viewDimension: "2d",  // 1d, 2d-array, cube, cube-array, 3d
                };
                console.warn("storageTexture Bind Group Layout handling is untested");
                break;
            default:
                throw new Error(`Invalid Bind Group Layout entry type: ${resource.type}`);
        }
    
        return entry;
    }

    const BglDescriptor = {
        label: label,
        entries: []
    }
    let binding = 0;

    resources.forEach(resource => BglDescriptor.entries.push(createBindGroupLayoutEntry(binding++, resource)));

    return device.createBindGroupLayout(BglDescriptor);
}

export function createBindGroup(device, label, layout, resources=[]) {
    const bgDescriptor = {
        label: label,
        layout: layout,
        entries: [],
    };
    let binding = 0;

    resources.forEach(resource => bgDescriptor.entries.push({
        binding: binding++,
        resource: resource,
    }));

    return device.createBindGroup(bgDescriptor);
}

// TODO group properties in input
export function createVBAttributes(properties) {
    const attributes = [];
    let offset = 0;
    let shaderLocation = 0;
    // TODO upgrade this alongside .ply reader (e.g. different types)
    // int -> sint
    for (let i = 0; i < properties.length; i++) {
        const attribute = {};
        if (i < properties.length - 2 && properties[i] === "x" && properties[i+1] === "y" && properties[i+2] === "z") {
            // xyz
            attribute.label = "xyz";
            attribute.format = "float32x3";
            attribute.offset = 4 * offset;
            attribute.shaderLocation = shaderLocation;
            offset += 3;
            i += 2;
        }
        else if (i < properties.length - 1 && properties[i] === "x" && properties[i+1] === "y") {
            // xy (used for HUD)
            attribute.label = "xy";
            attribute.format = "float32x2";
            attribute.offset = 4 * offset;
            attribute.shaderLocation = shaderLocation;
            offset += 2;
            i ++;
        }
        else if (i < properties.length - 3 && properties[i] === "r" && properties[i+1] === "g" && properties[i+2] === "b" && properties[i+3] === "a") {
            // rgba
            attribute.label = "rgba";
            attribute.format = "float32x4";
            attribute.offset = 4 * offset;
            attribute.shaderLocation = shaderLocation;
            offset += 4;
            i += 3;
        }
        else if (i < properties.length - 1 && ((properties[i] === "s" && properties[i+1] === "t") || (properties[i] === "u" && properties[i+1] === "v"))) {
            // st
            attribute.label = "uv";
            attribute.format = "float32x2";
            attribute.offset = 4 * offset;
            attribute.shaderLocation = shaderLocation;
            offset += 2;
            i++;
        }
        else if (i < properties.length - 2 && properties[i] === "nx" && properties[i+1] === "ny" && properties[i+2] === "nz") {
            // vertex normals
            attribute.label = "nxnynz";
            attribute.format = "float32x3";
            attribute.offset = 4 * offset;
            attribute.shaderLocation = shaderLocation;
            offset += 3;
            i += 2;
        }
        else {
            attribute.label = properties[i];
            attribute.format = "float32";
            attribute.offset = 4 * offset;
            attribute.shaderLocation = shaderLocation;
            offset++;
        }
        attributes.push(attribute);
        shaderLocation++;
    }
    return attributes;
}