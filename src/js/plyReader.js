import { AssetLoadError } from "./errors";

function readPlyHeader(lines) {
    if (lines[0] != "ply") {
        throw new AssetLoadError("Invalid ply file");
    }

    function normalizeType(name) {
        return typeAlias[name] || name;
    }
    const typeAlias = {
        float: "float32",
        double: "float64",
        char: "int8",
        short: "int16",
        int: "int32",
        uchar: "uint8",
        ushort: "uint16",
        uint: "uint32",
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
                    countType: normalizeType(parts[2]),
                    listType: normalizeType(parts[3]),
                    name: parts[4],
                    maxSize: 0,
                });
            }
            else {
                metadata.elements[elem].properties.push({
                    name: parts[2],
                    type: normalizeType(parts[1]),
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
            const instance = [];
            const parts = lines[i+j].split(" ").map(Number);
            let readIndex = 0;
            for (let k = 0; k < element.properties.length; k++) {
                if (element.properties[k].type === "list") {
                    instance.push(...parts.slice(readIndex, readIndex + parts[readIndex] + 1).map(Number));
                    if (parts[readIndex] > element.properties[k].maxSize) {
                        element.properties[k].maxSize = Number(parts[readIndex]);
                    }
                    readIndex += Number(parts[readIndex]) + 1;
                }
                else {
                    instance.push(parts[readIndex++]);
                }
            }
            data[element.name].push(instance);
        }
        i += element.count;
    }
    return data;
}

function parseProperty(type, view, offset, littleEndian) {
    const readers = {
        float32: view.getFloat32.bind(view),
        float64: view.getFloat64.bind(view),
        int8: view.getInt8.bind(view),
        int16: view.getInt16.bind(view),
        int32: view.getInt32.bind(view),
        uint8: view.getUint8.bind(view),
        uint16: view.getUint16.bind(view),
        uint32: view.getUint32.bind(view),
    }
    return Number(readers[type]?.(offset, littleEndian));
}

function readBinary(buffer, metadata) {
    const littleEndian = metadata.format === "binary_little_endian";
    const view = new DataView(buffer);
    const data = {};

    const advance = {
        float32: 4,
        float64: 8,
        int8: 1,
        int16: 2,
        int32: 4,
        uint8: 1,
        uint16: 2,
        uint32: 4,
    };

    let offset = 0;
    for (const element of metadata.elements) {
        data[element.name] = [];
        for (let i = 0; i < element.count; i++) {
            const instance = [];
            for (const property of element.properties) {
                if (property.type === "list") {
                    const count = parseProperty(property.countType, view, offset, littleEndian);
                    offset += advance[property.countType];
                    instance.push(count);
                    if (count > property.maxSize) {
                        property.maxSize = count;
                    }
                    for (let j = 0; j < count; j++) {
                        instance.push(parseProperty(property.listType, view, offset, littleEndian));
                        offset += advance[property.listType];
                    }
                }
                else {
                    instance.push(parseProperty(property.type, view, offset, littleEndian));
                    offset += advance[property.type];
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

function createTypedArrays(element, count) {
    const typeCounts = {
        float32: [], float64: [],
        int8: [], int16: [], int32: [],
        uint8: [], uint16: [], uint32: [],
    }
    for (const property of element.properties) {
        if (property.type === "list") {
            typeCounts[property.countType].push(property.name + "_count");
            for (let i = 0; i < property.maxSize; i++) {
                typeCounts[property.listType].push(property.name);
            }
            if (element.name === "vertex") {
                // TODO fixed length for list based on longest?
                throw new AssetLoadError("Cannot process list parameters in vertex element. Check ply files.");
            }
        }
        else {
            typeCounts[property.type].push(property.name);
        }
    }
    for (const type in typeCounts) {
        if (typeCounts[type].length > 0) {
            const values = {};
            switch (type) {
                case ("float32"): values.data = new Float32Array(count * typeCounts[type].length); break;
                case ("float64"): values.data = new Float64Array(count * typeCounts[type].length); break;
                case ("int8"):    values.data = new Int8Array(count * typeCounts[type].length);    break;
                case ("int16"):   values.data = new Int16Array(count * typeCounts[type].length);   break;
                case ("int32"):   values.data = new Int32Array(count * typeCounts[type].length);   break;
                case ("uint8"):   values.data = new Uint8Array(count * typeCounts[type].length);   break;
                case ("uint16"):  values.data = new Uint16Array(count * typeCounts[type].length);  break;
                case ("uint32"):  values.data = new Uint32Array(count * typeCounts[type].length);  break;
            }
            values.properties = typeCounts[type];
            element.values[type] = values;
        }
    }
}

// TODO this does too much, readPly does to little
export async function plyToTriangleList(url) {
    const { data, metadata } = await readPly(url);

    console.log("METADATA\n", metadata);
    console.log("DATA\n", data);

    // TODO group properties for BGL
    const plyData = {};
    for (const element of metadata.elements) {
        const indices = {
            float32: 0, float64: 0,
            int8: 0, int16: 0, int32: 0,
            uint8: 0, uint16: 0, uint32: 0,
        }

        const elem = {};
        elem.properties = element.properties;
        elem.values = {};

        // Generate TypedArrays
        createTypedArrays(elem, element.count);

        for (let i = 0; i < element.count; i++) {
            let readIndex = 0;
            for (const p of element.properties) {
                const t = p.type;
                if (t === "list") {
                    const ct = p.countType;
                    const count = data[element.name][i][readIndex++]
                    elem.values[ct].data[indices[ct]++] = count;
                    const lt = p.listType;
                    for (let j = 0; j < p.maxSize; j++) {
                        if (j < count) {
                            elem.values[lt].data[indices[lt]++] = data[element.name][i][readIndex++];
                        }
                        else {
                            // fill to maxSize with 0s
                            elem.values[lt].data[indices[lt]++] = 0;
                        }
                    }
                }
                else {
                    elem.values[t].data[indices[t]++] = data[element.name][i][readIndex++];
                }
            }
        }

        plyData[element.name] = elem;
    }


    // OLD CODE THAT WORKS
    /*
    const vertices = {};
    vertices.properties = metadata.elements[0].properties.map(p => p.name);
    const topologyVerts = data.face.reduce((sum, a) => sum + (a.length - 3) * 3, 0);
    vertices.floats = new Float32Array(topologyVerts * vertices.properties.length);  // generate Float32Array
    let vIndex = 0;
    for (const face of data.face) {
        // TODO selectable triangulation behaviour
        // handle polygons with fan of triangles
        for (let i = 2; i < face[0]; i++) {
            // v0
            for (const property in vertices.properties) {  // TODO can probably cleaner
                vertices.floats[vIndex++] = data.vertex[face[1]][property];
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
    }*/

    //console.log("VERTICES\n", vertices);
    console.log("PLY DATA\n", plyData);
    throw new Error("STOP");

    // EXPECTED
    // properties ["x", "y", "z", ...]
    // floats [0.5, 0.5, 0.5, ...]

    // REFACTOR
    /*
    {
        elements: [
            {

            },
            ...
        ]
    }
    */
    return vertices;
}

/*
        if (element.name === "vertex") {
            // vertex connections are defined by face or edge element
            if (data.face) {
                // generate faces
                const vertex = {};
                //vertex.properties = element.properties.map(p => p.name);
                vertex.properties = element.properties;
                vertex.values = {};

                // Generate TypedArrays
                // TODO wtf happens when there are list properties
                // computes number of verts for triangle-list with triangle fan triangulation
                const vertexCount = data.face.reduce((sum, a) => sum + (a.length - 3) * 3, 0);
                createTypedArrays(vertex, vertexCount);

                // Populate TypedArrays
                for (const face of data.face) {
                    // TODO selectable triangulation behaviour
                    // handle polygons with fan of triangles
                    for (let i = 2; i < face[0]; i++) {
                        // v0
                        for (const p in vertex.properties) {  // TODO can probably cleaner
                            const t = vertex.properties[p].type;  // TODO handle list?
                            vertex.values[t].data[indices[t]++] = data.vertex[face[1]][p];
                        }
                        // vi
                        for (const p in vertex.properties) {
                            const t = vertex.properties[p].type;
                            vertex.values[t].data[indices[t]++] = data.vertex[face[i]][p];
                        }
                        // v(i+1)
                        for (const p in vertex.properties) {
                            const t = vertex.properties[p].type;
                            vertex.values[t].data[indices[t]++] = data.vertex[face[i+1]][p];
                        }
                    }
                }

                plyData.vertex = vertex;
            }
            else if (data.edge) {
                // TODO ?
                throw new AssetLoadError("Unsupported ply elements for triangle-list topology.");
            }
            else { throw new AssetLoadError("Failed to load asset from ", url, ". Missing face and edge definitions"); }
        }
        else {
            const elem = {};
            elem.properties = element.properties;
            elem.values = {};

            // Generate TypedArrays
            createTypedArrays(elem, element.count);

            for (let i = 0; i < element.count; i++) {
                let offset = 0;
                for (const p in elem.properties) {
                    const t = elem.properties[p].type;
                    if (t === "list") {
                        const ct = elem.properties[p].countType;
                        elem.values[ct].data[indices[ct]++] = data[element.name][i][p];
                        const lt = elem.properties[p].listType;
                        for (let j = 1; j <= elem.properties[p].maxSize; j++) {
                            elem.values[lt].data[indices[lt]++] = data[element.name][i][Number(p)+j];
                        }
                        offset += p.maxSize;
                    }
                    else {
                        elem.values[t].data[indices[t]++] = data[element.name][i][p];
                    }
                }
            }

            plyData[element.name] = elem;
        }*/