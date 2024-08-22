async function readPly(url, topology) {
    // fetch ply file from server;
    const response = await fetch(url);
    const text = await response.text();

    // separate into lines
    const lines = text.split("\n");

    let readingVertices = false;
    let readingFaces = false;
    let vertsCount = 0;
    let faceCount = 0;
    let vertices = [];
    let faces = [];
    let topologyVerts = 0;  // number of vertices for rendering topology

    // TODO properties -> object
    for (const line of lines) {
        const parts = line.split(" ");
        if (readingFaces) {
            // reading faces
            const sides = Number(parts[0]);
            faces.push(parts.slice(1, sides + 1).map(Number));
            // add vertices to count
            if (topology === "triangle-list") { topologyVerts += (sides - 2) * 3; }
            else if (topology === "line-list") { topologyVerts += sides * 2; }
        }
        else if (readingVertices) {
            // reading vertices
            // TODO variable dimensions
            vertices.push([
                Number(parts[0]),
                Number(parts[1]),
                Number(parts[2]),
            ]);
            // count vertices
            if (--vertsCount === 0) { readingFaces = true; }
        }
        else {
            // reading metadata
            // data format
            if (parts[0] == "format" && parts[1] === "binary") {
                throw new Error("Binary .ply files not supported");
            }
            // element count
            else if (parts[0] == "element") {
                if (parts[1] == "vertex") { vertsCount = Number(parts[2]); }
                if (parts[1] == "face") { faceCount = Number(parts[2]); }
            }
            // TODO properties
            // end_header
            else if (parts[0] == "end_header") { readingVertices = true; }
        }
    }

    return { vertices, faces, topologyVerts };
}

export async function plyToTriangleList(url) {
    const { vertices, faces, topologyVerts } = await readPly(url, "triangle-list");
    // generate Float32Array
    const floatVerts = new Float32Array(topologyVerts * 3);
    let vIndex = 0;
    for (const face of faces) {
        // TODO selectable triangulation behaviour
        // handle polygons with fan of triangles
        for (let i = 1; i < face.length - 1; i++) {
            // v0
            floatVerts[vIndex++] = vertices[face[0]][0];
            floatVerts[vIndex++] = vertices[face[0]][1];
            floatVerts[vIndex++] = vertices[face[0]][2];
            // vi
            floatVerts[vIndex++] = vertices[face[i]][0];
            floatVerts[vIndex++] = vertices[face[i]][1];
            floatVerts[vIndex++] = vertices[face[i]][2];
            // v(i+1)
            floatVerts[vIndex++] = vertices[face[i+1]][0];
            floatVerts[vIndex++] = vertices[face[i+1]][1];
            floatVerts[vIndex++] = vertices[face[i+1]][2];
        }
    }
    return floatVerts;
}

export async function plyToLineList(url) {
    const { vertices, faces, topologyVerts } = await readPly(url, "line-list");
    // generate Float32Array
    const floatVerts = new Float32Array(topologyVerts * 3);
    let vIndex = 0;
    for (const face of faces) {
        for (let i = 0; i < face.length; i++) {
            // v0
            floatVerts[vIndex++] = vertices[face[i]][0];
            floatVerts[vIndex++] = vertices[face[i]][1];
            floatVerts[vIndex++] = vertices[face[i]][2];
            // v1
            floatVerts[vIndex++] = vertices[face[(i+1) % face.length]][0];
            floatVerts[vIndex++] = vertices[face[(i+1) % face.length]][1];
            floatVerts[vIndex++] = vertices[face[(i+1) % face.length]][2];
        }
    }
    return floatVerts;
}