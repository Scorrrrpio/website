import { AssetLoadError } from "./errors";

function readPlyHeader(lines) {
    if (lines[0] != "ply") {
        throw new AssetLoadError("Invalid ply file");
    }

    const metadata = {};
    metadata.elements = [];

    let dataStart = 0;
    let elem = -1;
    for (const line of lines) {
        dataStart++;
        if (line === "end_header") { break; }
        const parts = line.split(" ");
        if (parts[0] === "format") {
            metadata.format = parts[1];  // ascii, binary_little_endian, binary_big_endian
            metadata.formatVersion = parts[2];
        }
        else if (parts[0] === "element") {
            metadata.elements.push({
                name: parts[1],
                count: Number(parts[2]),
                properties: [],
            });
            elem++;
        }
        else if (parts[0] === "property") {
            if (parts[1] === "list") {
                metadata.elements[elem].properties.push({
                    type: parts[1],
                    countType: parts[2],
                    listType: parts[3],
                    name: parts[4],
                });
            }
            else {
                metadata.elements[elem].properties.push({
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
    for (const element of metadata.elements) {
        data[element.name] = [];
        for (let j = 0; j < element.count; j++) {
            if (element.properties[0].type === "list") {
                const parts = lines[i+j].split(" ");
                data[element.name].push(parts.slice(1, parts[0] + 1));
            }
            else {
                data[element.name].push(lines[i+j].split(" "));
            }
        }
        i += element.count;
    }

    return data;
}

function readBinary(buffer, metadata) {
    const littleEndian = metadata.format === "binary_little_endian";
    const view = new DataView(buffer);
    const data = {};

    let offset = 0;
    for (const element of metadata.elements) {
        data[element.name] = [];
        for (let i = 0; i < element.count; i++) {
            const instance = [];
            for (const property of element.properties) {
                // TODO handle types
                if (property.type === "list") {
                    const count = view.getUint8(offset, littleEndian);
                    offset += 1;
                    for (let j = 0; j < count; j++) {
                        instance.push(
                            view.getUint32(offset, littleEndian)
                        );
                        offset += 4;
                    }
                }
                else {
                    instance.push(
                        view.getFloat32(offset, littleEndian)
                    );
                    offset += 4;
                }
            }
            data[element.name].push(instance);
        }
    }

    return data;
}

async function readPly(url) {
    // fetch ply file from server;
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const text = new TextDecoder().decode(buffer);

    // separate into lines
    const lines = text.split("\n");

    // read header
    const metadata = readPlyHeader(lines);

    // read data
    let data;
    if (metadata.format === "ascii") { data = readASCII(lines, metadata); }
    else if (metadata.format === "binary_little_endian" || metadata.format === "binary_big_endian") {
        // TODO BIG REVIEW
        const endHeaderIndex = text.indexOf("end_header") + "end_header".length;
        const afterHeader = text.slice(endHeaderIndex).match(/^\r?\n/);
        const binaryStart = endHeaderIndex + (afterHeader ? afterHeader[0].length : 0);

        //const binaryStart = new TextEncoder().encode(lines.slice(0, metadata.dataStart).join("\n")).length;
        //metadata.binaryStart = binaryStart;
        data = readBinary(buffer.slice(binaryStart), metadata);
    }
    else { throw new AssetLoadError("Invalid ply format"); }

    return { data, metadata };
}

export async function plyToTriangleList(url) {
    const { data, metadata } = await readPly(url);

    // generate Float32Array
    const vertices = {};  // TODO include other data (e.g. material)
    // TODO property types
    // TODO group properties
    vertices.properties = metadata.elements[0].properties.map(p => p.name);
    const topologyVerts = data.face.reduce((sum, a) => sum + (a.length - 2) * 3, 0);
    vertices.floats = new Float32Array(topologyVerts * vertices.properties.length);
    let vIndex = 0;
    for (const face of data.face) {
        // TODO selectable triangulation behaviour
        // handle polygons with fan of triangles
        for (let i = 1; i < face.length - 1; i++) {
            // v0
            for (const property in vertices.properties) {  // TODO can probably cleaner
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