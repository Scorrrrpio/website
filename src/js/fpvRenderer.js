// imports
import { mat4 } from "gl-matrix";
import { wgpuSetup } from "./wgpuSetup";
import { plyToTriangleList } from "./plyReader";

// inspired by the sphere graphic from lokinet.org
export async function fpv(canvasID, autoplay, allowControl) {
    // WEBGPU SETUP
	const canvas = document.getElementById(canvasID);
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;

    const { adapter, device, context, format } = await wgpuSetup(canvas);


    // GEOMETRY
    const TOPOLOGY = "triangle-list";
    const g1 = await plyToTriangleList("geometry/pyramid.ply");
    const g2 = await plyToTriangleList("geometry/lokiSphere.ply");
    const geometry = [];
    geometry.push(g1);
    geometry.push(g2);

    const vertexBuffers = [];
    for (const geo of geometry) {
        // create vertex buffer
        const vb = device.createBuffer({
            label: geo.source,
            size: geo.vertFloats.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        })
        // copy vertex data into vertex buffer
        device.queue.writeBuffer(vb, 0, geo.vertFloats);
        // add to vertex buffer list
        vertexBuffers.push({
            buffer: vb,
            vertexCount: geo.topologyVerts,
        });
    }


    // SHADERS
	// vertex shader
	const vertexShaderCode = `
        struct VertexOutput {
            @location(0) barycentric: vec3f,
            @builtin(position) position: vec4f
        };

        @group(0) @binding(0) var<uniform> mvp: mat4x4<f32>;

        @vertex
        fn vertexMain(@location(0) pos: vec3f, @builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
            var barycentrics = array<vec3f, 3> (
                vec3(1, 0, 0),
                vec3(0, 1, 0),
                vec3(0, 0, 1)
            );
            var output: VertexOutput;
            output.position = mvp * vec4f(pos, 1);
            output.barycentric = barycentrics[vertexIndex % 3];
            return output;
    }`;

    // fragment shader
    const fragmentShaderCode = `
        @fragment
        fn fragmentMain(@location(0) bary: vec3f) -> @location(0) vec4f {
            let threshold = 0.01;
            if (min(min(bary.x, bary.y), bary.z) >= threshold) {
                return vec4f(0, 0, 0, 0);
            }
            return vec4f(1, 1, 1, 1);
        }
    `;

    // create shader modules
	const vertexShaderModule = device.createShaderModule({
		label: "Sphere Vertex Shader",
		code: vertexShaderCode
	});
	const fragmentShaderModule = device.createShaderModule({
		label: "Sphere Fragment Shader",
		code: fragmentShaderCode
	});


    // UNIFORM BUFFER AND BIND GROUP
    // create uniform buffer for MVP matrix
    const uniformBuffer = device.createBuffer({
        label: "MVP Uniform",
        size: 64,  // for 4x4 matrix (8 * 16 bytes)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // create bind group layout
    const bindGroupLayout = device.createBindGroupLayout({
        label: "MVP Bind Group Layout",
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: "uniform" },  // can omit type param
        }]
    });

    // create bind group
    const bindGroup = device.createBindGroup({
        label: "Sphere bind group",
        layout: bindGroupLayout,
        entries: [{
            binding: 0,
            resource: { buffer: uniformBuffer },
        }],
    });


    // CAMERA SETUP
    // view matrix
    function createViewMatrix(pos, rot) {
        const view = mat4.create();
        mat4.rotateX(view, view, rot[0]);
        mat4.rotateY(view, view, rot[1]);
        mat4.rotateZ(view, view, rot[2]);
        mat4.translate(view, view, [-pos[0], -pos[1], -pos[2]]);
        return view;
    }

    function createOrbitalViewMatrix(pos, target, up) {
        const view = mat4.create();
        mat4.lookAt(view, pos, target, up);
        return view;
    }

    // projection matrix
    const fov = Math.PI / 6;  // pi/4 radians
    const aspect = canvas.width / canvas.height;
    // clipping planes
    const near = 0.1;
    const far = 100.0;

    const projection = mat4.create();
    mat4.perspective(projection, fov, aspect, near, far);
    // MVP computed in render loop


    // CAMERA CONTROLS

    let cameraPosition = [0, 0, 7];
    let cameraRotation = [0, 0, 0];
    // TANK, ORBITAL
    const camSpeed = 0.1;
    const camRotationSpeed = 0.01;
    // ORBITAL
    let azimuth = 0.0;  // horizontal
    const maxLook = Math.PI / 2
    const minLook = -maxLook;

    // input handling
    // keyboard input
    const inputs = {
        w: false,
        a: false,
        s: false,
        d: false,
        space: false,
    }

    // keyboard input
    document.addEventListener("keydown", (event) => {
        if (document.pointerLockElement === canvas) {
            switch(event.code) {
                case "KeyW":
                    inputs.w = true;
                    break;
                case "KeyA":
                    inputs.a = true;
                    break;
                case "KeyS":
                    inputs.s = true;
                    break;
                case "KeyD":
                    inputs.d = true;
                    break;
                case "space":
                    inputs.space = true;
                    break;
                case "escape":
                    // exit pointer lock on canvas
                    document.exitPointerLock();
            }
        }
    });
    document.addEventListener("keyup", (event) => {
        if (document.pointerLockElement === canvas) {
            switch(event.code) {
                case "KeyW":
                    inputs.w = false;
                    break;
                case "KeyA":
                    inputs.a = false;
                    break;
                case "KeyS":
                    inputs.s = false;
                    break;
                case "KeyD":
                    inputs.d = false;
                    break;
                case "space":
                    inputs.space = false;
                    break;
            }
        }
    });

    // mouse movement
    document.addEventListener("mousemove", (event) => {
        if (document.pointerLockElement === canvas) {
            const deltaX = event.movementX;
            const deltaY = event.movementY;

            cameraRotation[1] += camRotationSpeed * deltaX;  // yaw
            cameraRotation[0] += camRotationSpeed * deltaY;  // pitch

            // prevent flipping
            cameraRotation[0] = Math.max(minLook, Math.min(maxLook, cameraRotation[0]));
        }
    });

    // request pointer lock within canvas
    canvas.addEventListener("click", () => {
        if (document.pointerLockElement === canvas) {
            // in game
            console.log("click");
        }
        else {
            // free cursor
            canvas.requestPointerLock();
        }
    });


    // update camera
    let view;

    function updateCamera() {
        const forwardX = Math.cos(cameraRotation[0]) * Math.sin(cameraRotation[1]);
        const forwardY = Math.sin(cameraRotation[0]);
        const forwardZ = Math.cos(cameraRotation[0]) * Math.cos(cameraRotation[1]);
        const strafeX = Math.cos(cameraRotation[1]);
        const strafeZ = -Math.sin(cameraRotation[1]);

        // TODO normalize
        if (inputs.w) {
            cameraPosition[0] += camSpeed * forwardX;
            cameraPosition[1] -= camSpeed * forwardY;
            cameraPosition[2] -= camSpeed * forwardZ;
        }
        if (inputs.a) {
            cameraPosition[0] -= camSpeed * strafeX;
            cameraPosition[2] += camSpeed * strafeZ;
        }
        if (inputs.s) {
            cameraPosition[0] -= camSpeed * forwardX;
            cameraPosition[1] += camSpeed * forwardY;
            cameraPosition[2] += camSpeed * forwardZ;
        }
        if (inputs.d) {
            cameraPosition[0] += camSpeed * strafeX;
            cameraPosition[2] -= camSpeed * strafeZ;
        }
        if (inputs.r) {
            cameraPosition[1] += camSpeed;
        }
        if (inputs.f) {
            cameraPosition[1] -= camSpeed;
        }
        view = createViewMatrix(cameraPosition, cameraRotation, [0, 1, 0]);
    }


    // PIPELINE
	const pipeline = device.createRenderPipeline({
		label: "FPV Pipeline",
		layout: device.createPipelineLayout({
            label: "FPV Pipeline Layout",
            bindGroupLayouts: [bindGroupLayout],
        }),
		vertex: {
			module: vertexShaderModule,
			entryPoint: "vertexMain",
			buffers: [{
				arrayStride: 4 * 3 /*bytes*/,
				attributes: [{
					format: "float32x3",
					offset: 0,
					shaderLocation: 0
				}],
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
            topology: TOPOLOGY,
            frontFace: "ccw",
            cullMode: "back",
        },
        multisample: {
            count: 4,
        },
	});


    // 4xMSAA TEXTURES
    let canvasTexture = context.getCurrentTexture();
    let msaaTexture = device.createTexture({
        format: canvasTexture.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        size: [canvas.width, canvas.height],
        sampleCount: 4,
    });

    // handle resize
    function handleResize() {
        const parent = canvas.parentElement;

        canvas.width = Math.floor(parent.clientWidth * devicePixelRatio);
        canvas.height = Math.floor(parent.clientHeight * devicePixelRatio);

        mat4.perspective(projection, fov, canvas.width / canvas.height, near, far);

        if (msaaTexture) { msaaTexture.destroy(); }
        msaaTexture = device.createTexture({
            format: canvasTexture.format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            size: [canvas.width, canvas.height],
            sampleCount: 4,
        });

        if (!animating && !autoplay) {
            renderLoop();
        }
    }


    // RENDER LOOP
    let animating = false;
	function renderLoop() {
        // create input texture the size of canvas
        canvasTexture = context.getCurrentTexture();

        // update camera
        updateCamera();

        // mvp matrix
        const mvp = mat4.create();
        mat4.multiply(mvp, projection, view);

        // write mvp matrix to uniform buffer
        device.queue.writeBuffer(uniformBuffer, 0, mvp);

		// create GPUCommandEncoder
		const encoder = device.createCommandEncoder();

		// begin render pass
		const pass = encoder.beginRenderPass({
			colorAttachments: [{
                view: msaaTexture.createView(),  // render to MSAA texture
				//view: context.getCurrentTexture().createView(),
				loadOp: "clear",
				clearValue: { r: 0, g: 0, b: 0, a: 1 },
				storeOp: "store",
                resolveTarget: canvasTexture.createView(),
			}],
		});

        // TODO what is this?
        //pass.setViewport(0, 0, canvas.width, canvas.height, 0, 1);

		// draw
		pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);

        for (const { buffer, vertexCount } of vertexBuffers) {
            pass.setVertexBuffer(0, buffer);
            pass.draw(vertexCount);
        }

		// end render pass
		pass.end();

		// create and submit GPUCommandBuffer
		device.queue.submit([encoder.finish()]);

        if (animating || autoplay) {
            requestAnimationFrame(renderLoop);
        }
	}


    // ANIMATION CONTROL
    function startRenderLoop() {
        if (!animating) {
            animating = true;
            renderLoop();
        }
    }

    function stopRenderLoop() {
        animating = false;
    }

    handleResize();
    window.addEventListener("resize", () => {
        handleResize();
    });
    
    renderLoop();

    if (!autoplay) {
	    canvas.addEventListener("mouseenter", startRenderLoop);
        canvas.addEventListener("mouseleave", stopRenderLoop);
    }
}