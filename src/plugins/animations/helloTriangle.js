export class HelloTriangle {
	static requiredComponents = ["MeshComponent"];

	// arrays for lerping
	static triangleRGB = new Float32Array([
		// X,  Y,    R    G    B    A
		0.0,  1.0,  1.0, 0.0, 0.0, 1.0,
		-1.0, -0.73, 0.0, 1.0, 0.0, 1.0,
		1.0, -0.73, 0.0, 0.0, 1.0, 1.0
	]);
	static triangleGBR = new Float32Array([
		// X,  Y,    R    G    B    A
		0.0,  1.0,  0.0, 1.0, 0.0, 1.0,
		-1.0, -0.73, 0.0, 0.0, 1.0, 1.0,
		1.0, -0.73, 1.0, 0.0, 0.0, 1.0
	]);
	static triangleBRG = new Float32Array([
		// X,  Y,    R    G    B    A
		0.0,  1.0,  0.0, 0.0, 1.0, 1.0,
		-1.0, -0.73, 1.0, 0.0, 0.0, 1.0,
		1.0, -0.73, 0.0, 1.0, 0.0, 1.0
	]);

	static animate(meshComponent, frame=0) {
		frame %= 1800;
		if (frame < 600) {
			HelloTriangle.#lerpVector(
				meshComponent.vertices.data,
				HelloTriangle.triangleRGB,
				HelloTriangle.triangleGBR,
				frame / 600
			);
		}
		else if (frame < 1200) {
			HelloTriangle.#lerpVector(
				meshComponent.vertices.data,
				HelloTriangle.triangleGBR,
				HelloTriangle.triangleBRG,
				(frame-600) / 600
			);
		}
		else {
			HelloTriangle.#lerpVector(
				meshComponent.vertices.data,
				HelloTriangle.triangleBRG,
				HelloTriangle.triangleRGB,
				(frame-1200) / 600
			);
		}
		
		meshComponent.writeVertexBuffer(true);
	}

	// LERP FUNCTIONS
	static #lerpVector(vOut, v1, v2, t) {
		if (vOut.length != v1.length || vOut.length != v2.length) {
			return;
		}
		for (let i = 0; i < v1.length; i++) {
			vOut[i] = HelloTriangle.#lerpValue(v1[i], v2[i], t);
		}
	}

	static #lerpValue(v1, v2, t) {
		return v1 * (1-t) + v2 * t;
	}
}