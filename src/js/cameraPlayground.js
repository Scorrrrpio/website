// imports
import { mat4 } from "gl-matrix";
import { wgpuSetup } from "./wgpuSetup";
import { plyToLineList, plyToTriangleList } from "./plyReader";

// inspired by the sphere graphic from lokinet.org
export async function cameraPlayground(canvasID, autoplay) {
    // WEBGPU SETUP
	const canvas = document.getElementById(canvasID);
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = 512 * devicePixelRatio;
    canvas.height = 512 * devicePixelRatio;

    const { adapter, device, context, format } = await wgpuSetup(canvas);


    // GEOMETRY
    const TOPOLOGY = "line-list"; const data = await plyToLineList("geometry/cube.ply");
    const vertices = data.vertBuffer;

    // create vertex buffer
	const vertexBuffer = device.createBuffer({
		label: "Cube Vertices",
		size: vertices.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
	});

    // copy vertex data into vertex buffer
	device.queue.writeBuffer(vertexBuffer, 0, vertices);


    // SHADERS
	// vertex shader
	const vertexShaderCode = `
        @group(0) @binding(0) var<uniform> mvp: mat4x4<f32>;

        @vertex
        fn vertexMain(@location(0) pos: vec3<f32>) -> @builtin(position) vec4<f32> {
            return mvp * vec4<f32>(pos, 1);
    }`;

    // fragment shader
    const fragmentShaderCode = `
        @fragment
        fn fragmentMain(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
            return vec4<f32>(1, 1, 1, 1);
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
    //const CAMTYPE = "TANK";
    //const CAMTYPE = "ORBITAL";
    const CAMTYPE = "FPS";

    let cameraPosition = [0, 0, 7];
    let cameraRotation = [0, 0, 0];
    // TANK, ORBITAL
    const camSpeed = 0.1;
    const camRotationSpeed = 0.01;
    // ORBITAL
    let radius = 7.0;
    let azimuth = 0.0;  // horizontal
    let elevation = Math.PI / 4;  // vertical
    const maxElevation = Math.PI / 2 - 0.1;
    const minElevation = -maxElevation;
    const minRadius = 0.1;
    const maxLook = Math.PI / 2
    const minLook = -maxLook;

    // input handling
    // keyboard input
    const keysPressed = {
        w: false,
        a: false,
        s: false,
        d: false,
        r: false,  // rise
        f: false,  // fall
    }
    // listen for keyboard
    document.addEventListener("keydown", (event) => {
        switch(event.code) {
            case "KeyW":
                keysPressed.w = true;
                break;
            case "KeyA":
                keysPressed.a = true;
                break;
            case "KeyS":
                keysPressed.s = true;
                break;
            case "KeyD":
                keysPressed.d = true;
                break;
            case "KeyR":
                keysPressed.r = true;
                break;
            case "KeyF":
                keysPressed.f = true;
                break;
        }
    });
    document.addEventListener("keyup", (event) => {
        switch(event.code) {
            case "KeyW":
                keysPressed.w = false;
                break;
            case "KeyA":
                keysPressed.a = false;
                break;
            case "KeyS":
                keysPressed.s = false;
                break;
            case "KeyD":
                keysPressed.d = false;
                break;
            case "KeyR":
                keysPressed.r = false;
                break;
            case "KeyF":
                keysPressed.f = false;
                break;
        }
    });

    // mouse input
    let isDragging = false;
    let lastMouseX;
    let lastMouseY;
    // listen for mouse
    if (CAMTYPE === "ORBITAL") {
        document.addEventListener("mousedown", (event) => {
            isDragging = true;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
        });
        document.addEventListener("mouseup", (event) => { isDragging = false; });
        document.addEventListener("mousemove", (event) => {
            if (isDragging) {
                const deltaX = event.clientX - lastMouseX;
                const deltaY = event.clientY - lastMouseY;

                // TODO update if sluggish
                // update spherical coordinates
                azimuth -= deltaX * camRotationSpeed;
                elevation += deltaY * camRotationSpeed;

                elevation = Math.max(minElevation, Math.min(elevation, maxElevation));

                // update previous mouse positions
                lastMouseX = event.clientX;
                lastMouseY = event.clientY;
            }
        });
    }
    else if (CAMTYPE === "FPS") {
        document.addEventListener("mousemove", (event) => {
            if (document.pointerLockElement === canvas) {
                const deltaX = event.movementX;
                const deltaY = event.movementY;

                cameraRotation[1] += camRotationSpeed * deltaX;  // yaw
                cameraRotation[0] += camRotationSpeed * deltaY;  // pitch

                // prevent flipping
                cameraRotation[0] = Math.max(minLook, Math.min(maxLook, cameraRotation[0]));

                // update previous mouse positions
                lastMouseX = event.clientX;
                lastMouseY = event.clientY;
            }
        });

        // request pointer lock within canvas
        canvas.addEventListener("click", () => {
            canvas.requestPointerLock();
        });

        // handle pointer lock change
        document.addEventListener("pointerlockchange", () => {
            if (document.pointerLockElement === canvas) {
                console.log("pointer locked");
            }
            else {
                console.log("pointer unlocked");
            }
        });

        // release pointer lock
        document.addEventListener("keydown", (event) => {
            if (event.code === "Escape") {
                document.exitPointerLock();
            }
        });
    }


    // update camera
    let view;
    function updateCamera() {
        if (CAMTYPE === "TANK") {
            updateTankCamera();
        }
        else if (CAMTYPE === "ORBITAL") {
            updateOrbitalCamera();
        }
        else if (CAMTYPE === "FPS") {
            updateFPSCamera();
        }
    }

    function updateTankCamera() {
        const forwardX = Math.sin(cameraRotation[1]);
        const forwardZ = Math.cos(cameraRotation[1]);

        if (keysPressed.w) {
            cameraPosition[0] += camSpeed * forwardX;
            cameraPosition[2] -= camSpeed * forwardZ;
        }
        if (keysPressed.a) {
            cameraRotation[1] -= camRotationSpeed;
        }
        if (keysPressed.s) {
            cameraPosition[0] -= camSpeed * forwardX;
            cameraPosition[2] += camSpeed * forwardZ;
        }
        if (keysPressed.d) {
            cameraRotation[1] += camRotationSpeed;
        }
        if (keysPressed.r) {
            cameraPosition[1] += camSpeed;
        }
        if (keysPressed.f) {
            cameraPosition[1] -= camSpeed;
        }
        view = createViewMatrix(cameraPosition, cameraRotation, [0, 1, 0]);
    }

    function updateOrbitalCamera() {
        // zoom
        if (keysPressed.w) {
            radius = Math.max(minRadius, radius - camSpeed);
        }
        if (keysPressed.s) {
            radius += camSpeed;
        }
        // convert spherical coordinates to cartesian
        cameraPosition[0] = radius * Math.cos(elevation) * Math.sin(azimuth);
        cameraPosition[1] = radius * Math.sin(elevation);
        cameraPosition[2] = radius * Math.cos(elevation) * Math.cos(azimuth);
        view = createOrbitalViewMatrix(cameraPosition, [0, 0, 0], [0, 1, 0]);
    }

    function updateFPSCamera() {
        const forwardX = Math.cos(cameraRotation[0]) * Math.sin(cameraRotation[1]);
        const forwardY = Math.sin(cameraRotation[0]);
        const forwardZ = Math.cos(cameraRotation[0]) * Math.cos(cameraRotation[1]);
        const strafeX = Math.cos(cameraRotation[1]);
        const strafeZ = -Math.sin(cameraRotation[1]);

        if (keysPressed.w) {
            cameraPosition[0] += camSpeed * forwardX;
            cameraPosition[1] -= camSpeed * forwardY;
            cameraPosition[2] -= camSpeed * forwardZ;
        }
        if (keysPressed.a) {
            cameraPosition[0] -= camSpeed * strafeX;
            cameraPosition[2] += camSpeed * strafeZ;
        }
        if (keysPressed.s) {
            cameraPosition[0] -= camSpeed * forwardX;
            cameraPosition[1] += camSpeed * forwardY;
            cameraPosition[2] += camSpeed * forwardZ;
        }
        if (keysPressed.d) {
            cameraPosition[0] += camSpeed * strafeX;
            cameraPosition[2] -= camSpeed * strafeZ;
        }
        if (keysPressed.r) {
            cameraPosition[1] += camSpeed;
        }
        if (keysPressed.f) {
            cameraPosition[1] -= camSpeed;
        }
        view = createViewMatrix(cameraPosition, cameraRotation, [0, 1, 0]);
    }


    // PIPELINE
	const pipeline = device.createRenderPipeline({
		label: "Sphere Pipeline",
		layout: device.createPipelineLayout({
            label: "Sphere Pipeline Layout",
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
            cullMode: "none",
        },
        multisample: {
            count: 4,
        },
	});


    // 4xMSAA TEXTURES
    let canvasTexture = context.getCurrentTexture();
    const msaaTexture = device.createTexture({
        format: canvasTexture.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        size: [canvas.width, canvas.height],
        sampleCount: 4,
    });


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

		// render triangle
		pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
		pass.setVertexBuffer(0, vertexBuffer);
		pass.draw(vertices.length / 3);

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

    renderLoop();
    if (!autoplay) {
	    canvas.addEventListener("mouseenter", startRenderLoop);
        canvas.addEventListener("mouseleave", stopRenderLoop);
    }
}