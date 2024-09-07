import { AssetLoadError } from "./errors";

function readPlyHeader(lines) {
    if (lines[0] != "ply") {
        throw new AssetLoadError("Invalid ply file");
    }

    const metadata = {};
    metadata.elements = [];

    let dataStart = 0;
    let element;
    for (const line of lines) {
        dataStart++;
        if (line === "end_header") { break; }
        const parts = line.split(" ");
        if (parts[0] === "format") {
            metadata.format = parts[1];  // ascii, binary_little_endian, binary_big_endian
            metadata.formatVersion = parts[2];
        }
        else if (parts[0] === "element") {
            metadata.elements[parts[1]] = {
                count: Number(parts[2]),
                properties: [],
            };
            element = parts[1];
        }
        else if (parts[0] === "property") {
            if (parts[1] === "list") {
                // TODO handle list
                metadata.elements[element].properties.push({
                    type: parts[1],
                    countType: parts[2],
                    listType: parts[3],
                    name: parts[4],
                });
            }
            else {
                metadata.elements[element].properties.push({
                    name: parts[2],
                    type: parts[1],
                });
            }
        }
    }
    metadata.dataStart = dataStart;
    return metadata;
}

function readASCII(lines, metadata) {
    const data = {};

    let i = metadata.dataStart;
    for (const element in metadata.elements) {
        data[element] = [];
        for (let j = 0; j < metadata.elements[element].count; j++) {
            if (metadata.elements[element].properties[0].type === "list") {
                const parts = lines[i+j].split(" ");
                data[element].push(parts.slice(1, parts[0] + 1));
            }
            else {
                data[element].push(lines[i+j].split(" "));
            }
        }
        i += metadata.elements[element].count;
    }

    return data;
}

function readBinary(lines, metadata) {}  // TODO

async function readPly(url) {
    // fetch ply file from server;
    const response = await fetch(url);
    const text = await response.text();

    // separate into lines
    const lines = text.split("\n");

    // read header
    const metadata = readPlyHeader(lines);

    // read data
    let data;
    if (metadata.format === "ascii") {
        data = readASCII(lines, metadata);
    }
    else if (metadata.format === "binary_little_endian") {}
    else if (metadata.format === "binary_big_endian") {}
    else { throw new AssetLoadError("Invalid ply format"); }

    return { data, metadata };
}

export async function plyToTriangleList(url) {
    const { data, metadata } = await readPly(url);

    // generate Float32Array
    const vertices = {};  // TODO include other data (e.g. material)
    vertices.properties = metadata.elements.vertex.properties.map(p => p.name);
    const topologyVerts = data.face.reduce((sum, a) => sum + (a.length - 2) * 3, 0);
    vertices.floats = new Float32Array(topologyVerts * vertices.properties.length);
    let vIndex = 0;
    for (const face of data.face) {
        // TODO selectable triangulation behaviour
        // handle polygons with fan of triangles
        for (let i = 1; i < face.length - 1; i++) {
            // v0
            for (const property in vertices.properties) {
                vertices.floats[vIndex++] = data.vertex[face[0]][property];
            }
            // vi
            for (const property in vertices.properties) {
                vertices.floats[vIndex++] = data.vertex[face[i]][property];
            }
            // v(i+1)
            for (const property in vertices.properties) {
                vertices.floats[vIndex++] = data.vertex[face[i+1]][property];
            }
        }
    }
    return vertices;
}