async function readPly(url) {
    // fetch ply file from server;
    const response = await fetch(url);
    const text = await response.text();

    // separate into lines
    const lines = text.split("\n");

    // parse metadata
    let lineIndex = 0;
    let vertsCount = 0;
    let faceCount = 0;
    while (lines[lineIndex] != "end_header") {
        const parts = lines[lineIndex].split(" ");
        if (parts[0] === "element") {
            if (parts[1] === "vertex") {
                vertsCount = parts[2];
            }
            else if (parts[1] === "face") {
                faceCount = parts[2];
            }
        }
        lineIndex++;
    }

    // read vertices
    let vertices = [];
    for (let i = 0; i < vertsCount; i++) {
        const xyz = lines[++lineIndex].split(" ");
        vertices.push(Number(xyz[0]));
        vertices.push(Number(xyz[1]));
        vertices.push(Number(xyz[2]));
    }

    // read faces
    // assuming all faces are triangles
    // TODO handle quads
    let faces = [];
    for (let i = 0; i < faceCount; i++) {
        const triVerts = lines[++lineIndex].split(" ");
        faces.push(Number(triVerts[1]));
        faces.push(Number(triVerts[2]));
        faces.push(Number(triVerts[3]));
    }

    return { vertices, faces };
}

export async function plyToTriangleList(url) {
    const { vertices, faces } = await readPly(url);
    // generate Float32Array
    const floatVerts = new Float32Array(faces.length * 3);
    let verticesIndex = 0;
    for (let vert of faces) {
        floatVerts[verticesIndex++] = vertices[vert * 3];
        floatVerts[verticesIndex++] = vertices[vert * 3 + 1];
        floatVerts[verticesIndex++] = vertices[vert * 3 + 2];
    }
    return floatVerts;
}

export async function plyToLineList(url) {
    const { vertices, faces } = await readPly(url);
    // generate Float32Array
    const floatVerts = new Float32Array(faces.length * 9);
    let verticesIndex = 0;
    for (let i = 0; i < faces.length; i++) {
        // vert
        floatVerts[verticesIndex++] = vertices[faces[i] * 3];
        floatVerts[verticesIndex++] = vertices[faces[i] * 3 + 1];
        floatVerts[verticesIndex++] = vertices[faces[i] * 3 + 2];
        if (i % 3 === 2) {
            // back
            floatVerts[verticesIndex++] = vertices[faces[i-2] * 3];
            floatVerts[verticesIndex++] = vertices[faces[i-2] * 3 + 1];
            floatVerts[verticesIndex++] = vertices[faces[i-2] * 3 + 2];
        }
        else {
            // next
            floatVerts[verticesIndex++] = vertices[faces[i+1] * 3];
            floatVerts[verticesIndex++] = vertices[faces[i+1] * 3 + 1];
            floatVerts[verticesIndex++] = vertices[faces[i+1] * 3 + 2];
        }
    }
    return floatVerts;
}