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

// TODO this sucks!
export function createBindGroupLayout(device, label, ...entries) {
    const BGLDescriptor = {
        label: label,
        entries: []
    }
    let binding = 0;
    for (const entry of entries) {
        if (entry === "MVP") {
            BGLDescriptor.entries.push({
                binding: binding++,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: "uniform" },
            });
            BGLDescriptor.entries.push({
                binding: binding++,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: "uniform" },
            });
            BGLDescriptor.entries.push({
                binding: binding++,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: "uniform" },
            });
        }
        else if (entry === "texture") {
            BGLDescriptor.entries.push({
                binding: binding++,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { sampleType: "float" },
            });
        }
        else if (entry === "sampler") {
            BGLDescriptor.entries.push({
                binding: binding++,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: { type: "filtering" },
            });
        }
        else {
            entry.binding = binding++;
            BGLDescriptor.entries.push(entry);
        }
    }
    return device.createBindGroupLayout(BGLDescriptor);
}

export function createBindGroup(device, label, layout, ...resources) {
    const bgDescriptor = {
        label: label,
        layout: layout,
        entries: [],
    };
    let binding = 0;
    for (const resource of resources) {
        bgDescriptor.entries.push({
            binding: binding,
            resource: resource,
        });
        binding++;
    }
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