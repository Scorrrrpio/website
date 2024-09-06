// NOTE: this will not read ALL .ply files (but it works for my purposes)

async function readPly(url, topology) {
    // fetch ply file from server;
    const response = await fetch(url);
    const text = await response.text();

    // separate into lines
    const lines = text.split("\n");

    const data = {};
    data.properties = [];
    data.faces = [];
    data.topologyVerts = 0;  // number of vertices for rendering topology
    data.source = url;

    let readingVertices = false;
    let readingFaces = false;
    let vertsCount = 0;
    let faceCount = 0;

    for (const line of lines) {
        const parts = line.split(" ");
        if (readingFaces) {
            // read faces
            const sides = Number(parts[0]);
            data.faces.push(parts.slice(1, sides + 1).map(Number));
            // add vertices to count
            if (topology === "triangle-list") { data.topologyVerts += (sides - 2) * 3; }
            else if (topology === "line-list") { data.topologyVerts += sides * 2; }
            // count faces
            if (--faceCount === 0) {
                readingFaces = false;
            }
        }
        else if (readingVertices) {
            // read vertices
            for (const i in parts) {
                data[data.properties[i]].push(Number(parts[i]));
            }
            // count vertices
            if (--vertsCount === 0) {
                readingVertices = false;
                readingFaces = true;
            }
        }
        else {
            // read header
            // data format
            if (parts[0] == "format" && parts[1] === "binary") {
                throw new Error("Binary .ply files not supported");
            }
            // element count
            else if (parts[0] == "element") {
                if (parts[1] == "vertex") { vertsCount = Number(parts[2]); }
                if (parts[1] === "face") { faceCount = Number(parts[2]); }
            }
            // properties
            else if (parts[0] == "property") {
                if (parts[1] == "list") {}  // TODO for evil files
                else {
                    // parts[1] is type
                    data.properties.push(parts[2]);
                }
            }
            // end_header
            else if (parts[0] == "end_header") {
                readingVertices = true;
                // create fields in data Object
                for (const property of data.properties) { data[property] = []; }
            }
        }
    }

    return data;
}

export async function plyToTriangleList(url) {
    const data = await readPly(url, "triangle-list");
    // generate Float32Array
    const vertices = {};
    vertices.properties = data.properties;
    vertices.floats = new Float32Array(data.topologyVerts * data.properties.length);
    let vIndex = 0;
    for (const face of data.faces) {
        // TODO selectable triangulation behaviour
        // handle polygons with fan of triangles
        for (let i = 1; i < face.length - 1; i++) {
            // v0
            for (const property of vertices.properties) {
                vertices.floats[vIndex++] = data[property][face[0]];
            }
            // vi
            for (const property of vertices.properties) {
                vertices.floats[vIndex++] = data[property][face[i]];
            }
            // v(i+1)
            for (const property of vertices.properties) {
                vertices.floats[vIndex++] = data[property][face[i+1]];
            }
        }
    }
    return vertices;
}