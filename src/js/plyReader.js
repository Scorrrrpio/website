export async function readPly(filename) {
    // fetch ply file from server
    const url = "geometry/" + filename;
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
    let faces = [];
    for (let i = 0; i < faceCount; i++) {
        const triVerts = lines[++lineIndex].split(" ");
        faces.push(Number(triVerts[0]));
        faces.push(Number(triVerts[1]));
        faces.push(Number(triVerts[2]));
    }

    console.log(vertices);
    console.log(faces);

    // generate Float32Array
    const floatVerts = new Float32Array(faceCount * 9);
    let verticesIndex = 0;
    for (let vert of faces) {
        floatVerts[verticesIndex++] = vertices[Math.floor(vert) * 3];
        floatVerts[verticesIndex++] = vertices[Math.floor(vert) * 3 + 1];
        floatVerts[verticesIndex++] = vertices[Math.floor(vert) * 3 + 2];
    }
    return floatVerts;
}