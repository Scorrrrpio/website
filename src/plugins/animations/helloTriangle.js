// LERP FUNCTIONS
function lerpVector(vOut, v1, v2, t) {
    if (vOut.length != v1.length || vOut.length != v2.length) {
        return;
    }
    for (let i = 0; i < v1.length; i++) {
        vOut[i] = lerpValue(v1[i], v2[i], t);
    }
}

function lerpValue(v1, v2, t) {
    return v1 * (1-t) + v2 * t;
}


export function helloTriangle(meshComponent, frame) {
	// arrays for lerping
	const triangleRGB = new Float32Array([
		// X,  Y,    R    G    B    A
		0.0,  1.0,  1.0, 0.0, 0.0, 1.0,
		-1.0, -0.73, 0.0, 1.0, 0.0, 1.0,
		1.0, -0.73, 0.0, 0.0, 1.0, 1.0
	]);
	const triangleGBR = new Float32Array([
		// X,  Y,    R    G    B    A
		0.0,  1.0,  0.0, 1.0, 0.0, 1.0,
		-1.0, -0.73, 0.0, 0.0, 1.0, 1.0,
		1.0, -0.73, 1.0, 0.0, 0.0, 1.0
	]);
	const triangleBRG = new Float32Array([
		// X,  Y,    R    G    B    A
		0.0,  1.0,  0.0, 0.0, 1.0, 1.0,
		-1.0, -0.73, 1.0, 0.0, 0.0, 1.0,
		1.0, -0.73, 0.0, 1.0, 0.0, 1.0
	]);
	
	frame %= 1800;
	if (frame < 600) {
		lerpVector(meshComponent.vertices.data, triangleRGB, triangleGBR, frame / 600);
	}
	else if (frame < 1200) {
		lerpVector(meshComponent.vertices.data, triangleGBR, triangleBRG, (frame-600) / 600);
	}
	else {
		lerpVector(meshComponent.vertices.data, triangleBRG, triangleRGB, (frame-1200) / 600);
	}
	
	meshComponent.writeVertexBuffer(true);
}